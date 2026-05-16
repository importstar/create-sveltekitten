# create-sveltekitten

Scaffold a SvelteKit project with opinionated defaults for SSR or SPA.

## Usage

```bash
pnpx github:importstar/create-sveltekitten
```

The CLI will prompt for:

1. **Project name** — used as the folder name and `package.json` name
2. **Template** — SSR or SPA (see below)
3. **Backend base URL** — default `http://localhost:9000`

Then run:

```bash
cd <project-name>
pnpm install
pnpm dev
```

## Templates

### SSR

Server-side rendering via `adapter-node`.

| What      | Detail                                                  |
| --------- | ------------------------------------------------------- |
| Adapter   | `@sveltejs/adapter-node`                                |
| Auth      | Server-side, cookie-based                               |
| API proxy | SvelteKit server routes forward to backend              |
| Logger    | `pino` + `pino-pretty`                                  |
| API types | `openapi-typescript` → `src/lib/api/paths/fastapi.d.ts` |

**Environment variables (`.env`)**

```
PUBLIC_APP_TITLE=my-app
BACKEND_API_URL=http://localhost:9000
```

**After backend changes** — regenerate OpenAPI types:

```bash
pnpm openapi:fastapi
```

---

### SPA

Static output via `adapter-static`. Auth and API calls handled entirely client-side.

| What          | Detail                                            |
| ------------- | ------------------------------------------------- |
| Adapter       | `@sveltejs/adapter-static`                        |
| Auth          | Client-side, JWT stored in memory                 |
| Data fetching | TanStack Query v6                                 |
| API types     | `openapi-typescript` → `src/lib/api/openapi.d.ts` |

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

- SvelteKit 2 · Svelte 5
- TypeScript 6
- TailwindCSS 4
- bits-ui · shadcn-svelte components
- superforms + zod
- openapi-fetch for type-safe API calls
- ESLint + Prettier

## Scripts

| Script        | Description                    |
| ------------- | ------------------------------ |
| `pnpm dev`    | Dev server on `0.0.0.0`        |
| `pnpm build`  | Production build               |
| `pnpm check`  | Type-check with `svelte-check` |
| `pnpm lint`   | Prettier + ESLint              |
| `pnpm format` | Auto-format                    |
