import type { RequestHandler } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';
import { db } from '#lib/server/db/index.js';
import { logger } from '#lib/logger.js';
import type { HealthStatus } from '#lib/features/health/contract.js';

export const GET: RequestHandler = () => {
	try {
		db.get(sql`select 1`);
		return Response.json({ status: 'ok' } satisfies HealthStatus);
	} catch (err) {
		logger.error({ err }, '[Health] database unreachable');
		return Response.json({ error: 'Database unavailable' }, { status: 503 });
	}
};
