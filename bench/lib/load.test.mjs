import assert from 'node:assert/strict';
import test from 'node:test';
import { pickSharedLoad } from './load.mjs';

test('WSL2 saturation does not set the shared load', () => {
	const picked = pickSharedLoad([
		{ smoke: false, host: { eligible: false }, metrics: { saturationRps: 100 } },
		{ smoke: true, host: { eligible: true }, metrics: { saturationRps: 80 } }
	]);
	assert.deepEqual(picked, { missing: true });
});

test('eligible rounds set the shared load from their median', () => {
	const picked = pickSharedLoad([
		{ smoke: false, host: { eligible: true }, metrics: { saturationRps: 100 } },
		{ smoke: false, host: { eligible: true }, metrics: { saturationRps: 120 } },
		{ smoke: false, host: { eligible: false }, metrics: { saturationRps: 10 } }
	]);
	assert.equal(picked.eligible, true);
	assert.equal(picked.rps, 110);
});
