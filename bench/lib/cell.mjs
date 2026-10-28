const TOOLCHAINS = {
	T1: { install: 'pnpm', run: 'node' },
	T2: { install: 'bun', run: 'node' },
	T3: { install: 'bun', run: 'bun' }
};

const RUNTIMES = {
	R1: { binary: 'node', adapter: 'adapter-node', communityAdapter: false, codeChange: false },
	R2: { binary: 'bun', adapter: 'adapter-node', communityAdapter: false, codeChange: false },
	R3: {
		binary: 'bun',
		adapter: 'svelte-adapter-bun',
		communityAdapter: true,
		codeChange: true
	},
	R4: {
		binary: 'bun',
		adapter: 'adapter-node',
		communityAdapter: false,
		codeChange: true,
		fullstackOnly: true
	}
};

const RESOURCES = {
	'1cpu': { cpus: 1, memory: '512m' },
	'2cpu': { cpus: 2, memory: '1g' }
};

const SCENARIOS = {
	S1: { apps: ['ssr-fullstack'], route: 'GET /home' },
	S2: { apps: ['ssr-fullstack'], route: 'GET /api/items' },
	S3: { apps: ['ssr-fullstack'], route: 'POST /api/items' },
	S4: { apps: ['ssr-fullstack'], route: 'POST /login' },
	S5: { apps: ['ssr-fastapi'], route: 'GET /api/proxy/v1/items' },
	S6: { apps: ['ssr-fullstack'], route: 'GET /_app/immutable/*.js' },
	S7: { apps: ['ssr-fullstack', 'ssr-fastapi'], route: 'S1 50%, S2 30%, S3 10%, S5 10%' }
};

export function parseCell(id) {
	if (typeof id !== 'string' || id.length === 0) {
		throw new Error('Cell id is empty. Expected T1-ssr-fullstack or R1-S7-1cpu.');
	}
	const tool = /^T([123])-(ssr-fullstack|ssr-fastapi|spa)$/.exec(id);
	if (tool) {
		const toolchain = `T${tool[1]}`;
		const template = tool[2];
		return {
			axis: 'A',
			id,
			toolchain,
			template,
			...TOOLCHAINS[toolchain]
		};
	}
	const runtime = /^R([1-4])-S([1-7])-(1cpu|2cpu)(-otel-off)?$/.exec(id);
	if (!runtime) {
		throw new Error(`Unknown cell "${id}". Expected T1-ssr-fullstack or R1-S7-1cpu.`);
	}
	const key = `R${runtime[1]}`;
	const scenario = `S${runtime[2]}`;
	const resourceName = runtime[3];
	const spec = RUNTIMES[key];
	const scenarioSpec = SCENARIOS[scenario];
	if (spec.fullstackOnly && !scenarioSpec.apps.includes('ssr-fullstack')) {
		throw new Error(`${id} is invalid. R4 only applies to a scenario that runs the fullstack app.`);
	}
	return {
		axis: 'B',
		id,
		runtime: key,
		scenario,
		route: scenarioSpec.route,
		apps: scenarioSpec.apps,
		resources: { name: resourceName, ...RESOURCES[resourceName] },
		otel: runtime[4] ? 'off' : 'shipping',
		...spec
	};
}
