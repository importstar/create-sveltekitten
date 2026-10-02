function applyReplacements(replacements) {
    return (content) => replacements.reduce((next, [from, to]) => next.includes(from) && !next.includes(to) ? next.replace(from, to) : next, content);
}
function createIfMissing(file) {
    return (content) => (content.trim() === '' ? file : content);
}
const HTTP_FILE = `import { json } from '@sveltejs/kit';
import { ApiError } from '$lib/utils/api-core';

/**
 * Turns a thrown error into a JSON error response. Errors that know their HTTP status
 * (\`ApiError\` and its subclasses) keep it; anything else is a 500 with \`fallback\`.
 */
export function toErrorResponse(err: unknown, fallback: string): Response {
	if (err instanceof ApiError) {
		return json({ error: err.message }, { status: err.status });
	}
	return json({ error: fallback }, { status: 500 });
}
`;
const HTTP_TEST_FILE = `import { describe, expect, it } from 'vitest';
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
`;
const SERVICE_REPLACEMENTS = [
    [
        `import type { DbItem } from '$lib/server/db/schema';
`,
        `import type { DbItem } from '$lib/server/db/schema';
import { ApiError } from '$lib/utils/api-core';
`
    ],
    [
        `export class ItemNotFoundError extends Error {}
export class ItemForbiddenError extends Error {}
`,
        `// Each error carries its HTTP status, so routes map any of them with toErrorResponse()
// and a new error needs no change in the handlers.
export class ItemNotFoundError extends ApiError {
	constructor() {
		super('Item not found', 404, null);
	}
}

export class ItemForbiddenError extends ApiError {
	constructor() {
		super('Forbidden', 403, null);
	}
}
`
    ]
];
const ROUTE_REPLACEMENTS = [
    [
        `import { ItemForbiddenError, ItemNotFoundError } from '$lib/features/items/service';
import { itemsService } from '$lib/server/services';
`,
        `import { itemsService } from '$lib/server/services';
import { toErrorResponse } from '$lib/server/http';
`
    ],
    [
        `	} catch {
		return json({ error: 'Failed to create item' }, { status: 500 });
	}`,
        `	} catch (err) {
		return toErrorResponse(err, 'Failed to create item');
	}`
    ],
    [
        `	} catch (err) {
		if (err instanceof ItemNotFoundError) return json({ error: 'Item not found' }, { status: 404 });
		if (err instanceof ItemForbiddenError) return json({ error: 'Forbidden' }, { status: 403 });
		return json({ error: 'Failed to update item' }, { status: 500 });
	}`,
        `	} catch (err) {
		return toErrorResponse(err, 'Failed to update item');
	}`
    ],
    [
        `	} catch (err) {
		if (err instanceof ItemNotFoundError) return json({ error: 'Item not found' }, { status: 404 });
		if (err instanceof ItemForbiddenError) return json({ error: 'Forbidden' }, { status: 403 });
		return json({ error: 'Failed to delete item' }, { status: 500 });
	}`,
        `	} catch (err) {
		return toErrorResponse(err, 'Failed to delete item');
	}`
    ]
];
const AGENT_ROLE_REPLACEMENTS = [
    [
        `Routes import \`itemsService\` from there; tests build a service over an in-memory repository, so the rules are testable without SQLite.
`,
        `Routes import \`itemsService\` from there; tests build a service over an in-memory repository, so the rules are testable without SQLite.
- Service errors extend \`ApiError\` (\`$lib/utils/api-core.ts\`) and carry their HTTP status (e.g. \`ItemNotFoundError\` → 404). Route handlers end with \`catch (err) { return toErrorResponse(err, 'Failed to …'); }\` from \`$lib/server/http.ts\`, so adding an error never means editing every handler.
`
    ]
];
const codemod = {
    from: '0.3.14',
    to: '0.3.15',
    transforms: [
        {
            // Each handler in /api/items repeated an instanceof chain mapping service
            // errors to HTTP statuses, so a new error meant editing every handler (and a
            // forgotten one became a 500). The errors now extend the existing ApiError
            // and carry their status; handlers end with toErrorResponse(err, fallback).
            file: 'src/lib/server/http.ts',
            template: 'ssr',
            create: true,
            transform: createIfMissing(HTTP_FILE)
        },
        {
            file: 'src/lib/server/http.test.ts',
            template: 'ssr',
            create: true,
            transform: createIfMissing(HTTP_TEST_FILE)
        },
        {
            file: 'src/lib/features/items/service.ts',
            template: 'ssr',
            transform: applyReplacements(SERVICE_REPLACEMENTS)
        },
        {
            file: 'src/routes/api/items/+server.ts',
            template: 'ssr',
            transform: applyReplacements(ROUTE_REPLACEMENTS)
        },
        {
            file: 'agent-role.md',
            template: 'ssr',
            transform: applyReplacements(AGENT_ROLE_REPLACEMENTS)
        }
    ]
};
export default codemod;
