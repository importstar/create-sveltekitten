// Generated from the templates at 1.1.4 (origin/main) and 2.0.0 by a one-off script; do not edit by hand.
// Each entry takes a template file from its 1.1.4 content to its 2.0.0 content with guarded text
// hunks (see replaceTexts): imports move from $lib to #lib with extensions, hook types to
// @sveltejs/kit/hooks, $env/* and $app/environment to $app/env, resolve() paths lose their leading
// slash, docs follow. Each hunk is unique in the 1.1.4 file. package.json, vite.config.ts,
// svelte.config.js and src/env.ts are handled in v2.0.0.ts.

import type { FileTransform } from './index.js';
import { replaceTexts } from './helpers.js';

type Hunk = readonly [from: string, to: string];
type Scope = Pick<FileTransform, 'template' | 'ssrMode'>;

const HUNKS: ReadonlyArray<readonly [file: string, scope: Scope, hunks: readonly Hunk[]]> = [
	[
		"AGENTS.md",
		{"template": "ssr", "ssrMode": "fullstack"},
		[
			["- **Business rules** live in `src/lib/features/<name>/service.ts`; routes call services from `$lib/server/services`, never the Drizzle repository (`server.ts`) directly.\n", "- **Business rules** live in `src/lib/features/<name>/service.ts`; routes call services from `#lib/server/services.js`, never the Drizzle repository (`server.ts`) directly.\n"],
			["- Logger: `import { logger } from '$lib/logger'` — use instead of `console.log`.\n", "- Logger: `import { logger } from '#lib/logger.js'` — use instead of `console.log`.\n- **Running `node build`**: adapter-node assumes `https` and does not read `ORIGIN`. Over plain http, or behind a proxy, set `PROTOCOL_HEADER` / `HOST_HEADER` (e.g. `x-forwarded-proto`) or `paths: { origin }` in `sveltekit({ ... })`, or form posts fail the CSRF check with 403.\n"],
		]
	],
	[
		"AGENTS.md",
		{"template": "ssr", "ssrMode": "fastapi"},
		[
			["- **API calls**: through `event.locals.fastapiClient` (server) or the `fastapiClient` default export of `$lib/api/fastapi-client` (browser). Both go through `/api/proxy/**`, which adds `Authorization: Bearer` from the `access_token` cookie and refreshes it once on a 401.\n", "- **API calls**: through `event.locals.fastapiClient` (server) or the `fastapiClient` default export of `#lib/api/fastapi-client.js` (browser). Both go through `/api/proxy/**`, which adds `Authorization: Bearer` from the `access_token` cookie and refreshes it once on a 401.\n"],
			["- Logger: `import { logger } from '$lib/logger'` — use instead of `console.log`.\n", "- Logger: `import { logger } from '#lib/logger.js'` — use instead of `console.log`.\n- **Running `node build`**: adapter-node assumes `https` and does not read `ORIGIN`. Over plain http, or behind a proxy, set `PROTOCOL_HEADER` / `HOST_HEADER` (e.g. `x-forwarded-proto`) or `paths: { origin }` in `sveltekit({ ... })`, or form posts fail the CSRF check with 403.\n"],
		]
	],
	[
		"agent-role.md",
		{"template": "ssr", "ssrMode": "fullstack"},
		[
			["- **SvelteKit v2** + **Svelte 5** (runes mode) + **Vite 8**, deployed via `@sveltejs/adapter-node`\n", "- **SvelteKit v3** + **Svelte 5** (runes mode) + **Vite 8**, deployed via `@sveltejs/adapter-node`\n"],
			["- Perform database operations in `$lib/server/db/` using Drizzle ORM\n", "- Perform database operations in `src/lib/server/db/` using Drizzle ORM\n"],
			["- Service errors extend `ApiError` (`$lib/utils/api-core.ts`) and carry their HTTP status (e.g. `ItemNotFoundError` → 404). Route handlers end with `catch (err) { return toErrorResponse(err, 'Failed to …'); }` from `$lib/server/http.ts`, so adding an error never means editing every handler.\n", "- Service errors extend `ApiError` (`src/lib/utils/api-core.ts`) and carry their HTTP status (e.g. `ItemNotFoundError` → 404). Route handlers end with `catch (err) { return toErrorResponse(err, 'Failed to …'); }` from `#lib/server/http.js`, so adding an error never means editing every handler.\n"],
			["- **Svelte 5 runes only** — no legacy Svelte 4 syntax.\n", "- **Svelte 5 runes only** — no legacy Svelte 4 syntax.\n- **Imports from `src/lib` use `#lib` with the file extension** — e.g. `import { logger } from '#lib/logger.js'`, `#lib/components/ui/button/index.js`. SvelteKit 3 resolves `#lib` through the `imports` field in `package.json`. Configuration (adapter, preprocess) is passed to `sveltekit({ ... })` in `vite.config.ts`; there is no `svelte.config.js`. Environment variables are declared in `src/env.ts` and imported from `$app/env/public` / `$app/env/private`.\n"],
			["5. **API / Endpoint**: Create `src/routes/api/your-feature/+server.ts` (calling the service from `$lib/server/services`, never `server.ts` directly) and `src/lib/features/your-feature/api.ts` implementing the `contract.ts` interface.\n", "5. **API / Endpoint**: Create `src/routes/api/your-feature/+server.ts` (calling the service from `#lib/server/services.js`, never `server.ts` directly) and `src/lib/features/your-feature/api.ts` implementing the `contract.ts` interface.\n"],
			["7. **Components**: Build UI in `src/lib/features/your-feature/components/` using primitives from `$lib/components/ui/` and `toast` from `svelte-sonner`.\n8. **Route**: Create `src/routes/(protected)/your-feature/+page.svelte` (and `+page.server.ts` for server prefetching — load through the service from `$lib/server/services`, never `server.ts`).\n", "7. **Components**: Build UI in `src/lib/features/your-feature/components/` using primitives from `src/lib/components/ui/` and `toast` from `svelte-sonner`.\n8. **Route**: Create `src/routes/(protected)/your-feature/+page.svelte` (and `+page.server.ts` for server prefetching — load through the service from `#lib/server/services.js`, never `server.ts`).\n"],
		]
	],
	[
		"agent-role.md",
		{"template": "ssr", "ssrMode": "fastapi"},
		[
			["- **SvelteKit v2** + **Svelte 5** (runes mode) + **Vite 8**, deployed via `@sveltejs/adapter-node`\n", "- **SvelteKit v3** + **Svelte 5** (runes mode) + **Vite 8**, deployed via `@sveltejs/adapter-node`\n"],
			["- Server code (`+page.server.ts`, form actions) calls `event.locals.fastapiClient`; browser code calls the `fastapiClient` default export of `$lib/api/fastapi-client`. Both send requests to `/api/proxy/**`.\n", "- Server code (`+page.server.ts`, form actions) calls `event.locals.fastapiClient`; browser code calls the `fastapiClient` default export of `#lib/api/fastapi-client.js`. Both send requests to `/api/proxy/**`.\n"],
			["- **Svelte 5 runes only** — no legacy Svelte 4 syntax.\n", "- **Svelte 5 runes only** — no legacy Svelte 4 syntax.\n- **Imports from `src/lib` use `#lib` with the file extension** — e.g. `import { logger } from '#lib/logger.js'`, `#lib/components/ui/button/index.js`. SvelteKit 3 resolves `#lib` through the `imports` field in `package.json`. Configuration (adapter, preprocess) is passed to `sveltekit({ ... })` in `vite.config.ts`; there is no `svelte.config.js`. Environment variables are declared in `src/env.ts` and imported from `$app/env/public` / `$app/env/private`.\n"],
			["3. **DTO**: Create `dto.ts` mapping `components['schemas'][...]` from `$lib/api/paths/fastapi` to the UI types.\n", "3. **DTO**: Create `dto.ts` mapping `components['schemas'][...]` from `#lib/api/paths/fastapi.js` to the UI types.\n"],
			["7. **Components**: Build UI in `src/lib/features/your-feature/components/` using primitives from `$lib/components/ui/` and `toast` from `svelte-sonner`.\n", "7. **Components**: Build UI in `src/lib/features/your-feature/components/` using primitives from `src/lib/components/ui/` and `toast` from `svelte-sonner`.\n"],
		]
	],
	[
		"agent-role.md",
		{"template": "spa"},
		[
			["- **SvelteKit v2** + **Svelte 5** (runes mode) + **Vite 8**, deployed via `@sveltejs/adapter-static`\n", "- **SvelteKit v3** + **Svelte 5** (runes mode) + **Vite 8**, deployed via `@sveltejs/adapter-static`\n"],
			["- Call backend APIs through the typed `client` from `$lib/api/client.ts` — uses `openapi-fetch` with `PUBLIC_API_URL`\n- Use `fetchWithAuth` from `$lib/api/auth-interceptor.ts` for authenticated requests with automatic token refresh\n- Use `authStore` from `$lib/stores/auth.svelte.ts` for client-side auth state\n", "- Call backend APIs through the typed `client` from `#lib/api/client.js` — uses `openapi-fetch` with `PUBLIC_API_URL`\n- Use `fetchWithAuth` from `#lib/api/auth-interceptor.js` for authenticated requests with automatic token refresh\n- Use `authStore` from `#lib/stores/auth.svelte.js` for client-side auth state\n"],
			["- **Svelte 5 runes only** — no legacy Svelte 4 syntax. See the table below.\n", "- **Svelte 5 runes only** — no legacy Svelte 4 syntax. See the table below.\n- **Imports from `src/lib` use `#lib` with the file extension** — e.g. `import { logger } from '#lib/logger.js'`, `#lib/components/ui/button/index.js`. SvelteKit 3 resolves `#lib` through the `imports` field in `package.json`. Configuration (adapter, preprocess) is passed to `sveltekit({ ... })` in `vite.config.ts`; there is no `svelte.config.js`. Environment variables are declared in `src/env.ts` and imported from `$app/env/public` / `$app/env/private`.\n"],
			["5. **Components**: Build UI in `src/lib/features/your-feature/components/` using primitives from `$lib/components/ui/` and `toast` from `svelte-sonner`.\n", "5. **Components**: Build UI in `src/lib/features/your-feature/components/` using primitives from `src/lib/components/ui/` and `toast` from `svelte-sonner`.\n"],
			["- Modifying the auth interceptor token refresh logic in `$lib/api/auth-interceptor.ts`\n- Changing cookie names or TTLs in `$lib/utils/auth.ts`\n", "- Modifying the auth interceptor token refresh logic in `src/lib/api/auth-interceptor.ts`\n- Changing cookie names or TTLs in `src/lib/utils/auth.ts`\n"],
		]
	],
	[
		"components.json",
		{},
		[
			["\t\t\"components\": \"$lib/components\",\n\t\t\"utils\": \"$lib/utils/shadcn\",\n\t\t\"ui\": \"$lib/components/ui\",\n\t\t\"hooks\": \"$lib/hooks\",\n\t\t\"lib\": \"$lib\"\n", "\t\t\"components\": \"#lib/components\",\n\t\t\"utils\": \"#lib/utils/shadcn\",\n\t\t\"ui\": \"#lib/components/ui\",\n\t\t\"hooks\": \"#lib/hooks\",\n\t\t\"lib\": \"#lib\"\n"],
		]
	],
	[
		"eslint.config.js",
		{},
		[
			["import svelteConfig from './svelte.config.js';\n", ""],
			["\t\t\t\tparser: ts.parser,\n\t\t\t\tsvelteConfig\n", "\t\t\t\tparser: ts.parser\n"],
		]
	],
	[
		"playwright.config.ts",
		{"template": "ssr", "ssrMode": "fullstack"},
		[
			["\t\tbaseURL: 'http://localhost:3000',\n", "\t\tbaseURL: 'http://localhost:3000',\n\t\t// adapter-node assumes https unless PROTOCOL_HEADER names a header (webServer.env below);\n\t\t// over plain http the CSRF check would reject form posts.\n\t\textraHTTPHeaders: { 'x-forwarded-proto': 'http' },\n"],
			["\t\t\tORIGIN: 'http://localhost:3000'\n", "\t\t\tPROTOCOL_HEADER: 'x-forwarded-proto'\n"],
		]
	],
	[
		"playwright.config.ts",
		{"template": "ssr", "ssrMode": "fastapi"},
		[
			["\t\tbaseURL: 'http://localhost:3000',\n", "\t\tbaseURL: 'http://localhost:3000',\n\t\t// adapter-node assumes https unless PROTOCOL_HEADER names a header (webServer.env below);\n\t\t// over plain http the CSRF check would reject form posts.\n\t\textraHTTPHeaders: { 'x-forwarded-proto': 'http' },\n"],
			["\t\t\t\tORIGIN: 'http://localhost:3000'\n", "\t\t\t\tPROTOCOL_HEADER: 'x-forwarded-proto'\n"],
		]
	],
	[
		"src/app.d.ts",
		{"template": "ssr", "ssrMode": "fullstack"},
		[
			["import type { User, Session } from '$lib/server/db/schema';\n", "import type { User, Session } from '#lib/server/db/schema.js';\n"],
		]
	],
	[
		"src/app.d.ts",
		{"template": "ssr", "ssrMode": "fastapi"},
		[
			["import type { paths } from '$lib/api/paths/fastapi';\n", "import type { paths } from '#lib/api/paths/fastapi.js';\n"],
		]
	],
	[
		"src/hooks.server.ts",
		{"template": "ssr", "ssrMode": "fullstack"},
		[
			["import type { Handle } from '@sveltejs/kit';\nimport { handleAuthGuard } from '$lib/hooks/auth-guard';\n", "import type { Handle } from '@sveltejs/kit/hooks';\nimport { handleAuthGuard } from '#lib/hooks/auth-guard.js';\n"],
		]
	],
	[
		"src/hooks.server.ts",
		{"template": "ssr", "ssrMode": "fastapi"},
		[
			["import type { Handle } from '@sveltejs/kit';\nimport { sequence } from '@sveltejs/kit/hooks';\nimport { handleFastApiClient } from '$lib/hooks/fastapi.hook';\nimport { handleAuthGuard } from '$lib/hooks/auth-guard';\n", "import { sequence, type Handle } from '@sveltejs/kit/hooks';\nimport { handleFastApiClient } from '#lib/hooks/fastapi.hook.js';\nimport { handleAuthGuard } from '#lib/hooks/auth-guard.js';\n"],
		]
	],
	[
		"src/lib/api/auth-interceptor.ts",
		{"template": "spa"},
		[
			["import { authStore } from '$lib/stores/auth.svelte';\n", "import { authStore } from '#lib/stores/auth.svelte.js';\n"],
		]
	],
	[
		"src/lib/api/client.ts",
		{"template": "spa"},
		[
			["import { PUBLIC_API_URL } from '$env/static/public';\nimport { authStore } from '$lib/stores/auth.svelte';\n", "import { PUBLIC_API_URL } from '$app/env/public';\nimport { authStore } from '#lib/stores/auth.svelte.js';\n"],
		]
	],
	[
		"src/lib/components/form/form-debug.svelte",
		{},
		[
			["\timport { dev } from '$app/environment';\n", "\timport { dev } from '$app/env';\n"],
		]
	],
	[
		"src/lib/components/ui/breadcrumb/breadcrumb-ellipsis.svelte",
		{},
		[
			["\timport { cn, type WithElementRef, type WithoutChildren } from \"$lib/utils/shadcn.js\";\n", "\timport { cn, type WithElementRef, type WithoutChildren } from \"#lib/utils/shadcn.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/breadcrumb/breadcrumb-item.svelte",
		{},
		[
			["\timport { cn, type WithElementRef } from \"$lib/utils/shadcn.js\";\n", "\timport { cn, type WithElementRef } from \"#lib/utils/shadcn.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/breadcrumb/breadcrumb-link.svelte",
		{},
		[
			["\timport { cn, type WithElementRef } from \"$lib/utils/shadcn.js\";\n", "\timport { cn, type WithElementRef } from \"#lib/utils/shadcn.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/breadcrumb/breadcrumb-list.svelte",
		{},
		[
			["\timport { cn, type WithElementRef } from \"$lib/utils/shadcn.js\";\n", "\timport { cn, type WithElementRef } from \"#lib/utils/shadcn.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/breadcrumb/breadcrumb-page.svelte",
		{},
		[
			["\timport { cn, type WithElementRef } from \"$lib/utils/shadcn.js\";\n", "\timport { cn, type WithElementRef } from \"#lib/utils/shadcn.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/breadcrumb/breadcrumb-separator.svelte",
		{},
		[
			["\timport { cn, type WithElementRef } from \"$lib/utils/shadcn.js\";\n", "\timport { cn, type WithElementRef } from \"#lib/utils/shadcn.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/breadcrumb/breadcrumb.svelte",
		{},
		[
			["\timport type { WithElementRef } from \"$lib/utils/shadcn.js\";\n", "\timport type { WithElementRef } from \"#lib/utils/shadcn.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/button/button.svelte",
		{"template": "ssr"},
		[
			["\timport { cn, type WithElementRef } from '$lib/utils/shadcn.js';\n", "\timport { cn, type WithElementRef } from '#lib/utils/shadcn.js';\n"],
		]
	],
	[
		"src/lib/components/ui/button/button.svelte",
		{"template": "spa"},
		[
			["\timport { cn, type WithElementRef } from \"$lib/utils/shadcn.js\";\n", "\timport { cn, type WithElementRef } from \"#lib/utils/shadcn.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/card/card-action.svelte",
		{},
		[
			["\timport { cn, type WithElementRef } from \"$lib/utils/shadcn.js\";\n", "\timport { cn, type WithElementRef } from \"#lib/utils/shadcn.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/card/card-content.svelte",
		{},
		[
			["\timport { cn, type WithElementRef } from \"$lib/utils/shadcn.js\";\n", "\timport { cn, type WithElementRef } from \"#lib/utils/shadcn.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/card/card-description.svelte",
		{},
		[
			["\timport { cn, type WithElementRef } from \"$lib/utils/shadcn.js\";\n", "\timport { cn, type WithElementRef } from \"#lib/utils/shadcn.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/card/card-footer.svelte",
		{},
		[
			["\timport { cn, type WithElementRef } from \"$lib/utils/shadcn.js\";\n", "\timport { cn, type WithElementRef } from \"#lib/utils/shadcn.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/card/card-header.svelte",
		{},
		[
			["\timport { cn, type WithElementRef } from \"$lib/utils/shadcn.js\";\n", "\timport { cn, type WithElementRef } from \"#lib/utils/shadcn.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/card/card-title.svelte",
		{},
		[
			["\timport { cn, type WithElementRef } from \"$lib/utils/shadcn.js\";\n", "\timport { cn, type WithElementRef } from \"#lib/utils/shadcn.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/card/card.svelte",
		{},
		[
			["\timport { cn, type WithElementRef } from \"$lib/utils/shadcn.js\";\n", "\timport { cn, type WithElementRef } from \"#lib/utils/shadcn.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/checkbox/checkbox.svelte",
		{},
		[
			["\timport { cn, type WithoutChildrenOrChild } from \"$lib/utils/shadcn.js\";\n", "\timport { cn, type WithoutChildrenOrChild } from \"#lib/utils/shadcn.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/dropdown-menu/dropdown-menu-checkbox-item.svelte",
		{},
		[
			["\timport { cn, type WithoutChildrenOrChild } from \"$lib/utils/shadcn.js\";\n", "\timport { cn, type WithoutChildrenOrChild } from \"#lib/utils/shadcn.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/dropdown-menu/dropdown-menu-content.svelte",
		{},
		[
			["\timport { cn } from \"$lib/utils/shadcn.js\";\n", "\timport { cn } from \"#lib/utils/shadcn.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/dropdown-menu/dropdown-menu-group-heading.svelte",
		{},
		[
			["\timport { cn } from \"$lib/utils/shadcn.js\";\n", "\timport { cn } from \"#lib/utils/shadcn.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/dropdown-menu/dropdown-menu-item.svelte",
		{},
		[
			["\timport { cn } from \"$lib/utils/shadcn.js\";\n", "\timport { cn } from \"#lib/utils/shadcn.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/dropdown-menu/dropdown-menu-label.svelte",
		{},
		[
			["\timport { cn, type WithElementRef } from \"$lib/utils/shadcn.js\";\n", "\timport { cn, type WithElementRef } from \"#lib/utils/shadcn.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/dropdown-menu/dropdown-menu-radio-item.svelte",
		{},
		[
			["\timport { cn, type WithoutChild } from \"$lib/utils/shadcn.js\";\n", "\timport { cn, type WithoutChild } from \"#lib/utils/shadcn.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/dropdown-menu/dropdown-menu-separator.svelte",
		{},
		[
			["\timport { cn } from \"$lib/utils/shadcn.js\";\n", "\timport { cn } from \"#lib/utils/shadcn.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/dropdown-menu/dropdown-menu-shortcut.svelte",
		{},
		[
			["\timport { cn, type WithElementRef } from \"$lib/utils/shadcn.js\";\n", "\timport { cn, type WithElementRef } from \"#lib/utils/shadcn.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/dropdown-menu/dropdown-menu-sub-content.svelte",
		{},
		[
			["\timport { cn } from \"$lib/utils/shadcn.js\";\n", "\timport { cn } from \"#lib/utils/shadcn.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/dropdown-menu/dropdown-menu-sub-trigger.svelte",
		{},
		[
			["\timport { cn } from \"$lib/utils/shadcn.js\";\n", "\timport { cn } from \"#lib/utils/shadcn.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/field/field-content.svelte",
		{},
		[
			["\timport { cn, type WithElementRef } from \"$lib/utils/shadcn.js\";\n", "\timport { cn, type WithElementRef } from \"#lib/utils/shadcn.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/field/field-description.svelte",
		{},
		[
			["\timport { cn, type WithElementRef } from \"$lib/utils/shadcn.js\";\n", "\timport { cn, type WithElementRef } from \"#lib/utils/shadcn.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/field/field-error.svelte",
		{},
		[
			["\timport { cn, type WithElementRef } from \"$lib/utils/shadcn.js\";\n", "\timport { cn, type WithElementRef } from \"#lib/utils/shadcn.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/field/field-group.svelte",
		{},
		[
			["\timport { cn, type WithElementRef } from \"$lib/utils/shadcn.js\";\n", "\timport { cn, type WithElementRef } from \"#lib/utils/shadcn.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/field/field-label.svelte",
		{},
		[
			["\timport { Label } from \"$lib/components/ui/label/index.js\";\n\timport { cn } from \"$lib/utils/shadcn.js\";\n", "\timport { Label } from \"#lib/components/ui/label/index.js\";\n\timport { cn } from \"#lib/utils/shadcn.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/field/field-legend.svelte",
		{},
		[
			["\timport { cn, type WithElementRef } from \"$lib/utils/shadcn.js\";\n", "\timport { cn, type WithElementRef } from \"#lib/utils/shadcn.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/field/field-separator.svelte",
		{},
		[
			["\timport { Separator } from \"$lib/components/ui/separator/index.js\";\n\timport { cn, type WithElementRef } from \"$lib/utils/shadcn.js\";\n", "\timport { Separator } from \"#lib/components/ui/separator/index.js\";\n\timport { cn, type WithElementRef } from \"#lib/utils/shadcn.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/field/field-set.svelte",
		{},
		[
			["\timport { cn, type WithElementRef } from \"$lib/utils/shadcn.js\";\n", "\timport { cn, type WithElementRef } from \"#lib/utils/shadcn.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/field/field-title.svelte",
		{},
		[
			["\timport { cn, type WithElementRef } from \"$lib/utils/shadcn.js\";\n", "\timport { cn, type WithElementRef } from \"#lib/utils/shadcn.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/field/field.svelte",
		{},
		[
			["\timport { cn, type WithElementRef } from \"$lib/utils/shadcn.js\";\n", "\timport { cn, type WithElementRef } from \"#lib/utils/shadcn.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/form/form-button.svelte",
		{},
		[
			["\timport * as Button from \"$lib/components/ui/button/index.js\";\n", "\timport * as Button from \"#lib/components/ui/button/index.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/form/form-description.svelte",
		{},
		[
			["\timport { cn, type WithoutChild } from \"$lib/utils/shadcn.js\";\n", "\timport { cn, type WithoutChild } from \"#lib/utils/shadcn.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/form/form-element-field.svelte",
		{},
		[
			["\timport { cn, type WithElementRef, type WithoutChildren } from \"$lib/utils/shadcn.js\";\n", "\timport { cn, type WithElementRef, type WithoutChildren } from \"#lib/utils/shadcn.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/form/form-field-errors.svelte",
		{},
		[
			["\timport { cn, type WithoutChild } from \"$lib/utils/shadcn.js\";\n", "\timport { cn, type WithoutChild } from \"#lib/utils/shadcn.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/form/form-field.svelte",
		{},
		[
			["\timport { cn, type WithElementRef, type WithoutChildren } from \"$lib/utils/shadcn.js\";\n", "\timport { cn, type WithElementRef, type WithoutChildren } from \"#lib/utils/shadcn.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/form/form-fieldset.svelte",
		{},
		[
			["\timport { cn, type WithoutChild } from \"$lib/utils/shadcn.js\";\n", "\timport { cn, type WithoutChild } from \"#lib/utils/shadcn.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/form/form-label.svelte",
		{},
		[
			["\timport { Label } from \"$lib/components/ui/label/index.js\";\n\timport { cn, type WithoutChild } from \"$lib/utils/shadcn.js\";\n", "\timport { Label } from \"#lib/components/ui/label/index.js\";\n\timport { cn, type WithoutChild } from \"#lib/utils/shadcn.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/form/form-legend.svelte",
		{},
		[
			["\timport { cn, type WithoutChild } from \"$lib/utils/shadcn.js\";\n", "\timport { cn, type WithoutChild } from \"#lib/utils/shadcn.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/input/input.svelte",
		{"template": "ssr"},
		[
			["\timport { cn, type WithElementRef } from '$lib/utils/shadcn.js';\n", "\timport { cn, type WithElementRef } from '#lib/utils/shadcn.js';\n"],
		]
	],
	[
		"src/lib/components/ui/input/input.svelte",
		{"template": "spa"},
		[
			["\timport { cn, type WithElementRef } from \"$lib/utils/shadcn.js\";\n", "\timport { cn, type WithElementRef } from \"#lib/utils/shadcn.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/label/label.svelte",
		{},
		[
			["\timport { cn } from \"$lib/utils/shadcn.js\";\n", "\timport { cn } from \"#lib/utils/shadcn.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/separator/separator.svelte",
		{},
		[
			["\timport { cn } from \"$lib/utils/shadcn.js\";\n", "\timport { cn } from \"#lib/utils/shadcn.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/sheet/sheet-content.svelte",
		{},
		[
			["\timport { cn, type WithoutChildrenOrChild } from \"$lib/utils/shadcn.js\";\n", "\timport { cn, type WithoutChildrenOrChild } from \"#lib/utils/shadcn.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/sheet/sheet-description.svelte",
		{},
		[
			["\timport { cn } from \"$lib/utils/shadcn.js\";\n", "\timport { cn } from \"#lib/utils/shadcn.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/sheet/sheet-footer.svelte",
		{},
		[
			["\timport { cn, type WithElementRef } from \"$lib/utils/shadcn.js\";\n", "\timport { cn, type WithElementRef } from \"#lib/utils/shadcn.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/sheet/sheet-header.svelte",
		{},
		[
			["\timport { cn, type WithElementRef } from \"$lib/utils/shadcn.js\";\n", "\timport { cn, type WithElementRef } from \"#lib/utils/shadcn.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/sheet/sheet-overlay.svelte",
		{},
		[
			["\timport { cn } from \"$lib/utils/shadcn.js\";\n", "\timport { cn } from \"#lib/utils/shadcn.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/sheet/sheet-title.svelte",
		{},
		[
			["\timport { cn } from \"$lib/utils/shadcn.js\";\n", "\timport { cn } from \"#lib/utils/shadcn.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/sidebar/context.svelte.ts",
		{},
		[
			["import { IsMobile } from \"$lib/hooks/is-mobile.svelte.js\";\n", "import { IsMobile } from \"#lib/hooks/is-mobile.svelte.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/sidebar/sidebar-content.svelte",
		{},
		[
			["\timport { cn, type WithElementRef } from \"$lib/utils/shadcn.js\";\n", "\timport { cn, type WithElementRef } from \"#lib/utils/shadcn.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/sidebar/sidebar-footer.svelte",
		{},
		[
			["\timport { cn, type WithElementRef } from \"$lib/utils/shadcn.js\";\n", "\timport { cn, type WithElementRef } from \"#lib/utils/shadcn.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/sidebar/sidebar-group-action.svelte",
		{},
		[
			["\timport { cn, type WithElementRef } from \"$lib/utils/shadcn.js\";\n", "\timport { cn, type WithElementRef } from \"#lib/utils/shadcn.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/sidebar/sidebar-group-content.svelte",
		{},
		[
			["\timport { cn, type WithElementRef } from \"$lib/utils/shadcn.js\";\n", "\timport { cn, type WithElementRef } from \"#lib/utils/shadcn.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/sidebar/sidebar-group-label.svelte",
		{},
		[
			["\timport { cn, type WithElementRef } from \"$lib/utils/shadcn.js\";\n", "\timport { cn, type WithElementRef } from \"#lib/utils/shadcn.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/sidebar/sidebar-group.svelte",
		{},
		[
			["\timport { cn, type WithElementRef } from \"$lib/utils/shadcn.js\";\n", "\timport { cn, type WithElementRef } from \"#lib/utils/shadcn.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/sidebar/sidebar-header.svelte",
		{},
		[
			["\timport { cn, type WithElementRef } from \"$lib/utils/shadcn.js\";\n", "\timport { cn, type WithElementRef } from \"#lib/utils/shadcn.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/sidebar/sidebar-input.svelte",
		{},
		[
			["\timport { Input } from \"$lib/components/ui/input/index.js\";\n\timport { cn } from \"$lib/utils/shadcn.js\";\n", "\timport { Input } from \"#lib/components/ui/input/index.js\";\n\timport { cn } from \"#lib/utils/shadcn.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/sidebar/sidebar-inset.svelte",
		{},
		[
			["\timport { cn, type WithElementRef } from \"$lib/utils/shadcn.js\";\n", "\timport { cn, type WithElementRef } from \"#lib/utils/shadcn.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/sidebar/sidebar-menu-action.svelte",
		{},
		[
			["\timport { cn, type WithElementRef } from \"$lib/utils/shadcn.js\";\n", "\timport { cn, type WithElementRef } from \"#lib/utils/shadcn.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/sidebar/sidebar-menu-badge.svelte",
		{},
		[
			["\timport { cn, type WithElementRef } from \"$lib/utils/shadcn.js\";\n", "\timport { cn, type WithElementRef } from \"#lib/utils/shadcn.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/sidebar/sidebar-menu-button.svelte",
		{},
		[
			["\timport * as Tooltip from \"$lib/components/ui/tooltip/index.js\";\n\timport { cn, type WithElementRef, type WithoutChildrenOrChild } from \"$lib/utils/shadcn.js\";\n", "\timport * as Tooltip from \"#lib/components/ui/tooltip/index.js\";\n\timport { cn, type WithElementRef, type WithoutChildrenOrChild } from \"#lib/utils/shadcn.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/sidebar/sidebar-menu-item.svelte",
		{},
		[
			["\timport { cn, type WithElementRef } from \"$lib/utils/shadcn.js\";\n", "\timport { cn, type WithElementRef } from \"#lib/utils/shadcn.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/sidebar/sidebar-menu-skeleton.svelte",
		{},
		[
			["\timport { cn, type WithElementRef } from \"$lib/utils/shadcn.js\";\n\timport { Skeleton } from \"$lib/components/ui/skeleton/index.js\";\n", "\timport { cn, type WithElementRef } from \"#lib/utils/shadcn.js\";\n\timport { Skeleton } from \"#lib/components/ui/skeleton/index.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/sidebar/sidebar-menu-sub-button.svelte",
		{},
		[
			["\timport { cn, type WithElementRef } from \"$lib/utils/shadcn.js\";\n", "\timport { cn, type WithElementRef } from \"#lib/utils/shadcn.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/sidebar/sidebar-menu-sub-item.svelte",
		{},
		[
			["\timport { cn, type WithElementRef } from \"$lib/utils/shadcn.js\";\n", "\timport { cn, type WithElementRef } from \"#lib/utils/shadcn.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/sidebar/sidebar-menu-sub.svelte",
		{},
		[
			["\timport { cn, type WithElementRef } from \"$lib/utils/shadcn.js\";\n", "\timport { cn, type WithElementRef } from \"#lib/utils/shadcn.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/sidebar/sidebar-menu.svelte",
		{},
		[
			["\timport { cn, type WithElementRef } from \"$lib/utils/shadcn.js\";\n", "\timport { cn, type WithElementRef } from \"#lib/utils/shadcn.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/sidebar/sidebar-provider.svelte",
		{},
		[
			["\timport * as Tooltip from \"$lib/components/ui/tooltip/index.js\";\n\timport { cn, type WithElementRef } from \"$lib/utils/shadcn.js\";\n", "\timport * as Tooltip from \"#lib/components/ui/tooltip/index.js\";\n\timport { cn, type WithElementRef } from \"#lib/utils/shadcn.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/sidebar/sidebar-rail.svelte",
		{},
		[
			["\timport { cn, type WithElementRef } from \"$lib/utils/shadcn.js\";\n", "\timport { cn, type WithElementRef } from \"#lib/utils/shadcn.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/sidebar/sidebar-separator.svelte",
		{},
		[
			["\timport { Separator } from \"$lib/components/ui/separator/index.js\";\n\timport { cn } from \"$lib/utils/shadcn.js\";\n", "\timport { Separator } from \"#lib/components/ui/separator/index.js\";\n\timport { cn } from \"#lib/utils/shadcn.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/sidebar/sidebar-trigger.svelte",
		{},
		[
			["\timport { Button } from \"$lib/components/ui/button/index.js\";\n\timport { cn } from \"$lib/utils/shadcn.js\";\n", "\timport { Button } from \"#lib/components/ui/button/index.js\";\n\timport { cn } from \"#lib/utils/shadcn.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/sidebar/sidebar.svelte",
		{},
		[
			["\timport * as Sheet from \"$lib/components/ui/sheet/index.js\";\n\timport { cn, type WithElementRef } from \"$lib/utils/shadcn.js\";\n", "\timport * as Sheet from \"#lib/components/ui/sheet/index.js\";\n\timport { cn, type WithElementRef } from \"#lib/utils/shadcn.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/skeleton/skeleton.svelte",
		{},
		[
			["\timport { cn, type WithElementRef, type WithoutChildren } from \"$lib/utils/shadcn.js\";\n", "\timport { cn, type WithElementRef, type WithoutChildren } from \"#lib/utils/shadcn.js\";\n"],
		]
	],
	[
		"src/lib/components/ui/tooltip/tooltip-content.svelte",
		{},
		[
			["\timport { cn } from \"$lib/utils/shadcn.js\";\n", "\timport { cn } from \"#lib/utils/shadcn.js\";\n"],
		]
	],
	[
		"src/lib/features/health/api.ts",
		{"template": "ssr", "ssrMode": "fastapi"},
		[
			["import fastapiClient from '$lib/api/fastapi-client';\n", "import fastapiClient from '#lib/api/fastapi-client.js';\n"],
		]
	],
	[
		"src/lib/features/health/api.ts",
		{"template": "spa"},
		[
			["import client, { apiRequest } from '$lib/api/client';\n", "import client, { apiRequest } from '#lib/api/client.js';\n"],
		]
	],
	[
		"src/lib/features/health/contract.ts",
		{"template": "ssr", "ssrMode": "fastapi"},
		[
			["import type { components } from '$lib/api/paths/fastapi';\n", "import type { components } from '#lib/api/paths/fastapi.js';\n"],
		]
	],
	[
		"src/lib/features/health/contract.ts",
		{"template": "spa"},
		[
			["import type { components } from '$lib/api/openapi';\n", "import type { components } from '#lib/api/openapi.js';\n"],
		]
	],
	[
		"src/lib/features/items/api.ts",
		{"template": "ssr", "ssrMode": "fastapi"},
		[
			["import fastapiClient from '$lib/api/fastapi-client';\n", "import fastapiClient from '#lib/api/fastapi-client.js';\n"],
		]
	],
	[
		"src/lib/features/items/components/item-card.svelte",
		{},
		[
			["\timport { Checkbox } from '$lib/components/ui/checkbox';\n\timport { Button } from '$lib/components/ui/button';\n", "\timport { Checkbox } from '#lib/components/ui/checkbox/index.js';\n\timport { Button } from '#lib/components/ui/button/index.js';\n"],
		]
	],
	[
		"src/lib/features/items/components/item-form.svelte",
		{},
		[
			["\timport { Input } from '$lib/components/ui/input';\n\timport { Button } from '$lib/components/ui/button';\n\timport { Label } from '$lib/components/ui/label';\n", "\timport { Input } from '#lib/components/ui/input/index.js';\n\timport { Button } from '#lib/components/ui/button/index.js';\n\timport { Label } from '#lib/components/ui/label/index.js';\n"],
		]
	],
	[
		"src/lib/features/items/components/item-list.svelte",
		{},
		[
			["\timport { Skeleton } from '$lib/components/ui/skeleton';\n\timport { Button } from '$lib/components/ui/button';\n", "\timport { Skeleton } from '#lib/components/ui/skeleton/index.js';\n\timport { Button } from '#lib/components/ui/button/index.js';\n"],
		]
	],
	[
		"src/lib/features/items/contract.test.ts",
		{"template": "ssr", "ssrMode": "fastapi"},
		[
			["import type { paths } from '$lib/api/paths/fastapi';\n", "import type { paths } from '#lib/api/paths/fastapi.js';\n"],
		]
	],
	[
		"src/lib/features/items/dto.ts",
		{"template": "ssr", "ssrMode": "fullstack"},
		[
			["import type { DbItem } from '$lib/server/db/schema';\n", "import type { DbItem } from '#lib/server/db/schema.js';\n"],
		]
	],
	[
		"src/lib/features/items/dto.ts",
		{"template": "ssr", "ssrMode": "fastapi"},
		[
			["import type { components } from '$lib/api/paths/fastapi';\n", "import type { components } from '#lib/api/paths/fastapi.js';\n"],
		]
	],
	[
		"src/lib/features/items/server.ts",
		{"template": "ssr", "ssrMode": "fullstack"},
		[
			["import { db } from '$lib/server/db';\nimport { items, type DbItem } from '$lib/server/db/schema';\n", "import { db } from '#lib/server/db/index.js';\nimport { items, type DbItem } from '#lib/server/db/schema.js';\n"],
		]
	],
	[
		"src/lib/features/items/service.test.ts",
		{"template": "ssr", "ssrMode": "fullstack"},
		[
			["import type { DbItem } from '$lib/server/db/schema';\n", "import type { DbItem } from '#lib/server/db/schema.js';\n"],
		]
	],
	[
		"src/lib/features/items/service.ts",
		{"template": "ssr", "ssrMode": "fullstack"},
		[
			["import type { DbItem } from '$lib/server/db/schema';\nimport { ApiError } from '$lib/utils/api-core';\n", "import type { DbItem } from '#lib/server/db/schema.js';\nimport { ApiError } from '#lib/utils/api-core.js';\n"],
		]
	],
	[
		"src/lib/features/items/testing/in-memory-repository.ts",
		{"template": "ssr", "ssrMode": "fullstack"},
		[
			["import type { DbItem } from '$lib/server/db/schema';\n", "import type { DbItem } from '#lib/server/db/schema.js';\n"],
		]
	],
	[
		"src/lib/features/login/components/form.svelte",
		{"template": "ssr"},
		[
			["\timport * as Card from '$lib/components/ui/card';\n\timport * as Form from '$lib/components/ui/form';\n\timport { loginSchema } from '$lib/features/login/schema';\n", "\timport * as Card from '#lib/components/ui/card/index.js';\n\timport * as Form from '#lib/components/ui/form/index.js';\n\timport { loginSchema } from '#lib/features/login/schema.js';\n"],
			["\timport { Input } from '$lib/components/ui/input';\n\timport { Button } from '$lib/components/ui/button';\n", "\timport { Input } from '#lib/components/ui/input/index.js';\n\timport { Button } from '#lib/components/ui/button/index.js';\n"],
			["\timport FormDebug from '$lib/components/form/form-debug.svelte';\n", "\timport FormDebug from '#lib/components/form/form-debug.svelte';\n"],
		]
	],
	[
		"src/lib/features/login/components/form.svelte",
		{"template": "spa"},
		[
			["\timport * as Card from '$lib/components/ui/card/index.js';\n\timport { Input } from '$lib/components/ui/input/index.js';\n\timport * as Form from '$lib/components/ui/form/index.js';\n\timport * as Field from '$lib/components/ui/field/index.js';\n", "\timport * as Card from '#lib/components/ui/card/index.js';\n\timport { Input } from '#lib/components/ui/input/index.js';\n\timport * as Form from '#lib/components/ui/form/index.js';\n\timport * as Field from '#lib/components/ui/field/index.js';\n"],
			["\timport client from '$lib/api/client';\n", "\timport client from '#lib/api/client.js';\n"],
			["\timport { authStore } from '$lib/stores/auth.svelte';\n\timport type { components } from '$lib/api/openapi';\n", "\timport { authStore } from '#lib/stores/auth.svelte.js';\n\timport type { components } from '#lib/api/openapi.js';\n"],
			["\t\tawait goto(resolve('/home'));\n", "\t\tawait goto(resolve('home'));\n"],
		]
	],
	[
		"src/lib/features/login/components/logout-button.svelte",
		{"template": "spa"},
		[
			["\timport client from '$lib/api/client';\n\timport Button from '$lib/components/ui/button/button.svelte';\n\timport { authStore } from '$lib/stores/auth.svelte';\n", "\timport client from '#lib/api/client.js';\n\timport Button from '#lib/components/ui/button/button.svelte';\n\timport { authStore } from '#lib/stores/auth.svelte.js';\n"],
		]
	],
	[
		"src/lib/guards/auth.ts",
		{"template": "spa"},
		[
			["import { authStore } from '$lib/stores/auth.svelte';\n", "import { authStore } from '#lib/stores/auth.svelte.js';\n"],
			["import { browser } from '$app/environment';\nimport { ensureValidToken } from '$lib/api/auth-interceptor';\n", "import { browser } from '$app/env';\nimport { ensureValidToken } from '#lib/api/auth-interceptor.js';\n"],
			[" * import { requireAuth } from '$lib/guards/auth';\n", " * import { requireAuth } from '#lib/guards/auth.js';\n"],
			[" * import { redirectIfAuthenticated } from '$lib/guards/auth';\n", " * import { redirectIfAuthenticated } from '#lib/guards/auth.js';\n"],
		]
	],
	[
		"src/lib/hooks/auth-guard.ts",
		{"template": "ssr", "ssrMode": "fullstack"},
		[
			["import { isProtectedRoute } from '$lib/utils/auth';\n", "import type { Handle } from '@sveltejs/kit/hooks';\nimport { isProtectedRoute } from '#lib/utils/auth.js';\n"],
			["} from '$lib/server/auth/session';\nimport type { Handle } from '@sveltejs/kit';\n", "} from '#lib/server/auth/session.js';\n"],
		]
	],
	[
		"src/lib/hooks/auth-guard.ts",
		{"template": "ssr", "ssrMode": "fastapi"},
		[
			["import { clearCookieTokens, isProtectedRoute, isTokenExpired } from '$lib/utils/auth';\nimport type { Handle } from '@sveltejs/kit';\n", "import type { Handle } from '@sveltejs/kit/hooks';\nimport { clearCookieTokens, isProtectedRoute, isTokenExpired } from '#lib/utils/auth.js';\n"],
		]
	],
	[
		"src/lib/hooks/fastapi.hook.ts",
		{"template": "ssr", "ssrMode": "fastapi"},
		[
			["import { createFastApiClient } from '$lib/api/fastapi-client';\nimport type { Handle } from '@sveltejs/kit';\n", "import type { Handle } from '@sveltejs/kit/hooks';\nimport { createFastApiClient } from '#lib/api/fastapi-client.js';\n"],
		]
	],
	[
		"src/lib/index.ts",
		{},
		[
			["// place files you want to import through the `$lib` alias in this folder.\n", "// place files you want to import through the `#lib` alias in this folder.\n"],
		]
	],
	[
		"src/lib/logger.ts",
		{"template": "ssr"},
		[
			["import { dev } from '$app/environment';\n", "import { dev } from '$app/env';\n"],
		]
	],
	[
		"src/lib/server/auth/session.test.ts",
		{"template": "ssr", "ssrMode": "fullstack"},
		[
			["import { db } from '$lib/server/db';\nimport { sessions, users } from '$lib/server/db/schema';\n", "import { db } from '#lib/server/db/index.js';\nimport { sessions, users } from '#lib/server/db/schema.js';\n"],
			["vi.mock('$lib/server/db', async () => {\n\tconst { createDb } = await import('$lib/server/db/client');\n", "vi.mock('#lib/server/db/index.js', async () => {\n\tconst { createDb } = await import('#lib/server/db/client.js');\n"],
		]
	],
	[
		"src/lib/server/auth/session.ts",
		{"template": "ssr", "ssrMode": "fullstack"},
		[
			["import { db } from '$lib/server/db';\nimport { sessions, users, type User, type Session } from '$lib/server/db/schema';\n", "import { db } from '#lib/server/db/index.js';\nimport { sessions, users, type User, type Session } from '#lib/server/db/schema.js';\n"],
		]
	],
	[
		"src/lib/server/db/index.ts",
		{"template": "ssr", "ssrMode": "fullstack"},
		[
			["import { env } from '$env/dynamic/private';\nimport { building } from '$app/environment';\n", "import { DATABASE_URL } from '$app/env/private';\nimport { building } from '$app/env';\n"],
			["export const db = building\n\t? drizzle(new Database(':memory:'), { schema })\n\t: createDb(env.DATABASE_URL || 'sqlite.db');\n", "export const db = building ? drizzle(new Database(':memory:'), { schema }) : createDb(DATABASE_URL);\n"],
		]
	],
	[
		"src/lib/server/http.test.ts",
		{"template": "ssr", "ssrMode": "fullstack"},
		[
			["import { ApiError } from '$lib/utils/api-core';\n", "import { ApiError } from '#lib/utils/api-core.js';\n"],
		]
	],
	[
		"src/lib/server/http.ts",
		{"template": "ssr", "ssrMode": "fullstack"},
		[
			["import { json } from '@sveltejs/kit';\nimport { ApiError } from '$lib/utils/api-core';\n", "import { ApiError } from '#lib/utils/api-core.js';\n"],
			["\t\treturn json({ error: err.message }, { status: err.status });\n", "\t\treturn Response.json({ error: err.message }, { status: err.status });\n"],
			["\treturn json({ error: fallback }, { status: 500 });\n", "\treturn Response.json({ error: fallback }, { status: 500 });\n"],
		]
	],
	[
		"src/lib/server/proxy/refresh.ts",
		{"template": "ssr", "ssrMode": "fastapi"},
		[
			["import { logger } from '$lib/logger';\nimport { clearCookieTokens, setAuthTokens } from '$lib/utils/auth';\n", "import { logger } from '#lib/logger.js';\nimport { clearCookieTokens, setAuthTokens } from '#lib/utils/auth.js';\n"],
		]
	],
	[
		"src/lib/server/services.ts",
		{"template": "ssr", "ssrMode": "fullstack"},
		[
			["import { createItemsService } from '$lib/features/items/service';\nimport { drizzleItemsRepository } from '$lib/features/items/server';\n", "import { createItemsService } from '#lib/features/items/service.js';\nimport { drizzleItemsRepository } from '#lib/features/items/server.js';\n"],
		]
	],
	[
		"src/lib/stores/auth.svelte.ts",
		{"template": "spa"},
		[
			["import { browser } from '$app/environment';\nimport type { components } from '$lib/api/openapi';\n", "import { browser } from '$app/env';\nimport type { components } from '#lib/api/openapi.js';\n"],
		]
	],
	[
		"src/routes/(protected)/+layout.svelte",
		{"template": "ssr"},
		[
			["\timport { Button } from '$lib/components/ui/button';\n\timport { Separator } from '$lib/components/ui/separator';\n", "\timport { Button } from '#lib/components/ui/button/index.js';\n\timport { Separator } from '#lib/components/ui/separator/index.js';\n"],
			["\t\t\t<a href={resolve('/home')} class=\"text-lg font-bold tracking-tight text-primary\"\n", "\t\t\t<a href={resolve('home')} class=\"text-lg font-bold tracking-tight text-primary\"\n"],
			["\t\t\t\t\thref={resolve('/home')}\n", "\t\t\t\t\thref={resolve('home')}\n"],
			["\t\t\t\t\thref={resolve('/items')}\n", "\t\t\t\t\thref={resolve('items')}\n"],
		]
	],
	[
		"src/routes/(protected)/+layout.svelte",
		{"template": "spa"},
		[
			["\timport { Button } from '$lib/components/ui/button';\n\timport { Separator } from '$lib/components/ui/separator';\n\timport { authStore } from '$lib/stores/auth.svelte';\n", "\timport { Button } from '#lib/components/ui/button/index.js';\n\timport { Separator } from '#lib/components/ui/separator/index.js';\n\timport { authStore } from '#lib/stores/auth.svelte.js';\n"],
			["\timport client from '$lib/api/client';\n", "\timport client from '#lib/api/client.js';\n"],
			["\t\tawait goto(resolve('/login'));\n", "\t\tawait goto(resolve('login'));\n"],
			["\t\t\t<a href={resolve('/home')} class=\"text-lg font-bold tracking-tight text-primary\"\n", "\t\t\t<a href={resolve('home')} class=\"text-lg font-bold tracking-tight text-primary\"\n"],
			["\t\t\t\t\thref={resolve('/home')}\n", "\t\t\t\t\thref={resolve('home')}\n"],
			["\t\t\t\t\thref={resolve('/items')}\n", "\t\t\t\t\thref={resolve('items')}\n"],
		]
	],
	[
		"src/routes/(protected)/+layout.ts",
		{"template": "spa"},
		[
			["import { requireAuth } from '$lib/guards/auth';\nimport { authStore } from '$lib/stores/auth.svelte';\n", "import { requireAuth } from '#lib/guards/auth.js';\nimport { authStore } from '#lib/stores/auth.svelte.js';\n"],
		]
	],
	[
		"src/routes/(protected)/home/+page.server.ts",
		{"template": "ssr", "ssrMode": "fullstack"},
		[
			["import type { HealthStatus } from '$lib/features/health/contract';\n", "import type { HealthStatus } from '#lib/features/health/contract.js';\n"],
		]
	],
	[
		"src/routes/(protected)/home/+page.svelte",
		{"template": "ssr"},
		[
			["\t} from '$lib/components/ui/card';\n\timport { Button } from '$lib/components/ui/button';\n\timport { useHealthApi } from '$lib/features/health/context';\n\timport { healthKeys, useHealthStatus } from '$lib/features/health/queries';\n", "\t} from '#lib/components/ui/card/index.js';\n\timport { Button } from '#lib/components/ui/button/index.js';\n\timport { useHealthApi } from '#lib/features/health/context.js';\n\timport { healthKeys, useHealthStatus } from '#lib/features/health/queries.js';\n"],
		]
	],
	[
		"src/routes/(protected)/home/+page.svelte",
		{"template": "spa"},
		[
			["\t} from '$lib/components/ui/card';\n\timport { Button } from '$lib/components/ui/button';\n\timport { useHealthStatus } from '$lib/features/health/queries';\n", "\t} from '#lib/components/ui/card/index.js';\n\timport { Button } from '#lib/components/ui/button/index.js';\n\timport { useHealthStatus } from '#lib/features/health/queries.js';\n"],
		]
	],
	[
		"src/routes/(protected)/items/+page.server.ts",
		{"template": "ssr", "ssrMode": "fullstack"},
		[
			["import { itemsService } from '$lib/server/services';\n", "import { itemsService } from '#lib/server/services.js';\n"],
		]
	],
	[
		"src/routes/(protected)/items/+page.server.ts",
		{"template": "ssr", "ssrMode": "fastapi"},
		[
			["import { toItem } from '$lib/features/items/dto';\n", "import { toItem } from '#lib/features/items/dto.js';\n"],
		]
	],
	[
		"src/routes/(protected)/items/+page.svelte",
		{},
		[
			["\timport { ItemList, ItemForm } from '$lib/features/items';\n", "\timport { ItemList, ItemForm } from '#lib/features/items/index.js';\n"],
		]
	],
	[
		"src/routes/+layout.svelte",
		{"template": "ssr"},
		[
			["\timport favicon from '$lib/assets/favicon.svg';\n\timport { env } from '$env/dynamic/public';\n", "\timport favicon from '#lib/assets/favicon.svg';\n\timport { PUBLIC_APP_TITLE } from '$app/env/public';\n"],
			["\timport { Toaster } from '$lib/components/ui/sonner/index.js';\n", "\timport { Toaster } from '#lib/components/ui/sonner/index.js';\n"],
			["\timport { itemsApi } from '$lib/features/items/api';\n\timport { setItemsApi } from '$lib/features/items/context';\n\timport { healthApi } from '$lib/features/health/api';\n\timport { setHealthApi } from '$lib/features/health/context';\n", "\timport { itemsApi } from '#lib/features/items/api.js';\n\timport { setItemsApi } from '#lib/features/items/context.js';\n\timport { healthApi } from '#lib/features/health/api.js';\n\timport { setHealthApi } from '#lib/features/health/context.js';\n"],
			["\t\t{env.PUBLIC_APP_TITLE}\n", "\t\t{PUBLIC_APP_TITLE}\n"],
		]
	],
	[
		"src/routes/+layout.svelte",
		{"template": "spa"},
		[
			["\timport favicon from '$lib/assets/favicon.svg';\n", "\timport favicon from '#lib/assets/favicon.svg';\n"],
			["\timport { Toaster } from '$lib/components/ui/sonner/index.js';\n\timport { PUBLIC_APP_TITLE } from '$env/static/public';\n", "\timport { Toaster } from '#lib/components/ui/sonner/index.js';\n\timport { PUBLIC_APP_TITLE } from '$app/env/public';\n"],
			["\timport { itemsApi } from '$lib/features/items/api';\n\timport { setItemsApi } from '$lib/features/items/context';\n\timport { healthApi } from '$lib/features/health/api';\n\timport { setHealthApi } from '$lib/features/health/context';\n", "\timport { itemsApi } from '#lib/features/items/api.js';\n\timport { setItemsApi } from '#lib/features/items/context.js';\n\timport { healthApi } from '#lib/features/health/api.js';\n\timport { setHealthApi } from '#lib/features/health/context.js';\n"],
		]
	],
	[
		"src/routes/+page.svelte",
		{},
		[
			["\timport { Button } from '$lib/components/ui/button';\n", "\timport { Button } from '#lib/components/ui/button/index.js';\n"],
		]
	],
	[
		"src/routes/api/health/+server.ts",
		{"template": "ssr", "ssrMode": "fullstack"},
		[
			["import { json, type RequestHandler } from '@sveltejs/kit';\n", "import type { RequestHandler } from '@sveltejs/kit';\n"],
			["import { db } from '$lib/server/db';\nimport { logger } from '$lib/logger';\nimport type { HealthStatus } from '$lib/features/health/contract';\n", "import { db } from '#lib/server/db/index.js';\nimport { logger } from '#lib/logger.js';\nimport type { HealthStatus } from '#lib/features/health/contract.js';\n"],
			["\t\treturn json({ status: 'ok' } satisfies HealthStatus);\n", "\t\treturn Response.json({ status: 'ok' } satisfies HealthStatus);\n"],
			["\t\treturn json({ error: 'Database unavailable' }, { status: 503 });\n", "\t\treturn Response.json({ error: 'Database unavailable' }, { status: 503 });\n"],
		]
	],
	[
		"src/routes/api/items/+server.ts",
		{"template": "ssr", "ssrMode": "fullstack"},
		[
			["import { json, type RequestHandler } from '@sveltejs/kit';\nimport { itemsService } from '$lib/server/services';\nimport { toErrorResponse } from '$lib/server/http';\nimport { createItemSchema } from '$lib/features/items/schema';\n", "import type { RequestHandler } from '@sveltejs/kit';\nimport { itemsService } from '#lib/server/services.js';\nimport { toErrorResponse } from '#lib/server/http.js';\nimport { createItemSchema } from '#lib/features/items/schema.js';\n"],
			["\treturn json({ error: 'Unauthorized' }, { status: 401 });\n", "\treturn Response.json({ error: 'Unauthorized' }, { status: 401 });\n"],
			["\treturn json(items);\n", "\treturn Response.json(items);\n"],
			["\t\t\treturn json({ error: result.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });\n", "\t\t\treturn Response.json(\n\t\t\t\t{ error: result.error.issues[0]?.message ?? 'Invalid input' },\n\t\t\t\t{ status: 400 }\n\t\t\t);\n"],
			["\t\treturn json(created, { status: 201 });\n", "\t\treturn Response.json(created, { status: 201 });\n"],
			["\t\t\treturn json({ error: 'Invalid payload' }, { status: 400 });\n", "\t\t\treturn Response.json({ error: 'Invalid payload' }, { status: 400 });\n"],
			["\t\treturn json(updated);\n", "\t\treturn Response.json(updated);\n"],
			["\t\t\treturn json({ error: 'Item ID is required' }, { status: 400 });\n", "\t\t\treturn Response.json({ error: 'Item ID is required' }, { status: 400 });\n"],
			["\t\treturn json({ success: true });\n", "\t\treturn Response.json({ success: true });\n"],
		]
	],
	[
		"src/routes/api/proxy/[...slug]/+server.ts",
		{"template": "ssr", "ssrMode": "fastapi"},
		[
			["import { env } from '$env/dynamic/private';\nimport { logger } from '$lib/logger';\n", "import { BACKEND_API_URL } from '$app/env/private';\nimport { logger } from '#lib/logger.js';\n"],
			["import { refreshTokens } from '$lib/server/proxy/refresh';\n", "import { refreshTokens } from '#lib/server/proxy/refresh.js';\n"],
			["\tif (!env.BACKEND_API_URL) {\n", "\tif (!BACKEND_API_URL) {\n"],
			["\tconst backendBase = env.BACKEND_API_URL.replace(/\\/$/, '');\n", "\tconst backendBase = BACKEND_API_URL.replace(/\\/$/, '');\n"],
		]
	],
	[
		"src/routes/login/+page.server.ts",
		{"template": "ssr", "ssrMode": "fullstack"},
		[
			["import { loginSchema } from '$lib/features/login/schema';\nimport { logger } from '$lib/logger';\nimport { db } from '$lib/server/db';\nimport { authenticate } from '$lib/server/auth/users';\nimport { createSession, generateSessionToken, setSessionCookie } from '$lib/server/auth/session';\n", "import { loginSchema } from '#lib/features/login/schema.js';\nimport { logger } from '#lib/logger.js';\nimport { db } from '#lib/server/db/index.js';\nimport { authenticate } from '#lib/server/auth/users.js';\nimport { createSession, generateSessionToken, setSessionCookie } from '#lib/server/auth/session.js';\n"],
		]
	],
	[
		"src/routes/login/+page.server.ts",
		{"template": "ssr", "ssrMode": "fastapi"},
		[
			["import { loginSchema } from '$lib/features/login/schema';\nimport { logger } from '$lib/logger';\nimport { setAuthTokens, isTokenExpired } from '$lib/utils/auth';\n", "import { loginSchema } from '#lib/features/login/schema.js';\nimport { logger } from '#lib/logger.js';\nimport { setAuthTokens, isTokenExpired } from '#lib/utils/auth.js';\n"],
		]
	],
	[
		"src/routes/login/+page.svelte",
		{},
		[
			["\timport LoginForm from '$lib/features/login/components/form.svelte';\n", "\timport LoginForm from '#lib/features/login/components/form.svelte';\n"],
		]
	],
	[
		"src/routes/login/+page.ts",
		{"template": "spa"},
		[
			["import { redirectIfAuthenticated } from '$lib/guards/auth';\n", "import { redirectIfAuthenticated } from '#lib/guards/auth.js';\n"],
		]
	],
	[
		"src/routes/logout/+page.server.ts",
		{"template": "ssr", "ssrMode": "fullstack"},
		[
			["import { deleteSessionCookie, invalidateSession } from '$lib/server/auth/session';\n", "import { deleteSessionCookie, invalidateSession } from '#lib/server/auth/session.js';\n"],
		]
	],
	[
		"src/routes/logout/+page.server.ts",
		{"template": "ssr", "ssrMode": "fastapi"},
		[
			["import { clearCookieTokens } from '$lib/utils/auth';\n", "import { clearCookieTokens } from '#lib/utils/auth.js';\n"],
		]
	],
	[
		"tsconfig.json",
		{"template": "ssr"},
		[
			["\t\"extends\": \"./.svelte-kit/tsconfig.json\",\n", "\t\"extends\": \"$app/tsconfig\",\n"],
			["\t\t\"allowJs\": true,\n\t\t\"checkJs\": true,\n\t\t\"esModuleInterop\": true,\n\t\t\"forceConsistentCasingInFileNames\": true,\n\t\t\"resolveJsonModule\": true,\n\t\t\"skipLibCheck\": true,\n", ""],
			["\t\t\"moduleResolution\": \"bundler\",\n\t\t\"types\": [\"node\"]\n\t}\n\t// Path aliases are handled by https://svelte.dev/docs/kit/configuration#alias\n\t// except $lib which is handled by https://svelte.dev/docs/kit/configuration#files\n\t//\n\t// If you want to overwrite includes/excludes, make sure to copy over the relevant includes/excludes\n\t// from the referenced tsconfig.json - TypeScript does not merge them in\n", "\t\t\"types\": [\"$app/types\", \"node\"]\n\t},\n\t\"include\": [\"src\", \"vite.config.ts\"]\n"],
		]
	],
	[
		"tsconfig.json",
		{"template": "spa"},
		[
			["\t\"extends\": \"./.svelte-kit/tsconfig.json\",\n", "\t\"extends\": \"$app/tsconfig\",\n"],
			["\t\t\"allowJs\": true,\n\t\t\"checkJs\": true,\n\t\t\"esModuleInterop\": true,\n\t\t\"forceConsistentCasingInFileNames\": true,\n\t\t\"resolveJsonModule\": true,\n\t\t\"skipLibCheck\": true,\n", ""],
			["\t\t\"strict\": true,\n\t\t\"moduleResolution\": \"bundler\"\n\t}\n\t// Path aliases are handled by https://svelte.dev/docs/kit/configuration#alias\n\t// except $lib which is handled by https://svelte.dev/docs/kit/configuration#files\n\t//\n\t// If you want to overwrite includes/excludes, make sure to copy over the relevant includes/excludes\n\t// from the referenced tsconfig.json - TypeScript does not merge them in\n", "\t\t\"strict\": true\n\t},\n\t\"include\": [\"src\", \"vite.config.ts\"]\n"],
		]
	],
];

export const hunkTransforms: FileTransform[] = HUNKS.map(([file, scope, hunks]) => ({
	file,
	...scope,
	transform: replaceTexts(hunks)
}));
