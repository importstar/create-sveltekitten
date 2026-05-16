export interface FileTransform {
	/** Relative path from project root, e.g. "src/lib/auth.ts" */
	file: string;
	transform: (content: string) => string;
}

export interface Codemod {
	from: string;
	to: string;
	transforms: FileTransform[];
}

/** Add new codemods here in chronological order whenever a template bug is fixed. */
export const codemods: Codemod[] = [
	{
		from: '0.1.0',
		to: '0.1.1',
		transforms: [
			{
				// SSR only — SPA skips (file not found)
				file: 'src/lib/features/login/components/form.svelte',
				transform: (content) =>
					content.replace(
						`import { LoaderCircle } from 'lucide-svelte';`,
						`import LoaderCircle from '@lucide/svelte/icons/loader-circle';`
					),
			},
		],
	},
	{
		from: '0.1.1',
		to: '0.2.0',
		transforms: [
			{
				file: 'package.json',
				transform: (content) => {
					// SSR: split openapi:fastapi (live URL) into fetch + generate + update scripts
					content = content.replace(
						`"openapi:fastapi": "openapi-typescript http://localhost:9000/openapi.json -o src/lib/api/paths/fastapi.d.ts"`,
						`"openapi:fetch": "mkdir -p src/libs/api-specs && curl -f http://localhost:9000/openapi.json -o src/libs/api-specs/fastapi.json",\n\t\t"openapi:fastapi": "openapi-typescript src/libs/api-specs/fastapi.json -o src/lib/api/paths/fastapi.d.ts",\n\t\t"openapi:update": "pnpm openapi:fetch && pnpm openapi:fastapi"`
					);
					// SPA: replace single openapi script (live URL) with split workflow
					content = content.replace(
						`"openapi": "openapi-typescript http://localhost:9000/openapi.json -o ./src/lib/api/openapi.d.ts"`,
						`"openapi": "openapi-typescript",\n\t\t"openapi:fetch": "mkdir -p src/libs/api-specs && curl -f http://localhost:9000/openapi.json -o src/libs/api-specs/fastapi.json",\n\t\t"openapi:fastapi": "openapi-typescript src/libs/api-specs/fastapi.json -o src/lib/api/openapi.d.ts",\n\t\t"openapi:update": "pnpm openapi:fetch && pnpm openapi:fastapi"`
					);
					return content;
				},
			},
			{
				file: '.gitignore',
				transform: (content) => {
					const additions: string[] = [];
					if (!content.includes('src/lib/api/paths/')) additions.push('src/lib/api/paths/');
					if (!content.includes('src/lib/api/openapi.d.ts')) additions.push('src/lib/api/openapi.d.ts');
					if (additions.length === 0) return content;
					return content.trimEnd() + '\n\n# openapi generated types\n' + additions.join('\n') + '\n';
				},
			},
		],
	},
];

function parseVersion(v: string): [number, number, number] {
	const [major = 0, minor = 0, patch = 0] = v.split('.').map(Number);
	return [major, minor, patch];
}

function versionGt(a: string, b: string): boolean {
	const [aMaj, aMin, aPat] = parseVersion(a);
	const [bMaj, bMin, bPat] = parseVersion(b);
	if (aMaj !== bMaj) return aMaj > bMaj;
	if (aMin !== bMin) return aMin > bMin;
	return aPat > bPat;
}

/** Returns codemods that need to run to go from `currentVersion` to `targetVersion`. */
export function getApplicableCodemods(currentVersion: string, targetVersion: string): Codemod[] {
	return codemods.filter(
		(c) => versionGt(c.to, currentVersion) && !versionGt(c.to, targetVersion)
	);
}
