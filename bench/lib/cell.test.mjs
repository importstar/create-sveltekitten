import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCell } from './cell.mjs';

test('parses the toolchain cell from the issue', () => {
	const cell = parseCell('T1-ssr-fullstack');
	assert.equal(cell.axis, 'A');
	assert.equal(cell.install, 'pnpm');
	assert.equal(cell.run, 'node');
	assert.equal(cell.template, 'ssr-fullstack');
});

test('parses bun install with node tools, and bun tools', () => {
	assert.deepEqual(
		{ install: parseCell('T2-spa').install, run: parseCell('T2-spa').run },
		{ install: 'bun', run: 'node' }
	);
	assert.equal(parseCell('T3-ssr-fastapi').run, 'bun');
});

test('parses the runtime cell from the issue', () => {
	const cell = parseCell('R1-S7-1cpu');
	assert.equal(cell.axis, 'B');
	assert.equal(cell.binary, 'node');
	assert.equal(cell.adapter, 'adapter-node');
	assert.equal(cell.otel, 'shipping');
	assert.deepEqual(cell.resources, { name: '1cpu', cpus: 1, memory: '512m' });
	assert.deepEqual(cell.apps, ['ssr-fullstack', 'ssr-fastapi']);
	assert.equal(cell.codeChange, false);
	assert.equal(cell.communityAdapter, false);
});

test('parses the larger machine and tracing-off suffix', () => {
	const cell = parseCell('R2-S4-2cpu-otel-off');
	assert.equal(cell.otel, 'off');
	assert.deepEqual(cell.resources, { name: '2cpu', cpus: 2, memory: '1g' });
	assert.equal(cell.scenario, 'S4');
	assert.deepEqual(cell.apps, ['ssr-fullstack']);
});

test('rejects R4 on the FastAPI-only scenario', () => {
	assert.throws(() => parseCell('R4-S5-1cpu'), /R4 only applies/);
});

test('rejects a cell id the runner does not know', () => {
	assert.throws(() => parseCell('T1-S7-1cpu'), /Unknown cell/);
	assert.throws(() => parseCell(''), /empty/);
});
