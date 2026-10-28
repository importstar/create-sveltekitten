export function quantile(sorted, p) {
	if (!Array.isArray(sorted) || sorted.length === 0) {
		throw new Error('quantile needs at least one number');
	}
	if (sorted.length === 1) return sorted[0];
	const idx = (sorted.length - 1) * p;
	const lo = Math.floor(idx);
	const hi = Math.ceil(idx);
	if (lo === hi) return sorted[lo];
	const weight = idx - lo;
	return sorted[lo] * (1 - weight) + sorted[hi] * weight;
}

export function medianAndIqr(values) {
	const nums = values.filter((n) => typeof n === 'number' && Number.isFinite(n)).slice().sort((a, b) => a - b);
	if (nums.length === 0) return { n: 0, median: null, q1: null, q3: null, iqr: null };
	const q1 = quantile(nums, 0.25);
	const median = quantile(nums, 0.5);
	const q3 = quantile(nums, 0.75);
	return { n: nums.length, median, q1, q3, iqr: q3 - q1 };
}

export function iqrSeparatesRelativeGap(summary, gap) {
	if (summary.median === null || summary.median === 0 || summary.iqr === null) {
		return false;
	}
	return summary.iqr / Math.abs(summary.median) < gap;
}
