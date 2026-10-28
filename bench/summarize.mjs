import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { iqrSeparatesRelativeGap, medianAndIqr } from './lib/stats.mjs';

const decision = process.argv.includes('--decision');
const root = process.argv.filter((arg) => !arg.startsWith('--') && arg !== process.argv[0] && arg !== process.argv[1]).at(-1);
if (!root) {
	console.error('Usage: node bench/summarize.mjs [--decision] <bench/out>');
	process.exit(2);
}

async function walk(dir) {
	const found = [];
	let entries;
	try {
		entries = await readdir(dir, { withFileTypes: true });
	} catch {
		return found;
	}
	for (const entry of entries) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) found.push(...(await walk(path)));
		else if (entry.name === 'result.json') found.push(JSON.parse(await readFile(path, 'utf8')));
	}
	return found;
}

const rows = (await walk(root)).filter((row) => row.cell);
const groups = new Map();
for (const row of rows) {
	const list = groups.get(row.cell) ?? [];
	list.push(row);
	groups.set(row.cell, list);
}

const report = [];
let blocked = false;
for (const [cell, list] of groups) {
	const ineligible = list.filter((row) => row.smoke || !row.host?.eligible);
	if (decision && ineligible.length > 0) {
		blocked = true;
		report.push({ cell, blocked: true, reason: 'smoke or WSL2 result in this cell' });
		continue;
	}
	const usable = decision ? list.filter((row) => !row.smoke && row.host?.eligible) : list.filter((row) => !row.smoke);
	const numbers = (keyPath) =>
		usable.map((row) => {
			const value = keyPath.split('.').reduce((current, key) => current?.[key], row.metrics);
			return typeof value === 'number' ? value : null;
		});
	const keys = new Set();
	for (const row of usable) collectNumbers(row.metrics, '', keys);
	const stats = {};
	for (const key of keys) {
		const values = numbers(key).filter((value) => value !== null);
		if (values.length === 0) continue;
		stats[key] = medianAndIqr(values);
	}
	const p95 = stats['lat80.p95'];
	report.push({
		cell,
		rounds: usable.length,
		separates20: p95 ? iqrSeparatesRelativeGap(p95, 0.2) : null,
		stats
	});
}

const out = { decision, blocked, cells: report };
const dest = join(root, 'summary.json');
await writeFile(dest, JSON.stringify(out, null, 2) + '\n');
console.log(dest);
if (decision && blocked) process.exit(2);

function collectNumbers(value, prefix, keys) {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return;
	for (const [key, child] of Object.entries(value)) {
		const path = prefix ? `${prefix}.${key}` : key;
		if (typeof child === 'number') keys.add(path);
		else collectNumbers(child, path, keys);
	}
}
