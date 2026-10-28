import assert from 'node:assert/strict';
import test from 'node:test';
import { iqrSeparatesRelativeGap, medianAndIqr } from './stats.mjs';

test('median of five rounds is the middle value', () => {
	const summary = medianAndIqr([10, 30, 20, 40, 50]);
	assert.equal(summary.n, 5);
	assert.equal(summary.median, 30);
	assert.equal(summary.q1, 20);
	assert.equal(summary.q3, 40);
	assert.equal(summary.iqr, 20);
});

test('a wide p95 spread does not separate a 20% gap', () => {
	const wide = medianAndIqr([100, 100, 100, 140, 180]);
	assert.equal(iqrSeparatesRelativeGap(wide, 0.2), false);
	const narrow = medianAndIqr([100, 101, 102, 103, 104]);
	assert.equal(iqrSeparatesRelativeGap(narrow, 0.2), true);
});
