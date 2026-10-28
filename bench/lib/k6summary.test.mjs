import assert from 'node:assert/strict';
import test from 'node:test';
import { phaseValid, summarizeK6 } from './k6summary.mjs';

function point(metric, time, value, scenario) {
	return JSON.stringify({
		metric,
		type: 'Point',
		data: { time, value, tags: scenario ? { scenario } : {} }
	});
}

test('drops the warmup window and keeps the later requests', () => {
	const lines = [
		point('http_reqs', '2026-01-01T00:00:00.000Z', 1),
		point('http_req_duration', '2026-01-01T00:00:00.000Z', 999),
		point('http_req_failed', '2026-01-01T00:00:00.000Z', 1),
		point('http_reqs', '2026-01-01T00:00:31.000Z', 1, 'home'),
		point('http_req_duration', '2026-01-01T00:00:31.000Z', 10, 'home'),
		point('http_req_failed', '2026-01-01T00:00:31.000Z', 0, 'home'),
		point('bench_work_ok', '2026-01-01T00:00:31.000Z', 1, 'home'),
		point('http_reqs', '2026-01-01T00:00:32.000Z', 1, 'home'),
		point('http_req_duration', '2026-01-01T00:00:32.000Z', 30, 'home'),
		point('http_req_failed', '2026-01-01T00:00:32.000Z', 0, 'home'),
		point('bench_work_ok', '2026-01-01T00:00:32.000Z', 1, 'home')
	];
	const summary = summarizeK6(lines.join('\n'), 30_000);
	assert.equal(summary.requests, 2);
	assert.equal(summary.errors, 0);
	assert.equal(summary.p50, 20);
	assert.equal(summary.workOk, 2);
	assert.equal(phaseValid(summary), true);
	assert.equal(summary.byScenario.home.n, 2);
});
