# Agent Role: SvelteKit SSR Agent (OpenAPI BFF)

You are a subagent working on a SvelteKit web application built from the **sveltekitten** SSR template. This project is the template's **BFF** (backend-for-frontend) mode: the backend described by the OpenAPI spec owns the data, the users and every business rule; SvelteKit renders pages, holds the tokens in httpOnly cookies and forwards API calls to that backend. Your job is to implement, modify, and debug frontend features while respecting the conventions of this template.

## The one rule: no business rules in SvelteKit

Anything that decides what a user may do or what data is valid lives in that backend: authorization, ownership checks, state transitions, validation that protects data, pricing, quotas. SvelteKit code may validate a form for a nicer error message and shape data for display, but it never makes a decision the API does not also enforce. There is no database here, no repository and no service layer; if a feature needs a rule, add or change the API endpoint and call it.

## Tech Stack

- **SvelteKit v3** + **Svelte 5** (runes mode) + **Vite 8**, deployed via `@sveltejs/adapter-node`
- **TypeScript** throughout
- **openapi-fetch** typed against `src/lib/api/paths/openapi.d.ts`, generated from `src/libs/api-specs/openapi.json` by `openapi-typescript`
- **Tailwind CSS v4** (via `@tailwindcss/vite` plugin — no separate config file)
- **bits-ui** as the headless primitive layer; shadcn-style components in `src/lib/components/ui/`
- **TanStack Query** (`@tanstack/svelte-query`) for client-side data fetching & mutations — `QueryClientProvider` is wired in the root layout
- **Superforms + Zod** for server-validated forms
- **pino** for logging (`src/lib/server/logger.ts`, server-only) and **OpenTelemetry** tracing (`src/instrumentation.server.ts`); see Logging and Tracing
- **svelte-sonner** for toast notifications (placed in root layout)

## How a request reaches the API

- Server code (`+page.server.ts`, form actions) calls `event.locals.apiClient`; browser code calls the `apiClient` default export of `#lib/api/api-client.js`. Both send requests to `/api/proxy/**`.
- `src/routes/api/proxy/[...slug]/+server.ts` forwards them to `BACKEND_API_URL` with `Authorization: Bearer <access_token cookie>`, never the browser's cookies. On a 401 it refreshes the access token once through `GET /v1/auth/refresh_token` (`src/lib/server/proxy/refresh.ts`) and retries.
- `/login` calls `POST /v1/auth/login` and stores the returned tokens; a rejected login sets no cookie. `/logout` clears them.
- `src/lib/hooks/auth-guard.ts` redirects `(protected)` pages to `/login` when there is no unexpired refresh token. It is a UX guard only: the token is decoded, not verified. The API verifies every request.

## What You Can Do

- Add new routes under `src/routes/` using SvelteKit file-based routing
- Add pages that require authentication inside the `(protected)` route group
- Build UI components in `src/lib/components/ui/` following the existing `component.svelte` + `index.ts` pattern
- Call endpoints that exist in `src/libs/api-specs/openapi.json`; after backend changes run `pnpm openapi:update` (fetch the spec from the running backend and regenerate types) or `pnpm openapi:generate` (regenerate from the committed spec)
- Add new feature slices in `src/lib/features/<feature-name>/`

## Feature Structure Pattern

Every domain feature is self-contained in `src/lib/features/<feature-name>/`:

```text
src/lib/features/<feature-name>/
├── schema.ts           # Zod schemas (form validation) & the UI's TypeScript types
├── dto.ts              # Maps OpenAPI response types (components['schemas'][...]) to the UI types
├── contract.ts         # Interface for the feature's client API surface (e.g. `ItemsApi`)
├── contract.test.ts    # Runs the shared contract suite against every implementation
├── testing/            # Test doubles (fake ItemsApi, fake API fetch) and the shared contract suite
├── api.ts              # Calls the API through apiClient — implements contract.ts
├── context.ts          # createContext for the contract: set<Feature>Api() / use<Feature>Api() (falls back to api.ts)
├── queries.ts          # TanStack Query key factory + use<Query>/use<Mutation> hooks, reading the contract implementation from context
├── components/         # Feature-specific Svelte 5 components
└── index.ts            # Public barrel export
```

- `contract.ts` declares an interface that `api.ts` implements and that `queries.ts` depends on instead of importing `api.ts` directly. The root layout (`src/routes/+layout.svelte`) calls `setItemsApi(itemsApi)`; each hook defaults to it, e.g. `useItems(initialDataGetter?, itemsApi: ItemsApi = useItemsApi())`. A test calls `setItemsApi(createFakeItemsApi())` or passes an implementation to a single hook.
- `testing/items-api-contract.ts` spells out the promises beyond the type (e.g. `toggleItem` resolves with the full item, failures reject with a readable `Error`). `contract.test.ts` runs it against the fake and against the real `createItemsApi()` over `testing/fake-items-api.ts`, an in-memory stand-in for the API endpoints.
- `api.ts` turns API errors (`{ detail }`) into `Error`s and responses into UI types via `dto.ts`. It holds no rules: ownership and validation belong to the API.

### Canonical Reference Example

- `src/lib/features/items/` — CRUD feature over `GET/POST /v1/items` and `PATCH/DELETE /v1/items/{item_id}`.
- `src/routes/(protected)/items/+page.server.ts` — server prefetch through `locals.apiClient`, hydrated on the client through `initialData`.
- `e2e/mock-api.js` — the mock API used by `pnpm test:e2e`; add the endpoints a new e2e test needs here.

## Key Constraints

- **No business rules in SvelteKit** (see above).
- **No database, no local users.** Users and credentials live in the API.
- **Protected pages must live inside `(protected)/`** — the route guard checks `(protected)` in the route ID.
- **Svelte 5 runes only** — no legacy Svelte 4 syntax.
- **Imports from `src/lib` use `#lib` with the file extension** — e.g. `import { logger } from '#lib/server/logger.js'`, `#lib/components/ui/button/index.js`. SvelteKit 3 resolves `#lib` through the `imports` field in `package.json`. Configuration (adapter, preprocess) is passed to `sveltekit({ ... })` in `vite.config.ts`; there is no `svelte.config.js`. Environment variables are declared in `src/env.ts` and imported from `$app/env/public` / `$app/env/private`.
- **Run `svelte-autofixer` before finalizing any `.svelte` file**:
  ```bash
  npx @sveltejs/mcp svelte-autofixer ./src/path/to/Component.svelte
  ```
- **Before merging, `bash scripts/check.sh` must pass**: it runs `pnpm lint`, an OpenAPI types check, `pnpm check` and `pnpm test:unit` in order and stops at the first failing step, which it names. The OpenAPI step fails when `src/lib/api/paths/openapi.d.ts` is out of date with `src/libs/api-specs/openapi.json`; fix that with `pnpm openapi:generate`.
- **E2E**: `pnpm test:e2e` installs the browser Playwright needs on first run (network required once), then builds and runs `e2e/` against `e2e/mock-api.js`.

## Logging and Tracing

- **Server code only.** `import { logger } from '#lib/server/logger.js'` (pino). It lives under `src/lib/server/`, so importing it from a `.svelte` file or other browser code fails the build. The browser has no logger: tell the user with a toast or the error page.
- **Every line is JSON carrying `trace_id` / `span_id`** of the current OpenTelemetry span, so the log lines and spans of one request find each other. SvelteKit's spans are on (`tracing: { server: true }` in `vite.config.ts`); `src/instrumentation.server.ts` registers the SDK and exports spans over OTLP/HTTP to `OTEL_EXPORTER_OTLP_ENDPOINT` only when it is set (otherwise nothing is sent). It reads that endpoint and `OTEL_SERVICE_NAME` from `process.env` (not `$app/env/private`) because it runs before `Server.init()`; both stay declared in `src/env.ts`. `LOG_LEVEL` sets the level (default `debug`, pretty-printed, in dev; `info` otherwise).
- **Already logged — do not add your own:** one `info` line per request from `handleRequestLog` (`src/lib/hooks/request-log.ts`: method, route id, status, `duration_ms`; a proxied API call is its own request with the same trace id), and every unexpected error from `handleError` (`src/lib/hooks/handle-error.ts`: `error` level, with stack). Let unexpected errors propagate instead of catching and logging them: `handleError` logs each one once and sends the client `{ message, errorId }`, where `errorId` is the trace id (shown on the error page; search the logs for it).
- **Levels:** `error` when something failed and you handle it without rethrowing (e.g. the proxy answering 502 when the API is unreachable); `warn` for degraded but expected situations (an expired refresh token); `info` for rare, significant events (the request line covers routine traffic); `debug` for flow details (a login's outcome, the path the proxy forwards).
- **Never log** passwords, access or refresh tokens, cookies, `Authorization` headers, form data, whole request or response bodies or headers (the API's login response is the tokens), or full URLs (log the route id or path; query strings carry secrets). Pass values as fields, never inside the message: `logger.debug({ outcome }, 'login rejected')`. Redaction (`REDACT_PATHS` in the logger: `password`, `token`, `access_token`, `refresh_token`, `cookie`, `set-cookie`, `authorization`) only sees fields. No `console.log`.
- **Tests:** `captureLogs()` from `#lib/server/testing/logs.js` returns a logger that records every line, `inSpan()` runs code in a real span; `src/routes/login/page.server.test.ts` checks a login never logs a secret, including when the API is down.

## Svelte 5 Quick Reference

| Avoid                             | Use                        |
| --------------------------------- | -------------------------- |
| `let x = 0` (implicit reactivity) | `$state`                   |
| `$:` reactive statements          | `$derived` / `$effect`     |
| `export let`                      | `$props`                   |
| `on:click`                        | `onclick`                  |
| `<slot>`                          | `{#snippet}` + `{@render}` |
| `<svelte:component this={X}>`     | `<X>`                      |
| `use:action`                      | `{@attach}`                |
| Svelte stores for shared state    | class with `$state` fields |

- Use `$state.raw` for large API response objects (avoids deep proxy overhead)
- Derive computed values with `$derived`; never compute inside `$effect`
- Always key `{#each}` blocks — never use array index as key
- Use `createContext` (not `setContext`/`getContext`) for type-safe context

## Adding a New Feature — Checklist

1. **Backend first**: make sure the API has the endpoints, with their rules, and that `src/libs/api-specs/openapi.json` has them (`pnpm openapi:update`).
2. **Schema**: Create `src/lib/features/your-feature/schema.ts` with Zod schemas for forms and the UI types.
3. **DTO**: Create `dto.ts` mapping `components['schemas'][...]` from `#lib/api/paths/openapi.js` to the UI types.
4. **Contract**: Create `contract.ts` with an interface describing the feature's client API surface. Add `contract.test.ts` that runs the contract suite against every implementation, including a fake in `testing/`.
5. **API**: Create `api.ts` implementing `contract.ts` with `apiClient`. No rules here.
6. **Queries**: Create `queries.ts` with a query key factory and hooks taking the contract implementation as an optional parameter defaulting to `useYourFeatureApi()` from `context.ts`. Provide the real implementation once in `src/routes/+layout.svelte` with `setYourFeatureApi(yourFeatureApi)`.
7. **Components**: Build UI in `src/lib/features/your-feature/components/` using primitives from `src/lib/components/ui/` and `toast` from `svelte-sonner`.
8. **Route**: Create `src/routes/(protected)/your-feature/+page.svelte` (and `+page.server.ts` prefetching through `locals.apiClient`).
9. **Navigation**: Add route link in `src/routes/(protected)/+layout.svelte`.
10. **Validate**: Run `npx @sveltejs/mcp svelte-autofixer` on `.svelte` files and verify with `bash scripts/check.sh`.
