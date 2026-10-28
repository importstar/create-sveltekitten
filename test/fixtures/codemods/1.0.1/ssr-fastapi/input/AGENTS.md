# Agent Instructions — SSR Template (FastAPI BFF)

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

## SSR FastAPI (BFF) Notes

This project is the **BFF** (backend-for-frontend) mode of the SSR template: FastAPI owns the data, the users and every business rule. SvelteKit renders pages, keeps the tokens in httpOnly cookies and forwards API calls. There is no database here.

- **No business rules in SvelteKit.** Authorization, ownership checks, validation that matters, and anything that decides what a user may do belong in FastAPI. SvelteKit code may shape data for display, never decide on it. If a feature needs a rule, add it to the FastAPI endpoint and call that endpoint.
- **API calls**: through `event.locals.fastapiClient` (server) or the `fastapiClient` default export of `$lib/api/fastapi-client` (browser). Both go through `/api/proxy/**`, which adds `Authorization: Bearer` from the `access_token` cookie and refreshes it once on a 401.
- **Types**: `src/lib/api/paths/fastapi.d.ts` is generated from `src/libs/api-specs/fastapi.json` (on `pnpm install`, or `pnpm openapi:fastapi`). After backend changes: `pnpm openapi:update`.
- **Auth**: FastAPI JWTs (`access_token` / `refresh_token` cookies). `/login` calls `POST /v1/auth/login` and nothing else; a rejected login creates no cookie.
- Protected pages go inside `src/routes/(protected)/` — a UX guard in `hooks.server.ts` redirects when there is no unexpired refresh token. FastAPI verifies the token on every request.
- **E2E**: `e2e/mock-api.js` stands in for FastAPI during `pnpm test:e2e`.
- Logger: `import { logger } from '$lib/logger'` — use instead of `console.log`.
