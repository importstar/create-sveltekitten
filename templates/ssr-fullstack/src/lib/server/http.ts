import { ApiError } from '#lib/utils/api-core.js';

/**
 * Turns a thrown error into a JSON error response. Errors that know their HTTP status
 * (`ApiError` and its subclasses) keep it; anything else is a 500 with `fallback`.
 */
export function toErrorResponse(err: unknown, fallback: string): Response {
	if (err instanceof ApiError) {
		return Response.json({ error: err.message }, { status: err.status });
	}
	return Response.json({ error: fallback }, { status: 500 });
}
