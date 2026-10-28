import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hostFacts, readVersions } from './lib/host.mjs';
import { runGroup, start } from './lib/proc.mjs';
import { scaffoldProject } from './lib/scaffold.mjs';

const benchDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(benchDir, '..');
const fast = process.argv.includes('--fast');

const versions = readVersions(await readFile(join(benchDir, 'versions.env'), 'utf8'));
const host = hostFacts();
const outDir = join(benchDir, 'out', 'checklist');
await mkdir(outDir, { recursive: true });

const results = [];

async function check(id, fn) {
	const started = new Date().toISOString();
	let outcome;
	try {
		outcome = await fn();
	} catch (err) {
		outcome = { pass: false, command: id, output: err instanceof Error ? err.stack : String(err) };
	}
	const row = { id, started, hostEligible: host.eligible, ...outcome };
	results.push(row);
	await writeFile(join(outDir, `${id}.json`), JSON.stringify(row, null, 2) + '\n');
	console.log(`${row.pass ? 'pass' : 'fail'}  ${id}`);
	return row;
}

function dockerRun(image, scriptPath, runner) {
	return runGroup('docker', [
		'run',
		'--rm',
		'-v',
		`${scriptPath}:/opt/check/check.mjs:ro`,
		'-w',
		'/opt/check',
		image,
		runner,
		'check.mjs'
	]);
}

const scryptSource = `import { scryptSync } from 'node:crypto';
const password = 'bench-pass';
const salt = 'ab'.repeat(16);
process.stdout.write(scryptSync(password, salt, 64).toString('hex'));
`;

const sqliteSource = `import { createRequire } from 'node:module';
const Database = createRequire(import.meta.url)('better-sqlite3');
const db = new Database(':memory:');
db.exec('create table t (id integer)');
db.prepare('insert into t (id) values (1)').run();
const row = db.prepare('select id from t').get();
if (row.id !== 1) process.exit(1);
console.log('sqlite-ok');
`;

const pinoSource = `import pino from 'pino';
const lines = [];
const log = pino({ redact: ['password', 'token'] }, { write(line) { lines.push(line); } });
log.info({ password: 'secret', token: 'abc', ok: true }, 'hello');
const text = lines.join('');
if (text.includes('secret') || text.includes('abc')) process.exit(1);
if (!text.includes('hello')) process.exit(2);
console.log('pino-ok');
`;

const otelSource = `import { trace } from '@opentelemetry/api';
import { TracerProvider } from '@opentelemetry/sdk-trace';
const provider = new TracerProvider({ spanProcessors: [] });
trace.setGlobalTracerProvider(provider);
const span = trace.getTracer('bench').startSpan('tick');
const id = span.spanContext().traceId;
span.end();
if (!id || id === '0'.repeat(32)) process.exit(1);
console.log('otel-ok');
`;

async function writeScript(name, source) {
	const path = join(outDir, name);
	await writeFile(path, source);
	return path;
}

await check('better-sqlite3-node', async () => {
	const script = await writeScript('sqlite.mjs', sqliteSource);
	const command = `docker run ${versions.NODE_IMAGE} (apt, npm install better-sqlite3, node)`;
	const result = await runGroup(
		'docker',
		[
			'run',
			'--rm',
			'-v',
			`${script}:/opt/check/check.mjs:ro`,
			'-w',
			'/opt/check',
			versions.NODE_IMAGE,
			'bash',
			'-lc',
			'apt-get update && apt-get install -y --no-install-recommends python3 make g++ >/tmp/apt.log && npm install --silent better-sqlite3@13.0.3 && node check.mjs'
		],
		{ timeoutMs: 600_000 }
	);
	return { pass: result.code === 0 && result.stdout.includes('sqlite-ok'), command, output: `${result.stdout}\n${result.stderr}`.slice(-4000) };
});

await check('better-sqlite3-bun', async () => {
	const script = await writeScript('sqlite.mjs', sqliteSource);
	const command = `docker run ${versions.BUN_IMAGE} (apt, bun add better-sqlite3, bun)`;
	const result = await runGroup(
		'docker',
		[
			'run',
			'--rm',
			'-v',
			`${script}:/opt/check/check.mjs:ro`,
			'-w',
			'/opt/check',
			versions.BUN_IMAGE,
			'bash',
			'-lc',
			'apt-get update && apt-get install -y --no-install-recommends python3 make g++ >/tmp/apt.log && bun add better-sqlite3@13.0.3 && bun check.mjs'
		],
		{ timeoutMs: 600_000 }
	);
	return { pass: result.code === 0 && result.stdout.includes('sqlite-ok'), command, output: `${result.stdout}\n${result.stderr}`.slice(-4000) };
});

await check('scrypt-cross-runtime', async () => {
	const script = await writeScript('scrypt.mjs', scryptSource);
	const node = await dockerRun(versions.NODE_IMAGE, script, 'node');
	const bun = await dockerRun(versions.BUN_IMAGE, script, 'bun');
	const nodeHash = node.stdout.trim();
	const bunHash = bun.stdout.trim();
	const pass = node.code === 0 && bun.code === 0 && nodeHash.length === 128 && nodeHash === bunHash;
	return {
		pass,
		command: `node and bun each run scryptSync on the same password and salt`,
		output: `node ${node.code} ${nodeHash}\nbun ${bun.code} ${bunHash}\n${node.stderr}\n${bun.stderr}`.slice(-4000)
	};
});

await check('pino-redact-node', () => packageCheck('pino', versions.NODE_IMAGE, 'node', 'pino@10', pinoSource, 'pino-ok'));
await check('pino-redact-bun', () => packageCheck('pino', versions.BUN_IMAGE, 'bun', 'pino@10', pinoSource, 'pino-ok'));
await check('otel-sdk-node', () =>
	packageCheck('otel', versions.NODE_IMAGE, 'node', '@opentelemetry/api@1 @opentelemetry/sdk-trace@2', otelSource, 'otel-ok')
);
await check('otel-sdk-bun', () =>
	packageCheck('otel', versions.BUN_IMAGE, 'bun', '@opentelemetry/api@1 @opentelemetry/sdk-trace@2', otelSource, 'otel-ok')
);

async function packageCheck(name, image, runner, packages, source, marker) {
	const script = await writeScript(`${name}-${runner}.mjs`, source);
	const install = runner === 'bun' ? `bun add ${packages}` : `npm install --silent ${packages}`;
	const command = `docker run ${image} ${install} && ${runner} /check.mjs`;
	const result = await runGroup(
		'docker',
		[
			'run',
			'--rm',
			'-v',
			`${script}:/opt/check/check.mjs:ro`,
			'-w',
			'/opt/check',
			image,
			'sh',
			'-lc',
			`mkdir -p /opt/check && ${install} && ${runner} check.mjs`
		],
		{ timeoutMs: 600_000 }
	);
	return { pass: result.code === 0 && result.stdout.includes(marker), command, output: `${result.stdout}\n${result.stderr}`.slice(-4000) };
}

if (!fast) {
	await check('drizzle-and-patch-and-vitest', async () => {
		const parent = join(benchDir, 'work', 'checklist');
		const created = await scaffoldProject(repoRoot, parent, 'app', 'ssr-fullstack');
		if (created.code !== 0) {
			return { pass: false, command: 'scaffold ssr-fullstack', output: created.stderr.slice(-2000) };
		}
		const dir = created.dir;
		const install = await runGroup('pnpm', ['install', '--frozen-lockfile'], { cwd: dir, timeoutMs: 600_000, env: { CI: '1' } });
		if (install.code !== 0) {
			return { pass: false, command: 'pnpm install --frozen-lockfile', output: install.stderr.slice(-2000) };
		}
		const push = await runGroup('pnpm', ['exec', 'drizzle-kit', 'push'], {
			cwd: dir,
			timeoutMs: 120_000,
			env: { DATABASE_URL: 'checklist.sqlite', CI: '1' }
		});
		const studio = startStudio(dir);
		let studioOk = false;
		const deadline = performance.now() + 30_000;
		while (performance.now() < deadline) {
			try {
				const res = await fetch('http://127.0.0.1:4983');
				if (res.status < 500) {
					studioOk = true;
					break;
				}
			} catch {
				void 0;
			}
			await new Promise((resolve) => setTimeout(resolve, 500));
		}
		studio.stop();
		const vitest = await runGroup('pnpm', ['run', 'test:unit'], { cwd: dir, timeoutMs: 600_000 });
		const bunVitest = await runGroup('bun', ['--bun', './node_modules/vitest/vitest.mjs', 'run'], { cwd: dir, timeoutMs: 600_000 });
		const playwright = await runGroup('pnpm', ['exec', 'playwright', '--version'], { cwd: dir, timeoutMs: 120_000 });
		const patch = await runGroup(process.execPath, [join(repoRoot, 'dist/index.js'), 'patch'], { cwd: dir, timeoutMs: 60_000 });
		const pass =
			push.code === 0 &&
			studioOk &&
			vitest.code === 0 &&
			bunVitest.code === 0 &&
			playwright.code === 0 &&
			patch.code === 0 &&
			patch.stdout.includes('Already up to date');
		return {
			pass,
			command: 'drizzle-kit push, drizzle-kit studio, vitest (node and bun), playwright --version, create-sveltekitten patch',
			output: [
				`push ${push.code} ${push.stderr.slice(-500)}`,
				`studio ${studioOk}`,
				`vitest ${vitest.code}`,
				`bun vitest ${bunVitest.code} ${bunVitest.stderr.slice(-500)}`,
				`playwright ${playwright.stdout.trim()} ${playwright.stderr.slice(-300)}`,
				`patch ${patch.code} ${patch.stdout.slice(-300)}`
			].join('\n')
		};
	});
}

function startStudio(dir) {
	return start('pnpm', ['exec', 'drizzle-kit', 'studio', '--port', '4983', '--host', '127.0.0.1'], {
		cwd: dir,
		env: { DATABASE_URL: 'checklist.sqlite' }
	});
}

await writeFile(
	join(outDir, 'summary.json'),
	JSON.stringify({ host, versions, fast, results: results.map(({ id, pass }) => ({ id, pass })) }, null, 2) + '\n'
);
const failed = results.filter((row) => !row.pass);
process.exit(failed.length === 0 ? 0 : 1);
