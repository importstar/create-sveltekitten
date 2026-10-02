import type { Codemod } from './index.js';

type Replacement = [from: string, to: string];

/**
 * The edits in each file depend on each other, so apply all of them or none. Skip a
 * file that already has every result (some edits insert after an anchor that stays).
 */
function applyAllOrNothing(replacements: Replacement[]) {
	return (content: string) =>
		replacements.every(([from]) => content.includes(from)) &&
		!replacements.every(([, to]) => content.includes(to))
			? replacements.reduce((next, [from, to]) => next.replace(from, to), content)
			: content;
}

function createIfMissing(file: string) {
	return (content: string) => (content.trim() === '' ? file : content);
}

const SSR_CONTRACT_FILE = `import type { components } from '$lib/api/paths/fastapi';

export type HealthStatus = components['schemas']['HealthCheckResponse'];

/** What any health API implementation must do. */
export interface HealthApi {
	/** Resolves with the backend's health status, or \`undefined\` when it sent no body. */
	healthStatus(): Promise<HealthStatus | undefined>;
}
`;

const SPA_CONTRACT_FILE = `import type { components } from '$lib/api/openapi';

export type HealthStatus = components['schemas']['HealthCheckResponse'];

/** What any health API implementation must do. */
export interface HealthApi {
	/** Resolves with the backend's health status; rejects when the request fails. */
	healthStatus(): Promise<HealthStatus>;
}
`;

const SSR_API_REPLACEMENTS: Replacement[] = [
	[
		`import fastapiClient from '$lib/api/fastapi-client';
`,
		`import fastapiClient from '$lib/api/fastapi-client';
import type { HealthApi } from './contract';
`
	],
	[
		`	const { data } = await fastapiClient.GET('/v1/health');
	return data;
};
`,
		`	const { data } = await fastapiClient.GET('/v1/health');
	return data;
};

export const healthApi: HealthApi = { healthStatus };
`
	]
];

const SPA_API_REPLACEMENTS: Replacement[] = [
	[
		`import client, { apiRequest } from '$lib/api/client';
`,
		`import client, { apiRequest } from '$lib/api/client';
import type { HealthApi } from './contract';
`
	],
	[
		`	return apiRequest(client.GET('/v1/health'));
};
`,
		`	return apiRequest(client.GET('/v1/health'));
};

export const healthApi: HealthApi = { healthStatus };
`
	]
];

const SSR_QUERIES_REPLACEMENTS: Replacement[] = [
	[
		`import * as api from './api';
`,
		`import { healthApi as defaultHealthApi } from './api';
import type { HealthApi } from './contract';
`
	],
	[
		`export const useHealthStatus = () => {`,
		`export const useHealthStatus = (healthApi: HealthApi = defaultHealthApi) => {`
	],
	[
		`		queryFn: () => api.healthStatus(),`,
		`		queryFn: () => healthApi.healthStatus(),`
	]
];

const SPA_QUERIES_REPLACEMENTS: Replacement[] = [
	[
		`import * as api from './api'; // import api ที่คุณเขียนไว้
`,
		`import { healthApi as defaultHealthApi } from './api';
import type { HealthApi } from './contract';
`
	],
	[
		`export const useHealthStatus = () => {`,
		`export const useHealthStatus = (healthApi: HealthApi = defaultHealthApi) => {`
	],
	[
		`		queryFn: () => api.healthStatus(),`,
		`		queryFn: () => healthApi.healthStatus(),`
	]
];

const HOME_PAGE_REPLACEMENTS: Replacement[] = [
	[
		`	import * as api from '$lib/features/health/api';
`,
		`	import { healthApi } from '$lib/features/health/api';
`
	],
	[
		`		queryFn: () => api.healthStatus(),`,
		`		queryFn: () => healthApi.healthStatus(),`
	]
];

const codemod: Codemod = {
	from: '0.3.16',
	to: '0.3.17',
	transforms: [
		{
			// health/queries.ts still did `import * as api from './api'` — the exact
			// "before" picture items left behind in v0.3.3 — so nothing could swap the
			// implementation. It now gets a HealthApi contract, a healthApi object, and a
			// useHealthStatus(healthApi = defaultHealthApi) hook, mirroring items.
			file: 'src/lib/features/health/contract.ts',
			template: 'ssr',
			create: true,
			transform: createIfMissing(SSR_CONTRACT_FILE)
		},
		{
			file: 'src/lib/features/health/contract.ts',
			template: 'spa',
			create: true,
			transform: createIfMissing(SPA_CONTRACT_FILE)
		},
		{
			file: 'src/lib/features/health/api.ts',
			template: 'ssr',
			transform: applyAllOrNothing(SSR_API_REPLACEMENTS)
		},
		{
			file: 'src/lib/features/health/api.ts',
			template: 'spa',
			transform: applyAllOrNothing(SPA_API_REPLACEMENTS)
		},
		{
			file: 'src/lib/features/health/queries.ts',
			template: 'ssr',
			transform: applyAllOrNothing(SSR_QUERIES_REPLACEMENTS)
		},
		{
			file: 'src/lib/features/health/queries.ts',
			template: 'spa',
			transform: applyAllOrNothing(SPA_QUERIES_REPLACEMENTS)
		},
		{
			file: 'src/routes/(protected)/home/+page.svelte',
			template: 'ssr',
			transform: applyAllOrNothing(HOME_PAGE_REPLACEMENTS)
		}
	]
};

export default codemod;
