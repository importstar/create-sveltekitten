# create-sveltekitten

Scaffold a SvelteKit project with opinionated defaults for SSR or SPA.

## Usage

```bash
pnpx github:importstar/create-sveltekitten
```

The CLI will prompt for:

1. **Project name** — used as the folder name and `package.json` name
2. **Template** — SSR or SPA (see below)
3. **SSR mode** — full-stack (SQLite) or OpenAPI BFF (SSR only)
4. **Backend base URL** — default `http://localhost:9000` (SPA and SSR OpenAPI)

Then run:

```bash
cd <project-name>
pnpm install
pnpm dev
```

### Non-interactive

Pass any of these flags to skip its prompt; the CLI asks only for what is missing.

| Flag | Values |
| --- | --- |
| `--name <name>` | project folder and `package.json` name |
| `--template <t>` | `ssr` or `spa` |
| `--mode <m>` | `fullstack` or `openapi` (SSR only). `fastapi` is rejected. |
| `--pm <pm>` | `bun` or `pnpm`. Overrides detection. `--yes` without `--pm` uses bun. |
| `--backend-url <url>` | backend base URL for SPA and SSR `openapi`, default `http://localhost:9000` |
| `--yes` | never prompt: `--name`, `--template` and (for SSR) `--mode` are required, and an existing folder is an error instead of an overwrite |

```bash
pnpx github:importstar/create-sveltekitten --name my-app --template ssr --mode openapi --backend-url http://localhost:9000 --yes
```

Invalid or missing values exit with code 1 and say what is allowed.

## Templates

### SSR

Server-side rendering via `adapter-node`. The CLI asks for one of two modes (`--mode`), and the project contains only that mode's code and dependencies.

| What      | Full-stack (`--mode fullstack`)                      | OpenAPI BFF (`--mode openapi`)                                  |
| --------- | ---------------------------------------------------- | --------------------------------------------------------------- |
| Adapter   | `@sveltejs/adapter-node`                             | `@sveltejs/adapter-node`                                        |
| Data      | SQLite via `better-sqlite3` + Drizzle ORM            | The API in the OpenAPI spec, through `/api/proxy/**` with `openapi-fetch` |
| Auth      | Server-side sessions (`session_id` cookie) in SQLite | JWTs in httpOnly cookies; `/login` calls `POST /v1/auth/login`  |
| Rules     | `service.ts` per feature, in SvelteKit               | In the API only: no business rules in SvelteKit                 |
| API types | —                                                    | `openapi-typescript` → `src/lib/api/paths/openapi.d.ts`         |
| Logger    | `pino` (server-only), JSON with trace ids            | `pino` (server-only), JSON with trace ids                       |
| Tracing   | OpenTelemetry; exported only with `OTEL_EXPORTER_OTLP_ENDPOINT` | OpenTelemetry; exported only with `OTEL_EXPORTER_OTLP_ENDPOINT` |

**Environment variables (`.env`)**

```
# fullstack
PUBLIC_APP_TITLE=my-app
DATABASE_URL=sqlite.db

# openapi
PUBLIC_APP_TITLE=my-app
BACKEND_API_URL=http://localhost:9000
```

Optional in both SSR modes: `LOG_LEVEL` (default `debug` in dev, `info` otherwise), `OTEL_EXPORTER_OTLP_ENDPOINT` (an OTLP/HTTP collector; without it no span leaves the process) and `OTEL_SERVICE_NAME`.

**Full-stack: create the first user.** Users live in the local SQLite database and `/login` never creates them. Create each account from the project folder. The script prompts for the password without echoing it:

```bash
pnpm user:create admin
```

In CI, pipe the password instead: `printf '%s\n' "$PASSWORD" | pnpm user:create admin`. The command exits 1 if the username already exists.

**OpenAPI BFF: after backend changes**, regenerate the OpenAPI types (they are also generated on `pnpm install`):

```bash
pnpm openapi:update    # fetch the spec from the backend, then regenerate
pnpm openapi:generate  # regenerate from the committed src/libs/api-specs/openapi.json
```

The items example calls `/v1/items` on the API; the committed spec includes those endpoints, and `e2e/mock-api.js` serves them for `pnpm test:e2e`. Replace both with your backend's. Login stays `POST /v1/auth/login` with `strategy: 'jwt'`.

**Projects created before 1.0.0** have both modes' files. See the 1.0.0 entry in `CHANGELOG.md` for what you can delete.

---

### SPA

Static output via `adapter-static`. Auth and API calls handled entirely client-side.

| What          | Detail                                                            |
| ------------- | ----------------------------------------------------------------- |
| Adapter       | `@sveltejs/adapter-static`                                        |
| Auth          | Client-side, access token in `localStorage` (readable by any XSS) |
| Data fetching | TanStack Query v6                                                 |
| API types     | `openapi-typescript` → `src/lib/api/openapi.d.ts`                 |

**Environment variables (`.env`)**

```
PUBLIC_APP_TITLE=my-app
PUBLIC_API_URL=http://localhost:9000
```

**After backend changes** — regenerate OpenAPI types:

```bash
pnpm openapi
```

---

## Common stack (both templates)

- SvelteKit 3 · Svelte 5
- TypeScript 6
- TailwindCSS 4
- bits-ui · shadcn-svelte components
- superforms + zod
- openapi-fetch for type-safe API calls (SPA and SSR OpenAPI)
- ESLint + Prettier

## Feature architecture

Every domain feature lives in `src/lib/features/<name>/`, structured so it stays swappable and testable:

| File | Purpose |
| --- | --- |
| `schema.ts` | Zod schemas + inferred TypeScript types |
| `contract.ts` | Interface for the feature's API surface (e.g. `ItemsApi`) — `queries.ts` depends on this, not on `api.ts` directly |
| `api.ts` | Concrete client implementation of the port (HTTP calls, or an in-memory mock for SPA examples) |
| `server.ts` *(SSR full-stack only)* | Repository: raw Drizzle queries, no business rules |
| `service.ts` *(SSR full-stack only)* | Use-case layer between the route and the repository — this is where authorization/business rules live (e.g. verifying a row belongs to the requesting user) |
| `queries.ts` | TanStack Query key factory + hooks, defaulting to the real port implementation but overridable (e.g. for tests) |
| `components/` | Feature UI |

`src/lib/features/items/` is the reference implementation of this pattern in every template. SSR full-stack additionally shows the `service.ts` layer enforcing per-item ownership before a route handler is allowed to mutate or delete it. SSR OpenAPI has no `server.ts` or `service.ts`: `api.ts` calls the API, which owns the rules, and `dto.ts` maps its responses to the UI types.

## Scripts

| Script | Description |
| --- | --- |
| `pnpm dev` | Dev server on `0.0.0.0` |
| `pnpm build` | Production build |
| `pnpm check` | Type-check with `svelte-check` |
| `pnpm lint` | Prettier + ESLint |
| `pnpm format` | Auto-format |
| `pnpm test:unit` | Vitest unit tests |
| `bash scripts/check.sh` | Run before merging: `lint`, `check`, `test:unit` in order; stops at the first failing step and names it. SSR OpenAPI adds a step after `lint` that fails when `src/lib/api/paths/openapi.d.ts` is out of date with `src/libs/api-specs/openapi.json` (fix: `pnpm openapi:generate`) |
