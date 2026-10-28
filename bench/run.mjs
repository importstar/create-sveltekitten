import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runAxisA } from './axis-a.mjs';
import { runAxisB } from './axis-b.mjs';
import { parseCell } from './lib/cell.mjs';
import { hostFacts, readVersions } from './lib/host.mjs';

const benchDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(benchDir, '..');
const cellId = process.argv[2];

if (!cellId) {
	console.error('Usage: bench/run.sh <cell-id>');
	process.exit(2);
}

let cell;
try {
	cell = parseCell(cellId);
} catch (err) {
	console.error(err instanceof Error ? err.message : String(err));
	process.exit(2);
}

const smoke = process.env.BENCH_SMOKE === '1';
const versions = readVersions(await readFile(join(benchDir, 'versions.env'), 'utf8'));
const host = hostFacts();
const startedAt = new Date().toISOString();
const stamp = startedAt.replaceAll(':', '').replaceAll('.', '');
const outDir = join(benchDir, 'out', cell.id, stamp);
await mkdir(outDir, { recursive: true });

const args = { cell, smoke, versions, benchDir, repoRoot, outDir, host };
let outcome;
try {
	outcome = cell.axis === 'A' ? await runAxisA(args) : await runAxisB(args);
} catch (err) {
	outcome = {
		metrics: {},
		work: {},
		commands: [],
		errors: [err instanceof Error ? err.stack ?? err.message : String(err)]
	};
}

const payload = {
	cell: cell.id,
	axis: cell.axis,
	smoke,
	startedAt,
	finishedAt: new Date().toISOString(),
	host,
	versions,
	spec: cell,
	metrics: outcome.metrics,
	work: outcome.work,
	errors: outcome.errors,
	commands: outcome.commands
};
const outPath = join(outDir, 'result.json');
await writeFile(outPath, JSON.stringify(payload, null, 2) + '\n');
console.log(outPath);
process.exit(outcome.errors.length > 0 ? 1 : 0);
