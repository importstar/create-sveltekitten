import type { HealthStatus } from '$lib/features/health/contract';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => {
	const res = await fetch('/api/health');
	return { health: res.ok ? ((await res.json()) as HealthStatus) : null };
};
