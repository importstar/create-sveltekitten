# Agent Instructions — SSR Template (Full-Stack)

## Start Here

Before doing any work, read `agent-role.md` in this directory. It contains the full project context: tech stack, auth pattern, feature structure, key constraints, and a new-feature checklist.

## Available Skills

Three skills are installed in `.agents/skills/`. Use them via your skill system:

- **svelte-core-bestpractices** — Svelte 5 runes patterns, snippets, reactivity rules. Use whenever writing or reviewing `.svelte` files.
- **svelte-code-writer** — Opinionated code generation for Svelte 5. Use when scaffolding new components or routes.
- **shadcn-svelte** — Pre-built shadcn-svelte component catalog. Use when adding UI components from `src/lib/components/ui/`.

## Svelte MCP Tools

You have access to the Svelte MCP server for live Svelte 5 / SvelteKit documentation.

### 1. list-sections

Use this FIRST to discover available documentation sections.
When asked about Svelte or SvelteKit topics, ALWAYS call this before answering.

### 2. get-documentation

Fetches full documentation for specific sections.
After `list-sections`, fetch ALL sections relevant to the task — especially check `use_cases`.

### 3. svelte-autofixer

Analyzes Svelte code for issues and suggestions.
You MUST run this on every `.svelte` file before delivering it. Keep calling until no issues remain.

### 4. playground-link

Generates a Svelte Playground link.
Only call after user confirms they want one. NEVER call if code was written to project files.

## SSR Full-Stack Notes

This project is the **full-stack** mode of the SSR template: SvelteKit owns the data, the users and the business rules. There is no FastAPI backend, no `/api/proxy`, and no OpenAPI client.

- **Database**: SQLite via `better-sqlite3` + `drizzle-orm` in `src/lib/server/db/`.
- **Database CLI**: `pnpm db:push` pushes schema changes to `sqlite.db`; `pnpm db:studio` inspects data.
- **Auth**: server-side cookie sessions (`session_id`) stored in SQLite. `locals.user` / `locals.session` are set by `src/lib/hooks/auth-guard.ts`.
- **Users**: login never creates users. Create accounts with `pnpm user:create <username>`.
- **Business rules** live in `src/lib/features/<name>/service.ts`; routes call services from `#lib/server/services.js`, never the Drizzle repository (`server.ts`) directly.
- Protected pages go inside `src/routes/(protected)/` — the auth guard runs automatically via `hooks.server.ts`.
- Logger: `import { logger } from '#lib/logger.js'` — use instead of `console.log`.
- **Running `node build`**: adapter-node assumes `https` and does not read `ORIGIN`. Over plain http, or behind a proxy, set `PROTOCOL_HEADER` / `HOST_HEADER` (e.g. `x-forwarded-proto`) or `paths: { origin }` in `sveltekit({ ... })`, or form posts fail the CSRF check with 403.
