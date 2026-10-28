import { medianAndIqr } from './stats.mjs';

// An ineligible host cannot set the load that every other runtime is measured at.
export function pickSharedLoad(rows) {
	const eligible = rows.filter(
		(row) => !row.smoke && row.host?.eligible === true && typeof row.metrics?.saturationRps === 'number'
	);
	if (eligible.length === 0) return { missing: true };
	return { rps: medianAndIqr(eligible.map((row) => row.metrics.saturationRps)).median, eligible: true };
}
