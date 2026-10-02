import type { Codemod, FileTransform } from './index.js';

// Fresh scaffolds get the interface itself in contract.ts. Existing projects may have
// customised ItemsApi in port.ts, and a transform can't read one file while writing
// another, so here contract.ts re-exports from port.ts instead of copying the
// interface. Nothing a user added to port.ts is lost.
const CONTRACT_SHIM = `/**
 * What any items API implementation must do — see the contract tests.
 *
 * Renamed from \`port.ts\` in create-sveltekitten 0.3.9. The interface still lives in
 * \`./port\` in this project; move it here and delete \`port.ts\` when convenient.
 */
export type { ItemsApi } from './port';
`;

const PORT_HEADER = `// Deprecated name: import from './contract' instead (create-sveltekitten 0.3.9).
`;

function renameImport(content: string): string {
	return content.replaceAll("from './port'", "from './contract'");
}

const AGENT_ROLE_REPLACEMENTS: [string, string][] = [
	[
		"├── port.ts             # Interface for the feature's client API surface (e.g. `ItemsApi`)",
		"├── contract.ts         # Interface for the feature's client API surface (e.g. `ItemsApi`)"
	],
	[
		"├── port.ts             # Interface for the feature's API surface (e.g. `ItemsApi`)",
		"├── contract.ts         # Interface for the feature's API surface (e.g. `ItemsApi`)"
	],
	['— implements port.ts', '— implements contract.ts'],
	['hooks, injected with the port', 'hooks, injected with the contract implementation'],
	['- `port.ts` declares an interface', '- `contract.ts` declares an interface'],
	[
		'**Why `port.ts`?** `queries.ts` depends on the `port.ts` interface',
		'**Why `contract.ts`?** `queries.ts` depends on the `contract.ts` interface'
	],
	['the `ItemsApi` port,', 'the `ItemsApi` contract,'],
	[
		'**Port**: Create `src/lib/features/your-feature/port.ts`',
		'**Contract**: Create `src/lib/features/your-feature/contract.ts`'
	],
	['implementing the `port.ts` interface.', 'implementing the `contract.ts` interface.'],
	['each taking the port implementation as', 'each taking the contract implementation as']
];

const ITEMS_DIR = 'src/lib/features/items';

const codemod: Codemod = {
	from: '0.3.8',
	to: '0.3.9',
	transforms: [
		{
			// "port" (Ports & Adapters jargon) read as a network port to most of the team.
			// The interface is the contract every ItemsApi implementation must honour,
			// and its tests are contract tests, so the file is now named for that.
			file: `${ITEMS_DIR}/contract.ts`,
			create: true,
			transform: (content) => (content.trim() === '' ? CONTRACT_SHIM : content)
		},
		{
			file: `${ITEMS_DIR}/port.ts`,
			transform: (content) =>
				content.startsWith(PORT_HEADER) ? content : PORT_HEADER + content
		},
		...(['api.ts', 'queries.ts', 'index.ts'].map((name) => ({
			file: `${ITEMS_DIR}/${name}`,
			transform: renameImport
		})) satisfies FileTransform[]),
		{
			file: 'agent-role.md',
			transform: (content) =>
				AGENT_ROLE_REPLACEMENTS.reduce((next, [from, to]) => next.replaceAll(from, to), content)
		}
	]
};

export default codemod;
