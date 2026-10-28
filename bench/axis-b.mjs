import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { runGroup, start } from './lib/proc.mjs';
import { scaffoldProject } from './lib/scaffold.mjs';
import { disableTracing, useBunSqlite, useCommunityAdapter } from './lib/variant.mjs';
import { pickSharedLoad } from './lib/load.mjs';
import { phaseValid, summarizeK6 } from './lib/k6summary.mjs';

const PROBE_RATES = [10, 25, 50, 75, 100, 150, 200, 300, 400, 600, 800];
const PROBE_SEC = 20;
const PROBE_WARMUP_MS = 5_000;
const MEASURE_SEC = 90;
const MEASURE_WARMUP_MS = 30_000;

function record(commands, cmd, args, result) {
	commands.push({
		cmd: [cmd, ...args].join(' '),
		code: result.code,
		sec: Number((result.sec ?? 0).toFixed(3)),
		timedOut: Boolean(result.timedOut)
	});
	return result;
}

function failed(errors, label, result) {
	if (result.code === 0 && !result.timedOut) return false;
	errors.push(`${label} exited ${result.code}${result.timedOut ? ' (timeout)' : ''}: ${(result.stderr || '').slice(-800)}`);
	return true;
}

function toBytes(text) {
	const match = /^([0-9.]+)\s*(B|KiB|MiB|GiB)/.exec(String(text).trim());
	if (!match) return null;
	const unit = { B: 1, KiB: 1024, MiB: 1024 ** 2, GiB: 1024 ** 3 }[match[2]];
	return Number(match[1]) * unit;
}

function assignCpus(nproc, cell) {
	const parts = [];
	for (const app of cell.apps) parts.push({ name: app, count: cell.resources.cpus });
	if (cell.apps.includes('ssr-fastapi')) parts.push({ name: 'mock', count: 1 });
	parts.push({ name: 'k6', count: 1 });
	const total = parts.reduce((sum, part) => sum + part.count, 0);
	if (nproc < total) return { pinningOk: false, sets: {} };
	const sets = {};
	let next = 0;
	for (const part of parts) {
		const cpus = [];
		for (let i = 0; i < part.count; i += 1) cpus.push(String(next++));
		sets[part.name] = cpus.join(',');
	}
	return { pinningOk: true, sets };
}

function r1CellId(cell) {
	const suffix = cell.otel === 'off' ? '-otel-off' : '';
	return `R1-${cell.scenario}-${cell.resources.name}${suffix}`;
}

async function walkResults(dir) {
	const found = [];
	let entries;
	try {
		entries = await readdir(dir, { withFileTypes: true });
	} catch {
		return found;
	}
	for (const entry of entries) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) found.push(...(await walkResults(path)));
		else if (entry.name === 'result.json') found.push(JSON.parse(await readFile(path, 'utf8')));
	}
	return found;
}

async function sharedR1Load(benchDir, cell) {
	if (cell.runtime === 'R1') return null;
	const rows = await walkResults(join(benchDir, 'out', r1CellId(cell)));
	return pickSharedLoad(rows);
}

function scenario(exec, rate, durationSec) {
	const rounded = Math.max(1, Math.round(rate));
	return {
		executor: 'constant-arrival-rate',
		exec,
		rate: rounded,
		timeUnit: '1s',
		duration: `${durationSec}s`,
		preAllocatedVUs: Math.min(50, Math.max(10, rounded)),
		maxVUs: Math.max(100, rounded * 2),
		requested: rounded
	};
}

function buildPlan(cell, session, rate, durationSec) {
	const scenarios = {};
	const add = (name, exec, fraction) => {
		scenarios[name] = scenario(exec, rate * fraction, durationSec);
	};
	if (cell.scenario === 'S1') add('home', 'home', 1);
	if (cell.scenario === 'S2') add('items', 'itemsGet', 1);
	if (cell.scenario === 'S3') add('create', 'itemsPost', 1);
	if (cell.scenario === 'S4') add('login', 'login', 1);
	if (cell.scenario === 'S5') add('proxy', 'proxy', 1);
	if (cell.scenario === 'S6') add('asset', 'asset', 1);
	if (cell.scenario === 'S7') {
		add('home', 'home', 0.5);
		add('items', 'itemsGet', 0.3);
		add('create', 'itemsPost', 0.1);
		add('proxy', 'proxy', 0.1);
	}
	const requested = Object.values(scenarios).reduce((sum, item) => sum + item.requested, 0);
	for (const spec of Object.values(scenarios)) delete spec.requested;
	return {
		originFullstack: 'http://app-fullstack:3000',
		originFastapi: 'http://app-fastapi:3000',
		session: session?.token ?? '',
		username: session?.username ?? '',
		password: session?.password ?? '',
		needsAsset: cell.scenario === 'S6',
		scenarios,
		requested
	};
}

function yamlQuote(value) {
	return `'${String(value).replaceAll("'", "''")}'`;
}

function composeFile({ project, cell, images, pinning, paths }) {
	const lines = [`name: ${project}`, 'services:'];
	for (const app of cell.apps) {
		const service = app === 'ssr-fullstack' ? 'app-fullstack' : 'app-fastapi';
		const command = cell.binary === 'bun' ? 'bun build/index.js' : 'node build/index.js';
		lines.push(
			`  ${service}:`,
			`    image: ${images[app]}`,
			`    cpus: "${cell.resources.cpus}"`,
			`    mem_limit: ${cell.resources.memory}`,
			...(pinning.sets[app] ? [`    cpuset: ${yamlQuote(pinning.sets[app])}`] : []),
			'    environment:',
			'      NODE_ENV: production',
			'      HOST: 0.0.0.0',
			'      PORT: "3000"',
			'      PROTOCOL_HEADER: x-forwarded-proto',
			'      HOST_HEADER: x-forwarded-host',
			'      DATABASE_URL: /tmp/sqlite.db',
			'      BACKEND_API_URL: http://mock:9000',
			'    entrypoint: ["/bin/sh", "/entrypoint.sh"]',
			`    command: [${command
				.split(' ')
				.map((part) => yamlQuote(part))
				.join(', ')}]`,
			'    volumes:',
			`      - ${paths.entrypoint}:/entrypoint.sh:ro`
		);
		if (app === 'ssr-fullstack') {
			lines.push(`      - ${paths.sqlite}:/seed/sqlite.db:ro`);
		}
	}
	if (cell.apps.includes('ssr-fastapi')) {
		lines.push(
			'  mock:',
			`    image: ${paths.nodeImage}`,
			'    command: ["node", "/mock/server.mjs"]',
			...(pinning.sets.mock ? [`    cpuset: ${yamlQuote(pinning.sets.mock)}`] : []),
			'    volumes:',
			`      - ${paths.mock}:/mock/server.mjs:ro`
		);
	}
	return lines.filter((line) => line !== '').join('\n') + '\n';
}

async function buildAppImage(cell, app, dir, versions, benchDir, commands, errors) {
	const dockerfile = join(
		benchDir,
		cell.binary === 'node' ? 'docker/Dockerfile.node' : 'docker/Dockerfile.bun'
	);
	const tag = `sveltekitten-bench:${cell.id}-${app}`.toLowerCase();
	const args = [
		'build',
		'-f',
		dockerfile,
		'-t',
		tag,
		'--build-arg',
		`NODE_IMAGE=${versions.NODE_IMAGE}`,
		'--build-arg',
		`BUN_IMAGE=${versions.BUN_IMAGE}`,
		'--build-arg',
		`PNPM_VERSION=${versions.PNPM_VERSION}`,
		dir
	];
	const result = record(commands, 'docker', args, await runGroup('docker', args, { timeoutMs: 30 * 60 * 1000 }));
	failed(errors, `docker build ${app}`, result);
	return result.code === 0 ? tag : null;
}

async function prepareApp(cell, app, parent, repoRoot, versions, benchDir, commands, errors) {
	const created = await scaffoldProject(repoRoot, parent, app, app);
	record(commands, process.execPath, [join(repoRoot, 'dist/index.js'), '--yes', '--name', app], created);
	if (failed(errors, `scaffold ${app}`, created)) return null;
	const dir = created.dir;
	if (cell.otel === 'off') await disableTracing(dir);
	if (cell.runtime === 'R3') await useCommunityAdapter(dir, versions.BUN_ADAPTER_PACKAGE);
	if (cell.runtime === 'R4' && app === 'ssr-fullstack') await useBunSqlite(dir);
	if (cell.binary === 'bun') {
		const installed = record(
			commands,
			'bun',
			['install'],
			await runGroup('bun', ['install'], {
				cwd: dir,
				timeoutMs: 600_000,
				env: { BUN_INSTALL_CACHE_DIR: join(dir, '.bench-bun-cache'), CI: '1' }
			})
		);
		if (failed(errors, `bun install ${app}`, installed)) return null;
	}
	return buildAppImage(cell, app, dir, versions, benchDir, commands, errors);
}

async function writeSnapshot(versions, benchDir, destDir, commands, errors) {
	const tag = 'sveltekitten-bench-seed:node';
	const build = record(
		commands,
		'docker',
		['build', '-f', 'Dockerfile.seed', '-t', tag],
		await runGroup(
			'docker',
			[
				'build',
				'-f',
				join(benchDir, 'docker/Dockerfile.seed'),
				'-t',
				tag,
				'--build-arg',
				`NODE_IMAGE=${versions.NODE_IMAGE}`,
				join(benchDir, 'docker')
			],
			{ timeoutMs: 600_000 }
		)
	);
	if (failed(errors, 'seed image', build)) return null;
	const script = join(benchDir, 'seed/snapshot.mjs');
	const db = join(destDir, 'sqlite.db');
	const meta = join(destDir, 'session.json');
	const seeded = record(
		commands,
		'docker',
		['run', '--rm', tag],
		await runGroup('docker', [
			'run',
			'--rm',
			'-v',
			`${script}:/opt/seed/snapshot.mjs:ro`,
			'-v',
			`${destDir}:/out`,
			tag,
			'node',
			'/opt/seed/snapshot.mjs',
			'/out/sqlite.db',
			'/out/session.json'
		])
	);
	if (failed(errors, 'seed snapshot', seeded)) return null;
	return { db, meta: JSON.parse(await readFile(meta, 'utf8')) };
}

function serviceName(app) {
	return app === 'ssr-fullstack' ? 'app-fullstack' : 'app-fastapi';
}

async function waitReady(project, file, cell, errors) {
	const started = performance.now();
	const script =
		"fetch('http://127.0.0.1:3000/login').then((res) => process.exit(res.status === 200 ? 0 : 1)).catch(() => process.exit(1))";
	while (performance.now() - started < 90_000) {
		let ready = true;
		for (const app of cell.apps) {
			const bin = cell.binary === 'bun' ? 'bun' : 'node';
			const probe = await runGroup('docker', [
				'compose',
				'-p',
				project,
				'-f',
				file,
				'exec',
				'-T',
				serviceName(app),
				bin,
				'-e',
				script
			]);
			if (probe.code !== 0) ready = false;
		}
		if (ready && cell.apps.includes('ssr-fastapi')) {
			const mock = await runGroup('docker', [
				'compose',
				'-p',
				project,
				'-f',
				file,
				'exec',
				'-T',
				'app-fastapi',
				cell.binary === 'bun' ? 'bun' : 'node',
				'-e',
				"fetch('http://mock:9000/v1/items').then((res) => process.exit(res.status === 401 ? 0 : 1)).catch(() => process.exit(1))"
			]);
			if (mock.code !== 0) ready = false;
		}
		if (ready) return (performance.now() - started) / 1000;
		await new Promise((resolve) => setTimeout(resolve, 500));
	}
	errors.push('app did not return 200 from /login within 90s');
	return null;
}

async function stats(ids) {
	if (ids.length === 0) return [];
	const result = await runGroup('docker', ['stats', '--no-stream', '--format', '{{.Name}}\t{{.MemUsage}}\t{{.CPUPerc}}', ...ids]);
	if (result.code !== 0) return [];
	return result.stdout
		.split('\n')
		.filter(Boolean)
		.map((line) => {
			const [name, mem, cpu] = line.split('\t');
			return { name, rssBytes: toBytes(mem.split('/')[0]), cpuPercent: Number(String(cpu).replace('%', '')) };
		});
}

async function appIds(project, file, cell) {
	const ids = [];
	for (const app of cell.apps) {
		const ps = await runGroup('docker', ['compose', '-p', project, '-f', file, 'ps', '-q', serviceName(app)]);
		if (ps.code === 0 && ps.stdout.trim()) ids.push(ps.stdout.trim());
	}
	return ids;
}

async function runPhase({ versions, pinning, benchDir, outDir, phase, plan, commands }) {
	const planPath = join(outDir, `${phase}.plan.json`);
	const samplesPath = join(outDir, `${phase}.json`);
	await writeFile(planPath, JSON.stringify(plan, null, 2) + '\n');
	const args = ['run', '--rm', '--network', `${plan.project}_default`, '--user', '0'];
	if (pinning.sets.k6) args.push('--cpuset-cpus', pinning.sets.k6);
	args.push(
		'-v',
		`${join(benchDir, 'k6/load.js')}:/scripts/load.js:ro`,
		'-v',
		`${planPath}:/scripts/plan.json:ro`,
		'-v',
		`${outDir}:/out`,
		'-e',
		'PLAN=/scripts/plan.json',
		versions.K6_IMAGE,
		'run',
		'--out',
		`json=/out/${phase}.json`,
		'/scripts/load.js'
	);
	const child = start('docker', args);
	const samples = [];
	let done = false;
	child.exited.then(() => {
		done = true;
	});
	while (!done) {
		samples.push(await stats(plan.appIds));
		await new Promise((resolve) => setTimeout(resolve, 2000));
	}
	const result = await child.exited;
	record(commands, 'docker', args, { ...result, sec: 0 });
	let summary = summarizeK6('', phase.startsWith('probe') || phase === 'smoke' ? PROBE_WARMUP_MS : MEASURE_WARMUP_MS);
	try {
		summary = summarizeK6(
			await readFile(samplesPath, 'utf8'),
			phase.startsWith('probe') || phase === 'smoke' ? PROBE_WARMUP_MS : MEASURE_WARMUP_MS
		);
	} catch (err) {
		summary.parseError = err instanceof Error ? err.message : String(err);
	}
	const rss = samples.flat().map((sample) => sample.rssBytes).filter((n) => typeof n === 'number');
	const cpu = samples.flat().map((sample) => sample.cpuPercent).filter((n) => typeof n === 'number');
	summary.peakRssBytes = rss.length ? Math.max(...rss) : null;
	summary.peakCpuPercent = cpu.length ? Math.max(...cpu) : null;
	summary.rssSeries = rss;
	summary.k6Exit = result.code;
	summary.valid = phaseValid(summary);
	summary.requestedRps = plan.requested;
	return summary;
}

function holds(summary) {
	return summary.valid && summary.p99 !== null && summary.p99 <= 500 && summary.achievedRps >= summary.requestedRps * 0.9;
}

export async function runAxisB({ cell, smoke, versions, benchDir, repoRoot, outDir, host }) {
	const commands = [];
	const errors = [];
	const metrics = { smoke, curve: [] };
	const work = {};
	const pinning = assignCpus(host.nproc, cell);
	metrics.pinningOk = pinning.pinningOk;
	if (!pinning.pinningOk) {
		errors.push(`host has ${host.nproc} cores, not enough to pin the app, k6, and the mock on separate cores`);
	}
	const parent = join(benchDir, 'work', cell.id);
	await rm(parent, { recursive: true, force: true });
	await mkdir(parent, { recursive: true });

	const images = {};
	for (const app of cell.apps) {
		const tag = await prepareApp(cell, app, parent, repoRoot, versions, benchDir, commands, errors);
		if (!tag) return { metrics, work, errors, commands };
		images[app] = tag;
	}

	let session = null;
	if (cell.apps.includes('ssr-fullstack')) {
		const snap = await writeSnapshot(versions, benchDir, outDir, commands, errors);
		if (!snap) return { metrics, work, errors, commands };
		session = snap.meta;
		work.seededItems = session.itemCount;
	}

	const project = `bench${process.pid}`;
	const composePath = join(outDir, 'compose.yml');
	const text = composeFile({
		project,
		cell,
		images,
		pinning,
		paths: {
			entrypoint: join(benchDir, 'docker/entrypoint.sh'),
			sqlite: join(outDir, 'sqlite.db'),
			mock: join(benchDir, 'mock/server.mjs'),
			nodeImage: versions.NODE_IMAGE
		}
	});
	await writeFile(composePath, text);
	const up = record(
		commands,
		'docker',
		['compose', '-p', project, 'up', '-d'],
		await runGroup('docker', ['compose', '-p', project, '-f', composePath, 'up', '-d'], { timeoutMs: 120_000 })
	);
	try {
		if (failed(errors, 'compose up', up)) return { metrics, work, errors, commands };
		const startup = await waitReady(project, composePath, cell, errors);
		metrics.startupSec = startup === null ? null : Number(startup.toFixed(3));
		work.startup200 = startup !== null;
		if (startup === null) return { metrics, work, errors, commands };
		await new Promise((resolve) => setTimeout(resolve, 5_000));
		const ids = await appIds(project, composePath, cell);
		const idle = await stats(ids);
		metrics.idleRssBytes = idle.reduce((sum, sample) => sum + (sample.rssBytes ?? 0), 0) || null;

		const phaseBase = { versions, pinning, benchDir, outDir, commands, project, appIds: ids };
		if (smoke) {
			const plan = { ...buildPlan(cell, session, 5, 15), project, appIds: ids };
			metrics.smokePhase = await runPhase({ ...phaseBase, phase: 'smoke', plan });
			work.smokeRequests = metrics.smokePhase.workOk;
			if (!metrics.smokePhase.valid) errors.push('smoke phase did not complete the expected work with zero errors');
			return { metrics, work, errors, commands };
		}

		let saturation = null;
		for (const rate of PROBE_RATES) {
			const plan = { ...buildPlan(cell, session, rate, PROBE_SEC), project, appIds: ids };
			const summary = await runPhase({ ...phaseBase, phase: `probe-${rate}`, plan });
			metrics.curve.push({
				requestedRps: summary.requestedRps,
				achievedRps: summary.achievedRps,
				p50: summary.p50,
				p95: summary.p95,
				p99: summary.p99,
				errors: summary.errors,
				workOk: summary.workOk,
				valid: summary.valid
			});
			if (!holds(summary)) break;
			saturation = summary.requestedRps;
		}
		metrics.saturationRps = saturation;

		const shared = cell.runtime === 'R1' ? { rps: saturation, rounds: 1, eligible: host.eligible } : await sharedR1Load(benchDir, cell);
		if (!shared || shared.missing || shared.rps === null) {
			errors.push(`no R1 saturation for ${r1CellId(cell)}. Run that cell before this one.`);
			return { metrics, work, errors, commands };
		}
		metrics.sharedLoadRps = shared.rps;
		metrics.sharedLoadEligible = shared.eligible;
		for (const [name, fraction] of [
			['lat50', 0.5],
			['lat80', 0.8]
		]) {
			const plan = { ...buildPlan(cell, session, shared.rps * fraction, MEASURE_SEC), project, appIds: ids };
			metrics[name] = await runPhase({ ...phaseBase, phase: name, plan });
			if (!metrics[name].valid) errors.push(`${name} did not complete the expected work with zero errors`);
		}
		if (cell.scenario === 'S7') {
			const soakSec = Number(process.env.BENCH_SOAK_SEC || 1800);
			const plan = { ...buildPlan(cell, session, shared.rps * 0.8, soakSec + 30), project, appIds: ids };
			metrics.soak = await runPhase({ ...phaseBase, phase: 'soak', plan });
			if (!metrics.soak.valid) errors.push('soak did not complete the expected work with zero errors');
		}
		return { metrics, work, errors, commands };
	} finally {
		await runGroup('docker', ['compose', '-p', project, '-f', composePath, 'down', '-v']);
		await writeFile(join(outDir, 'commands.json'), JSON.stringify(commands, null, 2) + '\n');
	}
}
