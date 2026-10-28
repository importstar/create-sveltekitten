import { json, type RequestHandler } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { logger } from '$lib/logger';
import type { HealthStatus } from '$lib/features/health/contract';

export const GET: RequestHandler = () => {
	try {
		db.get(sql`select 1`);
		return json({ status: 'ok' } satisfies HealthStatus);
	} catch (err) {
		logger.error({ err }, '[Health] database unreachable');
		return json({ error: 'Database unavailable' }, { status: 503 });
	}
};
