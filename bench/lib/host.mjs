import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';

export function isWsl(versionText) {
	return /microsoft|WSL/i.test(versionText);
}

// Issue 23 says the decision numbers come from a Linux VM or a bare machine, not WSL2.
export function hostFacts() {
	const uname = execFileSync('uname', ['-a'], { encoding: 'utf8' }).trim();
	let version = '';
	try {
		version = readFileSync('/proc/version', 'utf8');
	} catch {
		version = uname;
	}
	const wsl = isWsl(version);
	const memKb = Math.round(os.totalmem() / 1024);
	const load = os.loadavg().map((n) => Number(n.toFixed(2)));
	return {
		uname,
		nproc: os.cpus().length,
		memTotalKb: memKb,
		loadavg: load,
		wsl,
		eligible: !wsl,
		reason: wsl
			? 'This host is WSL2. Issue 23 does not accept decision numbers from WSL2.'
			: 'Linux host, not WSL2.'
	};
}

export function readVersions(envText) {
	const versions = {};
	for (const line of envText.split('\n')) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) continue;
		const eq = trimmed.indexOf('=');
		if (eq === -1) continue;
		versions[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
	}
	return versions;
}
