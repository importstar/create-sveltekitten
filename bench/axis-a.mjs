import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runGroup, start } from './lib/proc.mjs';
import { scaffoldProject } from './lib/scaffold.mjs';

const DEV_PORT = Number(process.env.BENCH_DEV_PORT || 4179);

function record(commands, cmd, args, result) {
	commands.push({
		cmd: [cmd, ...args].join(' '),
		code: result.code,
		sec: Number(result.sec.toFixed(3)),
		timedOut: Boolean(result.timedOut)
	});
	return result;
}

function failed(errors, label, result) {
	if (result.code === 0 && !result.timedOut) return false;
	errors.push(`${label} exited ${result.code}${result.timedOut ? ' (timeout)' : ''}: ${result.stderr.slice(-800)}`);
	return true;
}

async function hashFile(path) {
	try {
		const buf = await readFile(path);
		return createHash('sha256').update(buf).digest('hex');
	} catch {
		return null;
	}
}

async function install(cell, dir, mode) {
	const store = join(dir, '.bench-store');
	const cache = join(dir, '.bench-bun-cache');
	if (mode === 'cold') {
		await rm(store, { recursive: true, force: true });
		await rm(cache, { recursive: true, force: true });
	}
	await rm(join(dir, 'node_modules'), { recursive: true, force: true });
	if (cell.install === 'pnpm') {
		const args = ['install', '--store-dir', store];
		if (mode === 'frozen') args.push('--frozen-lockfile');
		return runGroup('pnpm', args, { cwd: dir, timeoutMs: 600_000, env: { CI: '1' } });
	}
	const args = ['install'];
	if (mode === 'frozen') args.push('--frozen-lockfile');
	return runGroup('bun', args, {
		cwd: dir,
		timeoutMs: 600_000,
		env: { BUN_INSTALL_CACHE_DIR: cache, CI: '1' }
	});
}

function toolArgs(cell, script) {
	if (cell.run === 'bun') return ['bun', ['--bun', 'run', script]];
	return ['pnpm', ['run', script]];
}

async function waitForOk(url, timeoutMs) {
	const started = performance.now();
	while (performance.now() - started < timeoutMs) {
		try {
			const res = await fetch(url);
			if (res.status === 200) return (performance.now() - started) / 1000;
		} catch {
			void 0;
		}
		await new Promise((resolve) => setTimeout(resolve, 250));
	}
	return null;
}

async function buildImage(cell, dir, versions, benchDir, noCache) {
	const dockerfile =
		cell.install === 'pnpm'
			? join(benchDir, 'docker/Dockerfile.node')
			: join(benchDir, 'docker/Dockerfile.bun');
	const tag = `sveltekitten-bench:${cell.id}${noCache ? '-cold' : '-cached'}`.toLowerCase();
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
		`PNPM_VERSION=${versions.PNPM_VERSION}`
	];
	if (noCache) args.push('--no-cache');
	args.push(dir);
	const result = await runGroup('docker', args, { timeoutMs: 30 * 60 * 1000 });
	let imageBytes = null;
	if (result.code === 0) {
		const inspect = await runGroup('docker', ['image', 'inspect', '--format', '{{.Size}}', tag]);
		if (inspect.code === 0) imageBytes = Number(inspect.stdout.trim());
	}
	return { result, imageBytes, tag, dockerfile };
}

export async function runAxisA({ cell, smoke, versions, benchDir, repoRoot, outDir }) {
	const commands = [];
	const errors = [];
	const metrics = { smoke };
	const work = {};
	const parent = join(benchDir, 'work', cell.id);
	await rm(parent, { recursive: true, force: true });
	await mkdir(parent, { recursive: true });

	if (cell.install === 'bun' || cell.run === 'bun') {
		const bun = record(commands, 'bun', ['--version'], await runGroup('bun', ['--version']));
		if (failed(errors, 'bun --version', bun)) {
			return { metrics, work, errors, commands };
		}
		metrics.bunVersion = bun.stdout.trim();
	}

	const created = await scaffoldProject(repoRoot, parent, 'app', cell.template);
	record(commands, process.execPath, [join(repoRoot, 'dist/index.js'), '--yes', '--name', 'app'], created);
	if (failed(errors, 'scaffold', created)) return { metrics, work, errors, commands };
	const dir = created.dir;

	const cold = record(commands, cell.install, ['install', 'cold'], await install(cell, dir, 'cold'));
	metrics.installColdSec = cold.code === 0 ? Number(cold.sec.toFixed(3)) : null;
	failed(errors, 'install cold', cold);
	work.installCold = cold.code === 0;

	if (!smoke) {
		const warm = record(commands, cell.install, ['install', 'warm'], await install(cell, dir, 'warm'));
		metrics.installWarmSec = warm.code === 0 ? Number(warm.sec.toFixed(3)) : null;
		failed(errors, 'install warm', warm);
		const frozen = record(commands, cell.install, ['install', 'frozen'], await install(cell, dir, 'frozen'));
		metrics.installFrozenSec = frozen.code === 0 ? Number(frozen.sec.toFixed(3)) : null;
		metrics.installFrozenOk = frozen.code === 0;
		failed(errors, 'install frozen', frozen);
	} else {
		metrics.installWarmSec = null;
		metrics.installFrozenSec = null;
		metrics.installFrozenOk = null;
	}

	const [buildCmd, buildArgs] = toolArgs(cell, 'build');
	const build = record(commands, buildCmd, buildArgs, await runGroup(buildCmd, buildArgs, { cwd: dir, timeoutMs: 600_000 }));
	metrics.buildSec = build.code === 0 ? Number(build.sec.toFixed(3)) : null;
	work.build = build.code === 0;
	failed(errors, 'build', build);

	if (smoke || build.code !== 0) {
		await writeFile(join(outDir, 'commands.json'), JSON.stringify(commands, null, 2) + '\n');
		return { metrics, work, errors, commands };
	}

	await measureDev(cell, dir, metrics, work, errors, commands);
	await measureScripts(cell, dir, metrics, errors, commands);
	await measureLockfile(cell, dir, metrics, errors, commands);
	await measureDocker(cell, dir, versions, benchDir, metrics, errors, commands);

	await writeFile(join(outDir, 'commands.json'), JSON.stringify(commands, null, 2) + '\n');
	return { metrics, work, errors, commands };
}

async function measureDev(cell, dir, metrics, work, errors, commands) {
	const url = `http://127.0.0.1:${DEV_PORT}/login`;
	let cmd;
	let args;
	if (cell.run === 'bun') {
		cmd = 'bun';
		args = ['--bun', './node_modules/vite/bin/vite.js', 'dev', '--host', '127.0.0.1', '--port', String(DEV_PORT), '--strictPort'];
	} else {
		cmd = 'pnpm';
		args = ['exec', 'vite', 'dev', '--host', '127.0.0.1', '--port', String(DEV_PORT), '--strictPort'];
	}
	const server = start(cmd, args, { cwd: dir });
	const coldSec = await waitForOk(url, 120_000);
	metrics.devColdSec = coldSec === null ? null : Number(coldSec.toFixed(3));
	work.devReached200 = coldSec !== null;
	if (coldSec === null) {
		errors.push(`dev server did not return 200 on ${url}: ${server.output().slice(-800)}`);
		server.stop();
		return;
	}
	commands.push({ cmd: [cmd, ...args].join(' '), code: 0, sec: metrics.devColdSec, timedOut: false });

	const browsers = record(
		commands,
		'pnpm',
		['exec', 'playwright', 'install', 'chromium'],
		await runGroup('pnpm', ['exec', 'playwright', 'install', 'chromium'], { cwd: dir, timeoutMs: 600_000 })
	);
	if (failed(errors, 'playwright install', browsers)) {
		metrics.hmrSec = null;
		server.stop();
		return;
	}

	const form = join(dir, 'src/lib/features/login/components/form.svelte');
	const original = await readFile(form, 'utf8');
	try {
		const chromium = await loadChromium(dir);
		const browser = await chromium.launch();
		const page = await browser.newPage();
		await page.goto(url);
		await page.getByText('Login', { exact: true }).first().waitFor();
		const started = performance.now();
		await writeFile(form, original.replace('>Login</Card.Title>', '>LoginBench</Card.Title>'));
		await page.getByText('LoginBench', { exact: true }).waitFor({ timeout: 20_000 });
		metrics.hmrSec = Number(((performance.now() - started) / 1000).toFixed(3));
		work.hmrSawEdit = true;
		await browser.close();
	} catch (err) {
		metrics.hmrSec = null;
		work.hmrSawEdit = false;
		errors.push(`hmr: ${err instanceof Error ? err.message : String(err)}`);
	} finally {
		await writeFile(form, original);
		server.stop();
	}
}

async function loadChromium(dir) {
	const candidates = ['node_modules/playwright/index.mjs', 'node_modules/playwright/index.js'];
	let last;
	for (const rel of candidates) {
		try {
			const mod = await import(pathToFileURL(join(dir, rel)).href);
			return mod.chromium;
		} catch (err) {
			last = err;
		}
	}
	throw last;
}

async function measureScripts(cell, dir, metrics, errors, commands) {
	const steps = [
		['vitestSec', 'test:unit'],
		['svelteCheckSec', 'check']
	];
	for (const [key, script] of steps) {
		const [cmd, args] = toolArgs(cell, script);
		const result = record(commands, cmd, args, await runGroup(cmd, args, { cwd: dir, timeoutMs: 600_000 }));
		metrics[key] = result.code === 0 ? Number(result.sec.toFixed(3)) : null;
		failed(errors, script, result);
	}
	const check = record(
		commands,
		'bash',
		['scripts/check.sh'],
		await runGroup('bash', ['scripts/check.sh'], { cwd: dir, timeoutMs: 600_000 })
	);
	metrics.checkShSec = check.code === 0 ? Number(check.sec.toFixed(3)) : null;
	failed(errors, 'scripts/check.sh', check);
	const e2e = record(
		commands,
		'pnpm',
		['run', 'test:e2e'],
		await runGroup('pnpm', ['run', 'test:e2e'], { cwd: dir, timeoutMs: 20 * 60 * 1000 })
	);
	metrics.e2eSec = e2e.code === 0 ? Number(e2e.sec.toFixed(3)) : null;
	failed(errors, 'test:e2e', e2e);
}

async function measureLockfile(cell, dir, metrics, errors, commands) {
	const lockPath = cell.install === 'pnpm' ? join(dir, 'pnpm-lock.yaml') : join(dir, 'bun.lock');
	const baseline = await hashFile(lockPath);
	const hashes = [];
	for (let i = 0; i < 5; i += 1) {
		const result = record(
			commands,
			cell.install,
			['install', 'lock-repeat', String(i + 1)],
			await install(cell, dir, 'frozen')
		);
		if (failed(errors, `lockfile repeat ${i + 1}`, result)) break;
		hashes.push(await hashFile(lockPath));
	}
	metrics.lockfileHashes = hashes;
	metrics.lockfileStable = hashes.length === 5 && hashes.every((hash) => hash === baseline && hash !== null);
	if (!metrics.lockfileStable) {
		errors.push('lockfile changed across repeated frozen installs, or a repeat failed');
	}
}

async function measureDocker(cell, dir, versions, benchDir, metrics, errors, commands) {
	const cold = await buildImage(cell, dir, versions, benchDir, true);
	record(commands, 'docker', ['build', '--no-cache', cold.tag], cold.result);
	metrics.dockerColdSec = cold.result.code === 0 ? Number(cold.result.sec.toFixed(3)) : null;
	failed(errors, 'docker build --no-cache', cold.result);
	const cached = await buildImage(cell, dir, versions, benchDir, false);
	record(commands, 'docker', ['build', cached.tag], cached.result);
	metrics.dockerCachedSec = cached.result.code === 0 ? Number(cached.result.sec.toFixed(3)) : null;
	metrics.imageBytes = cached.imageBytes;
	failed(errors, 'docker build cached', cached.result);
	if (cached.result.code === 0) {
		const id = record(
			commands,
			'docker',
			['run', '--rm', '--entrypoint', 'id', cached.tag, '-u'],
			await runGroup('docker', ['run', '--rm', '--entrypoint', 'id', cached.tag, '-u'])
		);
		metrics.imageUid = id.stdout.trim();
		metrics.imageRunsAsNonRoot = id.code === 0 && id.stdout.trim() !== '0';
		if (!metrics.imageRunsAsNonRoot) errors.push(`image user is "${metrics.imageUid || 'unknown'}", expected non-root`);
	}
}
