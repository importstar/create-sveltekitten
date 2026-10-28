import { quantile } from './stats.mjs';

// k6 `--out json` writes one point per line. Drop the warmup window, then score what is left.
export function summarizeK6(jsonl, warmupMs) {
	const points = [];
	for (const line of jsonl.split('\n')) {
		if (!line) continue;
		try {
			points.push(JSON.parse(line));
		} catch {
			// a torn last line when the container is killed
		}
	}
	let first = Infinity;
	for (const row of points) {
		const t = Date.parse(row.data?.time);
		if (Number.isFinite(t) && t < first) first = t;
	}
	if (!Number.isFinite(first)) {
		return { requests: 0, errors: 0, errorRate: null, p50: null, p95: null, p99: null, workOk: 0, achievedRps: 0, byScenario: {} };
	}
	const start = first + warmupMs;
	const durations = [];
	const byScenario = new Map();
	let requests = 0;
	let errors = 0;
	let workOk = 0;
	let last = start;
	for (const row of points) {
		const t = Date.parse(row.data?.time);
		if (!Number.isFinite(t) || t < start) continue;
		if (t > last) last = t;
		const scenario = row.data?.tags?.scenario || 'default';
		if (!byScenario.has(scenario)) byScenario.set(scenario, []);
		if (row.metric === 'http_reqs') requests += 1;
		if (row.metric === 'http_req_failed' && row.data.value > 0) errors += 1;
		if (row.metric === 'http_req_duration') {
			durations.push(row.data.value);
			byScenario.get(scenario).push(row.data.value);
		}
		if (row.metric === 'bench_work_ok') workOk += row.data.value;
	}
	durations.sort((a, b) => a - b);
	const windowSec = Math.max((last - start) / 1000, 0);
	const perScenario = {};
	for (const [name, values] of byScenario) {
		values.sort((a, b) => a - b);
		perScenario[name] = {
			n: values.length,
			p50: values.length ? quantile(values, 0.5) : null,
			p95: values.length ? quantile(values, 0.95) : null,
			p99: values.length ? quantile(values, 0.99) : null
		};
	}
	return {
		requests,
		errors,
		errorRate: requests === 0 ? null : errors / requests,
		p50: durations.length ? quantile(durations, 0.5) : null,
		p95: durations.length ? quantile(durations, 0.95) : null,
		p99: durations.length ? quantile(durations, 0.99) : null,
		workOk,
		achievedRps: windowSec === 0 ? 0 : requests / windowSec,
		windowSec,
		byScenario: perScenario
	};
}

export function phaseValid(summary) {
	return summary.requests > 0 && summary.workOk === summary.requests && summary.errors === 0;
}
