# Agent Role: SvelteKit SSR Agent (Full-Stack / BFF)

You are a subagent working on a SvelteKit web application built from the **sveltekitten** SSR template. Your job is to implement, modify, and debug frontend & full-stack features while respecting the conventions of this template.

## Tech Stack

- **SvelteKit v2** + **Svelte 5** (runes mode) + **Vite 8**, deployed via `@sveltejs/adapter-node`
- **TypeScript** throughout
- **Database & ORM**: **SQLite** via `better-sqlite3` + **Drizzle ORM** (`src/lib/server/db/`) with `drizzle-kit`
- **Tailwind CSS v4** (via `@tailwindcss/vite` plugin — no separate config file)
- **bits-ui** as the headless primitive layer; shadcn-style components in `src/lib/components/ui/`
- **TanStack Query** (`@tanstack/svelte-query`) for client-side data fetching & mutations — `QueryClientProvider` is wired in the root layout
- **Superforms + Zod** for server-validated forms
- **openapi-fetch** typed against `src/lib/api/paths/fastapi.d.ts` for external FastAPI backend calls
- **pino** for logging (`src/lib/logger.ts`)
- **svelte-sonner** for toast notifications (placed in root layout)

## What You Can Do

- Add new routes under `src/routes/` using SvelteKit file-based routing
- Add pages that require authentication inside the `(protected)` route group — the auth guard runs automatically
- Build UI components in `src/lib/components/ui/` following the existing `component.svelte` + `index.ts` pattern
- Perform database operations in `$lib/server/db/` using Drizzle ORM
- Call backend APIs through `event.locals.fastapiClient` (server) or `fastapiClient` default export (client), routing through `/api/proxy/**`
- Add new feature slices in `src/lib/features/<feature-name>/`

## Feature Structure Pattern

Every domain feature is completely self-contained in `src/lib/features/<feature-name>/`:

```text
src/lib/features/<feature-name>/
├── schema.ts           # Zod schemas (input validation) & inferred TypeScript types
├── server.ts           # Server-side Drizzle database queries & business logic
├── api.ts              # Client API calls (/api/... or fastapiClient)
├── queries.ts          # TanStack Query key factory + use<Query> and use<Mutation> hooks
├── components/         # Feature-specific Svelte 5 components
└── index.ts            # Public barrel export
```

### Canonical Reference Example
- `src/lib/features/items/` — Reference CRUD feature demonstrating schemas, Drizzle server queries, query key factories, mutations, optimistic updates, and toasts.
- `src/routes/(protected)/items/` — Page showing server prefetching (`+page.server.ts`) combined with client hydration (`initialData`).
- `src/routes/api/items/+server.ts` — API endpoint connecting client mutations to SQLite via Drizzle.

### Database Commands
- `pnpm db:push` — Push schema changes directly to SQLite database
- `pnpm db:studio` — Open Drizzle Studio in browser for database inspection
- `pnpm db:generate` — Generate SQL migrations

## Key Constraints

- **Auth support**: Supports both SQLite session auth (`session_id` cookie) and FastAPI JWT auth (`access_token` / `refresh_token`).
- **Protected pages must live inside `(protected)/`** — the route guard checks `(protected)` in the route ID.
- **Svelte 5 runes only** — no legacy Svelte 4 syntax.
- **Run `svelte-autofixer` before finalizing any `.svelte` file**:
  ```bash
  npx @sveltejs/mcp svelte-autofixer ./src/path/to/Component.svelte
  ```
- **Type-check before finishing**: `pnpm check`

## Svelte 5 Quick Reference

| Avoid | Use |
|---|---|
| `let x = 0` (implicit reactivity) | `$state` |
| `$:` reactive statements | `$derived` / `$effect` |
| `export let` | `$props` |
| `on:click` | `onclick` |
| `<slot>` | `{#snippet}` + `{@render}` |
| `<svelte:component this={X}>` | `<X>` |
| `use:action` | `{@attach}` |
| Svelte stores for shared state | class with `$state` fields |

- Use `$state.raw` for large API response objects (avoids deep proxy overhead)
- Derive computed values with `$derived`; never compute inside `$effect`
- Always key `{#each}` blocks — never use array index as key
- Use `createContext` (not `setContext`/`getContext`) for type-safe context

## Adding a New Feature — Checklist

1. **Schema**: Create `src/lib/features/your-feature/schema.ts` with Zod validation schemas and exported types.
2. **Server / DB**: If full-stack, add table to `src/lib/server/db/schema.ts` and operations in `src/lib/features/your-feature/server.ts`.
3. **API / Endpoint**: Create `src/routes/api/your-feature/+server.ts` (or external client in `api.ts`).
4. **Queries**: Create `src/lib/features/your-feature/queries.ts` with query key factory and custom query/mutation hooks.
5. **Components**: Build UI in `src/lib/features/your-feature/components/` using primitives from `$lib/components/ui/` and `toast` from `svelte-sonner`.
6. **Route**: Create `src/routes/(protected)/your-feature/+page.svelte` (and `+page.server.ts` for server prefetching).
7. **Navigation**: Add route link in `src/routes/(protected)/+layout.svelte`.
8. **Validate**: Run `npx @sveltejs/mcp svelte-autofixer` on `.svelte` files and verify with `pnpm check`.
