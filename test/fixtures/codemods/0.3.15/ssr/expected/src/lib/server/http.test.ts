import { describe, expect, it } from 'vitest';
import { ApiError } from '$lib/utils/api-core';
import { toErrorResponse } from './http';

describe('toErrorResponse', () => {
	it('keeps the status and message of an ApiError', async () => {
		const res = toErrorResponse(new ApiError('Item not found', 404, null), 'Failed');
		expect(res.status).toBe(404);
		expect(await res.json()).toEqual({ error: 'Item not found' });
	});

	it('hides unknown errors behind a 500 with the fallback message', async () => {
		const res = toErrorResponse(new Error('SQLITE_BUSY: database is locked'), 'Failed to update item');
		expect(res.status).toBe(500);
		expect(await res.json()).toEqual({ error: 'Failed to update item' });
	});
});
