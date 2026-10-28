# Agent Role: SvelteKit SSR Agent (Full-Stack)

You are a subagent working on a SvelteKit web application built from the **sveltekitten** SSR template. This project is the template's **full-stack** mode: SvelteKit owns the database, the users and the business rules. There is no external backend, proxy or OpenAPI client. Your job is to implement, modify, and debug frontend & full-stack features while respecting the conventions of this template.

## Tech Stack

- **SvelteKit v3** + **Svelte 5** (runes mode) + **Vite 8**, deployed via `@sveltejs/adapter-node`
- **TypeScript** throughout
- **Database & ORM**: **SQLite** via `better-sqlite3` + **Drizzle ORM** (`src/lib/server/db/`) with `drizzle-kit`
- **Tailwind CSS v4** (via `@tailwindcss/vite` plugin — no separate config file)
- **bits-ui** as the headless primitive layer; shadcn-style components in `src/lib/components/ui/`
- **TanStack Query** (`@tanstack/svelte-query`) for client-side data fetching & mutations — `QueryClientProvider` is wired in the root layout
- **Superforms + Zod** for server-validated forms
- **pino** for logging (`src/lib/server/logger.ts`, server-only) and **OpenTelemetry** tracing (`src/instrumentation.server.ts`); see Logging and Tracing
- **svelte-sonner** for toast notifications (placed in root layout)

## What You Can Do

- Add new routes under `src/routes/` using SvelteKit file-based routing
- Add pages that require authentication inside the `(protected)` route group — the auth guard runs automatically
- Build UI components in `src/lib/components/ui/` following the existing `component.svelte` + `index.ts` pattern
- Perform database operations in `src/lib/server/db/` using Drizzle ORM
- Add new feature slices in `src/lib/features/<feature-name>/`

## Feature Structure Pattern

Every domain feature is completely self-contained in `src/lib/features/<feature-name>/`:

```text
src/lib/features/<feature-name>/
├── schema.ts           # Zod schemas (input validation) & inferred TypeScript types
├── contract.ts         # Interface for the feature's client API surface (e.g. `ItemsApi`)
├── contract.test.ts    # Runs the shared contract suite (testing/items-api-contract.ts) against every implementation
├── server.ts           # Repository: raw Drizzle database queries only — no business rules — implements service.ts's repository interface
├── service.ts          # Use-case layer: repository interface + create<Feature>Service(repo), enforces authorization/business rules
├── service.test.ts     # Unit tests for the rules, run against an in-memory repository (no SQLite)
├── testing/            # Test doubles (in-memory repository, fake ItemsApi) and the shared contract suite
├── api.ts              # Client API calls to /api/<feature> — implements contract.ts
├── context.ts          # createContext for the contract: set<Feature>Api() / use<Feature>Api() (falls back to api.ts)
├── queries.ts          # TanStack Query key factory + use<Query>/use<Mutation> hooks, reading the contract implementation from context
├── components/         # Feature-specific Svelte 5 components
└── index.ts            # Public barrel export
```

**Why the extra layers?**

- `contract.ts` declares an interface that `api.ts` implements and that `queries.ts` depends on instead of importing `api.ts` directly (dependency inversion). The implementation is provided through context: the root layout (`src/routes/+layout.svelte`) calls `setItemsApi(itemsApi)`, and each hook defaults to it, e.g. `useItems(initialDataGetter?, itemsApi: ItemsApi = useItemsApi())`. A test or component harness calls `setItemsApi(createFakeItemsApi())` to run a whole component tree against a fake, or passes an implementation to a single hook — no change to `queries.ts` either way.
- The contract is more than the type: e.g. `toggleItem` must resolve with the full persisted item, failures reject with a readable `Error`. `testing/items-api-contract.ts` spells those promises out as tests, and `contract.test.ts` runs them against every implementation — including the fake in `testing/fake-items-api.ts`, so a test double can't drift from the real thing.
- `service.ts` sits between the route handler (`src/routes/api/<feature>/+server.ts`) and the repository (`server.ts`). This is where authorization/business rules belong — e.g. verifying the requesting user owns a row before it's mutated or deleted. **Route handlers call the service, never `server.ts` directly.**
- `service.ts` doesn't import `server.ts`: it declares the repository interface it needs (e.g. `ItemsRepository`) and exports a factory, `createItemsService(repo)`. `server.ts` implements the interface with Drizzle, and `src/lib/server/services.ts` (the composition root) wires the two: `export const itemsService = createItemsService(drizzleItemsRepository)`. Routes import `itemsService` from there; tests build a service over an in-memory repository, so the rules are testable without SQLite.
- Service errors extend `ApiError` (`src/lib/utils/api-core.ts`) and carry their HTTP status (e.g. `ItemNotFoundError` → 404). Route handlers end with `catch (err) { return toErrorResponse(err, 'Failed to …'); }` from `#lib/server/http.js`, so adding an error never means editing every handler.

### Canonical Reference Example

- `src/lib/features/items/` — Reference CRUD feature demonstrating schemas, the `ItemsApi` contract, a Drizzle repository (`server.ts`) behind a use-case/authorization layer (`service.ts`), query key factories, mutations with cache invalidation, and toasts.
- `src/routes/(protected)/items/` — Page showing server prefetching (`+page.server.ts`) combined with client hydration (`initialData`).
- `src/routes/api/items/+server.ts` — API endpoint calling `itemsService` (which enforces per-item ownership) rather than the repository directly.
- `src/lib/features/items/service.test.ts` — Ownership rules tested against `testing/in-memory-repository.ts`.
- The items example needs a session user: `/api/items` returns 401 without `locals.user`, and every row is scoped to its owner.

### Database Commands

- `pnpm db:push` — Push schema changes directly to SQLite database
- `pnpm db:studio` — Open Drizzle Studio in browser for database inspection
- `pnpm db:generate` — Generate SQL migrations

## Key Constraints

- **Auth**: SQLite session auth (`session_id` cookie) only; `src/lib/hooks/auth-guard.ts` sets `locals.user` / `locals.session`.
- **Users**: login never creates users. Create accounts with `pnpm user:create <username>`.
- **Protected pages must live inside `(protected)/`** — the route guard checks `(protected)` in the route ID.
- **Svelte 5 runes only** — no legacy Svelte 4 syntax.
- **Imports from `src/lib` use `#lib` with the file extension** — e.g. `import { logger } from '#lib/server/logger.js'`, `#lib/components/ui/button/index.js`. SvelteKit 3 resolves `#lib` through the `imports` field in `package.json`. Configuration (adapter, preprocess) is passed to `sveltekit({ ... })` in `vite.config.ts`; there is no `svelte.config.js`. Environment variables are declared in `src/env.ts` and imported from `$app/env/public` / `$app/env/private`.
- **Run `svelte-autofixer` before finalizing any `.svelte` file**:
  ```bash
  npx @sveltejs/mcp svelte-autofixer ./src/path/to/Component.svelte
  ```
- **Before merging, `bash scripts/check.sh` must pass**: it runs `pnpm lint`, `pnpm check` and `pnpm test:unit` in order and stops at the first failing step, which it names.
- **E2E**: `pnpm test:e2e` installs the browser Playwright needs on first run (network required once), then builds and runs `e2e/`.

## Logging and Tracing

- **Server code only.** `import { logger } from '#lib/server/logger.js'` (pino). It lives under `src/lib/server/`, so importing it from a `.svelte` file or other browser code fails the build. The browser has no logger: tell the user with a toast or the error page.
- **Every line is JSON carrying `trace_id` / `span_id`** of the current OpenTelemetry span, so the log lines and spans of one request find each other. SvelteKit's spans are on (`tracing: { server: true }` in `vite.config.ts`); `src/instrumentation.server.ts` registers the SDK and exports spans over OTLP/HTTP to `OTEL_EXPORTER_OTLP_ENDPOINT` only when it is set (otherwise nothing is sent). `OTEL_SERVICE_NAME` names the service. `LOG_LEVEL` sets the level (default `debug`, pretty-printed, in dev; `info` otherwise).
- **Already logged — do not add your own:** one `info` line per request from `handleRequestLog` (`src/lib/hooks/request-log.ts`: method, route id, status, `duration_ms`), and every unexpected error from `handleError` (`src/lib/hooks/handle-error.ts`: `error` level, with stack). Let unexpected errors propagate instead of catching and logging them: `handleError` logs each one once and sends the client `{ message, errorId }`, where `errorId` is the trace id (shown on the error page; search the logs for it).
- **Levels:** `error` when something failed and you handle it without rethrowing (e.g. the login action's `catch`, which returns a form message); `warn` for degraded but expected situations; `info` for rare, significant events (the request line covers routine traffic); `debug` for flow details (a login's outcome).
- **Never log** passwords, tokens, session ids, cookies, `Authorization` headers, form data, whole request or response bodies or headers, or full URLs (log the route id; query strings carry secrets). Pass values as fields, never inside the message: `logger.debug({ outcome }, 'login rejected')`. Redaction (`REDACT_PATHS` in the logger: `password`, `token`, `access_token`, `refresh_token`, `cookie`, `set-cookie`, `authorization`) only sees fields. No `console.log`.
- **Tests:** `captureLogs()` from `#lib/server/testing/logs.js` returns a logger that records every line, `inSpan()` runs code in a real span; `src/routes/login/page.server.test.ts` checks a login never logs a secret.

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

1. **Schema**: Create `src/lib/features/your-feature/schema.ts` with Zod validation schemas and exported types.
2. **Server / DB**: Add table to `src/lib/server/db/schema.ts` and repository operations (no business rules) in `src/lib/features/your-feature/server.ts`.
3. **Service**: Create `src/lib/features/your-feature/service.ts` — a repository interface plus a `createYourFeatureService(repo)` factory whose use cases enforce authorization (e.g. ownership checks) before mutating/deleting. Implement the interface in `server.ts`, wire it in `src/lib/server/services.ts`, and test the rules in `service.test.ts` with an in-memory repository.
4. **Contract**: Create `src/lib/features/your-feature/contract.ts` with an interface describing the feature's client API surface. Add `contract.test.ts` that runs the contract suite (see `testing/items-api-contract.ts`) against every implementation, including a fake in `testing/`.
5. **API / Endpoint**: Create `src/routes/api/your-feature/+server.ts` (calling the service from `#lib/server/services.js`, never `server.ts` directly) and `src/lib/features/your-feature/api.ts` implementing the `contract.ts` interface.
6. **Queries**: Create `src/lib/features/your-feature/queries.ts` with query key factory and custom query/mutation hooks, each taking the contract implementation as an optional parameter that defaults to `useYourFeatureApi()` from `context.ts`. Provide the real implementation once in `src/routes/+layout.svelte` with `setYourFeatureApi(yourFeatureApi)`.
7. **Components**: Build UI in `src/lib/features/your-feature/components/` using primitives from `src/lib/components/ui/` and `toast` from `svelte-sonner`.
8. **Route**: Create `src/routes/(protected)/your-feature/+page.svelte` (and `+page.server.ts` for server prefetching — load through the service from `#lib/server/services.js`, never `server.ts`).
9. **Navigation**: Add route link in `src/routes/(protected)/+layout.svelte`.
10. **Validate**: Run `npx @sveltejs/mcp svelte-autofixer` on `.svelte` files and verify with `bash scripts/check.sh`.
