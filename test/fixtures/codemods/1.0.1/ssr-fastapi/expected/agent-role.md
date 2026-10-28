# Agent Role: SvelteKit SSR Agent (FastAPI BFF)

You are a subagent working on a SvelteKit web application built from the **sveltekitten** SSR template. This project is the template's **BFF** (backend-for-frontend) mode: a FastAPI backend owns the data, the users and every business rule; SvelteKit renders pages, holds the tokens in httpOnly cookies and forwards API calls to FastAPI. Your job is to implement, modify, and debug frontend features while respecting the conventions of this template.

## The one rule: no business rules in SvelteKit

Anything that decides what a user may do or what data is valid lives in FastAPI: authorization, ownership checks, state transitions, validation that protects data, pricing, quotas. SvelteKit code may validate a form for a nicer error message and shape data for display, but it never makes a decision FastAPI does not also enforce. There is no database here, no repository and no service layer; if a feature needs a rule, add or change the FastAPI endpoint and call it.

## Tech Stack

- **SvelteKit v2** + **Svelte 5** (runes mode) + **Vite 8**, deployed via `@sveltejs/adapter-node`
- **TypeScript** throughout
- **openapi-fetch** typed against `src/lib/api/paths/fastapi.d.ts`, generated from `src/libs/api-specs/fastapi.json` by `openapi-typescript`
- **Tailwind CSS v4** (via `@tailwindcss/vite` plugin — no separate config file)
- **bits-ui** as the headless primitive layer; shadcn-style components in `src/lib/components/ui/`
- **TanStack Query** (`@tanstack/svelte-query`) for client-side data fetching & mutations — `QueryClientProvider` is wired in the root layout
- **Superforms + Zod** for server-validated forms
- **pino** for logging (`src/lib/logger.ts`)
- **svelte-sonner** for toast notifications (placed in root layout)

## How a request reaches FastAPI

- Server code (`+page.server.ts`, form actions) calls `event.locals.fastapiClient`; browser code calls the `fastapiClient` default export of `$lib/api/fastapi-client`. Both send requests to `/api/proxy/**`.
- `src/routes/api/proxy/[...slug]/+server.ts` forwards them to `BACKEND_API_URL` with `Authorization: Bearer <access_token cookie>`, never the browser's cookies. On a 401 it refreshes the access token once through `GET /v1/auth/refresh_token` (`src/lib/server/proxy/refresh.ts`) and retries.
- `/login` calls `POST /v1/auth/login` and stores the returned tokens; a rejected login sets no cookie. `/logout` clears them.
- `src/lib/hooks/auth-guard.ts` redirects `(protected)` pages to `/login` when there is no unexpired refresh token. It is a UX guard only: the token is decoded, not verified. FastAPI verifies every request.

## What You Can Do

- Add new routes under `src/routes/` using SvelteKit file-based routing
- Add pages that require authentication inside the `(protected)` route group
- Build UI components in `src/lib/components/ui/` following the existing `component.svelte` + `index.ts` pattern
- Call FastAPI endpoints that exist in `src/libs/api-specs/fastapi.json`; after backend changes run `pnpm openapi:update` (fetch the spec from the running backend and regenerate types) or `pnpm openapi:fastapi` (regenerate from the committed spec)
- Add new feature slices in `src/lib/features/<feature-name>/`

## Feature Structure Pattern

Every domain feature is self-contained in `src/lib/features/<feature-name>/`:

```text
src/lib/features/<feature-name>/
├── schema.ts           # Zod schemas (form validation) & the UI's TypeScript types
├── dto.ts              # Maps FastAPI response types (components['schemas'][...]) to the UI types
├── contract.ts         # Interface for the feature's client API surface (e.g. `ItemsApi`)
├── contract.test.ts    # Runs the shared contract suite against every implementation
├── testing/            # Test doubles (fake ItemsApi, fake FastAPI fetch) and the shared contract suite
├── api.ts              # Calls FastAPI through fastapiClient — implements contract.ts
├── context.ts          # createContext for the contract: set<Feature>Api() / use<Feature>Api() (falls back to api.ts)
├── queries.ts          # TanStack Query key factory + use<Query>/use<Mutation> hooks, reading the contract implementation from context
├── components/         # Feature-specific Svelte 5 components
└── index.ts            # Public barrel export
```

- `contract.ts` declares an interface that `api.ts` implements and that `queries.ts` depends on instead of importing `api.ts` directly. The root layout (`src/routes/+layout.svelte`) calls `setItemsApi(itemsApi)`; each hook defaults to it, e.g. `useItems(initialDataGetter?, itemsApi: ItemsApi = useItemsApi())`. A test calls `setItemsApi(createFakeItemsApi())` or passes an implementation to a single hook.
- `testing/items-api-contract.ts` spells out the promises beyond the type (e.g. `toggleItem` resolves with the full item, failures reject with a readable `Error`). `contract.test.ts` runs it against the fake and against the real `createItemsApi()` over `testing/fake-fastapi-items.ts`, an in-memory stand-in for the FastAPI endpoints.
- `api.ts` turns FastAPI errors (`{ detail }`) into `Error`s and responses into UI types via `dto.ts`. It holds no rules: ownership and validation are FastAPI's.

### Canonical Reference Example

- `src/lib/features/items/` — CRUD feature over `GET/POST /v1/items` and `PATCH/DELETE /v1/items/{item_id}`.
- `src/routes/(protected)/items/+page.server.ts` — server prefetch through `locals.fastapiClient`, hydrated on the client through `initialData`.
- `e2e/mock-api.js` — the mock FastAPI used by `pnpm test:e2e`; add the endpoints a new e2e test needs here.

## Key Constraints

- **No business rules in SvelteKit** (see above).
- **No database, no local users.** Users and credentials live in FastAPI.
- **Protected pages must live inside `(protected)/`** — the route guard checks `(protected)` in the route ID.
- **Svelte 5 runes only** — no legacy Svelte 4 syntax.
- **Run `svelte-autofixer` before finalizing any `.svelte` file**:
  ```bash
  npx @sveltejs/mcp svelte-autofixer ./src/path/to/Component.svelte
  ```
- **Type-check and unit-test before finishing**: `pnpm check && pnpm test:unit`
- **E2E**: `pnpm test:e2e` installs the browser Playwright needs on first run (network required once), then builds and runs `e2e/` against `e2e/mock-api.js`.

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

1. **Backend first**: make sure FastAPI has the endpoints, with their rules, and that `src/libs/api-specs/fastapi.json` has them (`pnpm openapi:update`).
2. **Schema**: Create `src/lib/features/your-feature/schema.ts` with Zod schemas for forms and the UI types.
3. **DTO**: Create `dto.ts` mapping `components['schemas'][...]` from `$lib/api/paths/fastapi` to the UI types.
4. **Contract**: Create `contract.ts` with an interface describing the feature's client API surface. Add `contract.test.ts` that runs the contract suite against every implementation, including a fake in `testing/`.
5. **API**: Create `api.ts` implementing `contract.ts` with `fastapiClient`. No rules here.
6. **Queries**: Create `queries.ts` with a query key factory and hooks taking the contract implementation as an optional parameter defaulting to `useYourFeatureApi()` from `context.ts`. Provide the real implementation once in `src/routes/+layout.svelte` with `setYourFeatureApi(yourFeatureApi)`.
7. **Components**: Build UI in `src/lib/features/your-feature/components/` using primitives from `$lib/components/ui/` and `toast` from `svelte-sonner`.
8. **Route**: Create `src/routes/(protected)/your-feature/+page.svelte` (and `+page.server.ts` prefetching through `locals.fastapiClient`).
9. **Navigation**: Add route link in `src/routes/(protected)/+layout.svelte`.
10. **Validate**: Run `npx @sveltejs/mcp svelte-autofixer` on `.svelte` files and verify with `pnpm check` and `pnpm test:unit`.
