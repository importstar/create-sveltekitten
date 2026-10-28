import { spawn } from 'node:child_process';

const OUTPUT_CAP = 200_000;

function cap(text) {
	if (text.length <= OUTPUT_CAP) return text;
	return `… truncated ${text.length - OUTPUT_CAP} bytes\n` + text.slice(-OUTPUT_CAP);
}

export function runGroup(cmd, args, opts = {}) {
	const { cwd, env, timeoutMs = 0, input } = opts;
	return new Promise((resolve) => {
		const started = performance.now();
		const child = spawn(cmd, args, {
			cwd,
			env: env ? { ...process.env, ...env } : process.env,
			stdio: ['pipe', 'pipe', 'pipe'],
			detached: true
		});
		let stdout = '';
		let stderr = '';
		let timedOut = false;
		child.stdout.on('data', (chunk) => {
			stdout += chunk;
		});
		child.stderr.on('data', (chunk) => {
			stderr += chunk;
		});
		if (input !== undefined) child.stdin.end(input);
		else child.stdin.end();
		const timer =
			timeoutMs > 0
				? setTimeout(() => {
						timedOut = true;
						killGroup(child.pid);
					}, timeoutMs)
				: undefined;
		child.on('close', (code, signal) => {
			if (timer) clearTimeout(timer);
			resolve({
				code: code ?? 1,
				signal,
				timedOut,
				stdout: cap(stdout),
				stderr: cap(stderr),
				sec: (performance.now() - started) / 1000
			});
		});
		child.on('error', (err) => {
			if (timer) clearTimeout(timer);
			resolve({
				code: 127,
				signal: null,
				timedOut: false,
				stdout: '',
				stderr: cap(String(err)),
				sec: (performance.now() - started) / 1000
			});
		});
	});
}

export function killGroup(pid) {
	if (!pid) return;
	try {
		process.kill(-pid, 'SIGKILL');
	} catch {
		try {
			process.kill(pid, 'SIGKILL');
		} catch {
			void 0;
		}
	}
}

export function start(cmd, args, opts = {}) {
	const { cwd, env } = opts;
	const child = spawn(cmd, args, {
		cwd,
		env: env ? { ...process.env, ...env } : process.env,
		stdio: ['ignore', 'pipe', 'pipe'],
		detached: true
	});
	let stdout = '';
	let stderr = '';
	child.stdout.on('data', (chunk) => {
		stdout += chunk;
	});
	child.stderr.on('data', (chunk) => {
		stderr += chunk;
	});
	const exited = new Promise((resolve) => {
		child.on('close', (code, signal) => {
			resolve({
				code: code ?? 1,
				signal,
				stdout: cap(stdout),
				stderr: cap(stderr),
				timedOut: false
			});
		});
		child.on('error', (err) => {
			resolve({ code: 127, signal: null, stdout: '', stderr: cap(String(err)), timedOut: false });
		});
	});
	return {
		pid: child.pid,
		exited,
		output: () => cap(`${stdout}\n${stderr}`),
		stop() {
			killGroup(child.pid);
		}
	};
}
