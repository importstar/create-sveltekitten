import v0_1_1 from './v0.1.1';
import v0_2_0 from './v0.2.0';
import v0_2_1 from './v0.2.1';

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

/** Add new version modules here in ascending order. */
export const codemods: Codemod[] = [v0_1_1, v0_2_0, v0_2_1];

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
