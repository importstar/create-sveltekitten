# Changelog

## 2.2.0

**The SSR BFF mode is `openapi`.** `--mode fastapi` is rejected on scaffold and on patch. A project whose `.sveltekitten.json` still says `"ssrMode": "fastapi"` is left unchanged: set it to `"openapi"` and run `patch` again. After that, codemods tagged `fastapi` and `openapi` both apply.

The sample login contract is unchanged: `POST /v1/auth/login` with `strategy: 'jwt'`, `access_token` / `refresh_token` cookies, `Authorization: Bearer`, refresh on 401, and a JWT `exp` check in the BFF. The committed specs only change `info.title` to `API`. Hospital and pet paths stay.

```bash
pnpx create-sveltekitten patch
```

## 2.1.1

**Fix: `src/instrumentation.server.ts` reads `OTEL_*` from `process.env`.** That file runs before `Server.init()` populates `$app/env`, so imports from `$app/env/private` were `undefined` and `.replace` could throw (sveltejs/kit#14286). The vars stay declared in `src/env.ts`; only instrumentation switches to `process.env`.

```bash
pnpx create-sveltekitten patch
```

## 2.1.0

**Structured server logs tied to OpenTelemetry tracing** (issue #16), in both SSR modes. SPA projects have no server, so they get no logger; their `agent-role.md` now says so.

- **The logger is server-only**: `src/lib/logger.ts` moved to `src/lib/server/logger.ts`; import it from `#lib/server/logger.js`. Importing it from browser code now fails the build (SvelteKit's `server_only_import`) instead of bundling pino into the client. `logger.inspect`, `logger.dir` and `logger.table` are gone: they printed whole objects with `console.log`, past redaction.
- **Every line carries `trace_id` / `span_id`** of the active span. `tracing: { server: true }` in `vite.config.ts` turns on SvelteKit's spans, and the new `src/instrumentation.server.ts` registers the OpenTelemetry SDK. Spans always get real ids; they are exported over OTLP/HTTP only when `OTEL_EXPORTER_OTLP_ENDPOINT` is set (to `<endpoint>/v1/traces`), so without it nothing is sent and nothing fails. New optional variables in `src/env.ts`: `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_SERVICE_NAME` (default `sveltekitten`) and `LOG_LEVEL` (default `debug` in dev, `info` otherwise).
- **One request line**: `handleRequestLog` (`src/lib/hooks/request-log.ts`, first in `sequence(...)`) logs method, route id (never the URL), status and `duration_ms`, with the ids of the `sveltekit.handle.root` span.
- **`handleError` logs unexpected errors once** (`error` level, with stack and trace id) and gives every error response an `errorId`: the trace id. `App.Error` has `errorId?: string`, and the error page shows it. It is optional because a required property would make every `error(status, message)` call a type error.
- **Redaction** covers `password`, `token`, `access_token`, `refresh_token`, `cookie`, `set-cookie` and `authorization`, at the top level and one level down.
- **What each mode logged before, and now**: the full-stack login printed the error object with `console.log` (dev only) through `logger.inspect`; it now logs `error` with the error, and `debug` lines with the outcome only. The FastAPI proxy logged every forwarded URL, query string included, at `info`; it now logs the method and path at `debug`, and the request line covers routine traffic. A missing `BACKEND_API_URL` is logged by `handleError` instead of twice. Neither login logs a password, token or cookie at any level; `src/routes/login/page.server.test.ts` checks it in each mode.
- New dependencies (server runtime, in `dependencies`): `@opentelemetry/api` `~1.9.1`, `@opentelemetry/sdk-trace`, `@opentelemetry/context-async-hooks`, `@opentelemetry/core`, `@opentelemetry/resources` (`^2.12.0`) and `@opentelemetry/exporter-trace-otlp-http` (`^0.223.0`). `@opentelemetry/api` stays on 1.9 because `@opentelemetry/sdk-trace` 2.x does not accept 1.10.

Update existing projects:

```bash
pnpx create-sveltekitten patch
pnpm install                 # pnpm-lock.yaml cannot be patched
pnpm check && pnpm test:unit
```

The patch adds the new files (instrumentation, logger, hooks and their tests), deletes `src/lib/logger.ts` if you did not edit it, moves the logger import in the template files that use it, and adds the dependencies to `package.json` (tab-indented JSON only; otherwise it warns with the list). An edited `hooks.server.ts`, `vite.config.ts` or `src/env.ts` is left alone with a warning that says what to add. After writing, it lists your own files that still import `#lib/logger.js` or call `logger.inspect` / `dir` / `table`; switch them to `#lib/server/logger.js` and structured fields.

## 2.0.0

**Breaking: every template now uses SvelteKit 3** (issue #15). Node 22.17 or later is required (SvelteKit 3's own minimum; SPA projects said `>=20`, SSR `>=22`).

What changed in the templates (SSR full-stack, SSR FastAPI and SPA):

- `@sveltejs/kit` `^3.1.0`, `@sveltejs/adapter-node` `^6.0.0` / `@sveltejs/adapter-static` `^4.0.0`, `sveltekit-superforms` `^3.0.0` (2.x does not accept Kit 3) and `formsnap` `^2.1.0`. `@sveltejs/vite-plugin-svelte` (`^7.3.1`), `svelte`, `vite` and `typescript` already met Kit 3's minimums.
- `svelte.config.js` is gone; Kit 3 refuses to start while it exists. The adapter and `vitePreprocess()` are passed to `sveltekit({ ... })` in `vite.config.ts`, and `eslint.config.js` no longer imports the file.
- `$lib` is now `#lib`, declared in the `imports` field of `package.json`, and every `#lib` import has its file extension (`#lib/logger.js`, `#lib/components/ui/button/index.js`). `components.json` uses `#lib` for shadcn-svelte.
- `tsconfig.json` extends `$app/tsconfig` and lists its own `include`.
- Hook types (`Handle`) are imported from `@sveltejs/kit/hooks`.
- Environment variables are declared in a new `src/env.ts` (`defineEnvVars`) and read from `$app/env/public` / `$app/env/private`; `$app/environment` is now `$app/env`. The `$env/*` modules and `$app/environment` still work in Kit 3 but print deprecation warnings.
- `resolve()` paths have no leading slash (`resolve('home')`).
- Full-stack route handlers return `Response.json(...)` instead of the deprecated `json(...)`.
- adapter-node 6 ignores `ORIGIN` and assumes `https` unless `PROTOCOL_HEADER` names a header. The SSR e2e config now sends `x-forwarded-proto: http` with `PROTOCOL_HEADER=x-forwarded-proto` instead of setting `ORIGIN`. **If you deploy with `ORIGIN`**, set `paths: { origin }` in `sveltekit({ ... })` or `PROTOCOL_HEADER` / `HOST_HEADER` behind your proxy; otherwise form posts over plain http fail the CSRF check with 403.
- Checked and unaffected: every cookie the templates set already passes `path: '/'`; no form action uses `fail()`; no endpoint returns a 204 body the client reads; no remote functions (`form.error`); `page.url` is only read; no `$app/stores`.

Update existing projects. `patch` changes only files the template created; your own code is migrated by SvelteKit's tool:

```bash
pnpx create-sveltekitten patch       # template files → 2.0.0
pnpm install                         # pnpm-lock.yaml cannot be patched
git commit -am "chore: create-sveltekitten 2.0.0"
npx sv migrate sveltekit-3           # your own code: $lib → #lib, hook types, $env, $app/stores, …
pnpm check && pnpm build
```

The patch updates the versions, `engines.node` and `imports` in `package.json` (only if it is tab-indented JSON like the template), moves the config into `vite.config.ts`, deletes `svelte.config.js`, adds `src/env.ts`, and rewrites the imports and docs of each template file that still has the 1.1.4 lines; a file you edited is left alone with a warning. After writing, it lists every source file that still uses `$lib`, `$app/stores`, `$app/environment`, `$env/*`, `svelte.config.js` or hook types from `@sveltejs/kit`: run `npx sv migrate sveltekit-3` for those (it leaves the files `patch` already migrated as they are, and writes `MIGRATION_TASKS.md` with what it could not automate). If you edited `svelte.config.js` or `vite.config.ts`, `patch` keeps them and warns; move the adapter and `preprocess` into `sveltekit({ ... })` by hand, or let `sv migrate` do it.

If `pnpm install` reports an unmet optional peer `@sveltejs/kit@^2.21.0` from `runed@0.35.1` (pulled in by `bits-ui`), it is harmless: `runed` only uses Kit in its `runed/kit` entry, which nothing in the templates imports. It goes away when `bits-ui` depends on a `runed` that accepts Kit 3.

## 1.1.4

Docs fix for SPA projects. `AGENTS.md` and `agent-role.md` said `authStore` keeps the access token in memory. It saves its whole state, access token included, to `localStorage` (`auth_state`) so a reload keeps you signed in. Both files now say so and add one line on the risk: any injected script can read the token, so never render untrusted HTML with `{@html}`. Nothing about how auth works changed.

Update existing projects with:

```bash
pnpx create-sveltekitten patch
```

The patch rewrites the auth line in each file only if it is unchanged from 1.1.3.

## 1.1.3

`@tanstack/svelte-query-devtools` moved from `dependencies` to `devDependencies` in every template and mode, and `openapi-typescript` with it in SPA and SSR FastAPI (BFF) projects (full-stack projects do not use it). `openapi-typescript` only generates types, and the devtools component is bundled into the build, so `pnpm install --prod` no longer installs either. The SSR server still starts from a production-only install.

Update existing projects with:

```bash
pnpx create-sveltekitten patch
pnpm install
```

The patch moves the entries in `package.json` and keeps the versions you have. It only rewrites a tab-indented `package.json` (as the template has it); for any other formatting it leaves the file alone and asks you to move them by hand. Run `pnpm install` afterwards so `pnpm-lock.yaml` matches; until then `pnpm install --frozen-lockfile` fails.

## 1.1.2

**Security fix. After this patch every signed-in user has to log in again.**

SSR full-stack projects stored the session token from the `session_id` cookie as the `id` of its row in the `sessions` table. Anyone who could read the database (a backup, a copied `sqlite.db`, a SQL injection elsewhere) could use those ids as cookies and sign in as any user. The table now stores `sha256(token)`. The cookie still carries the raw token. `createSession`, `validateSessionToken` and `invalidateSession` still take the raw token and hash it inside, using the new `hashSessionToken(token)` in `src/lib/server/auth/session.ts`.

Sessions created before the patch hold the raw token, so they no longer match. `validateSessionToken` returns no session for them, the auth guard clears the cookie, and the user is sent to `/login`. Nothing fails with a 500. The old rows stay in the table and are never matched again; delete them with `DELETE FROM sessions;` if you want them gone.

A new `src/lib/server/auth/session.test.ts` covers storing, validating and invalidating hashed sessions, and rejecting an old unhashed one.

Update existing projects with:

```bash
pnpx create-sveltekitten patch
```

The patch replaces `src/lib/server/auth/session.ts` only if it is unchanged from 1.1.1. If you edited it, hash the token with `sha256` wherever it is written to or looked up in `sessions.id`.

## 1.1.1

New items in SSR full-stack projects get a UUID v4 id from `crypto.randomUUID()`. `insertItem` used `Math.random().toString(36)`, a 7-character id that is predictable and can collide. Existing rows keep their ids.

Update existing projects with:

```bash
pnpx create-sveltekitten patch
```

The patch changes the id line in `src/lib/features/items/server.ts` only if it is unchanged from 1.1.0.

## 1.1.0

**New: `scripts/check.sh`** in every template and mode, the one command that says whether a change is ready to merge:

```bash
bash scripts/check.sh
```

It runs `pnpm lint`, `pnpm check` and `pnpm test:unit` in that order, stops at the first failing step and prints `check.sh: FAILED at step: <name>`. It exits 0 only when every step passes. Playwright is not part of it (too slow for the edit loop); run `pnpm test:e2e` separately.

In SSR FastAPI (BFF) projects it also checks, right after `lint`, that `src/lib/api/paths/fastapi.d.ts` matches `src/libs/api-specs/fastapi.json`. It regenerates the types into place, compares them with the copy you had, and puts your copy back; when they differ it fails and tells you to run `pnpm openapi:fastapi`. This replaces the `git diff --exit-code src/lib/api` idea from the issue: the generated types are gitignored, so git cannot see them drift, and a fresh project has no git repository yet.

`agent-role.md` now says `bash scripts/check.sh` must pass before merging.

`pnpx create-sveltekitten patch` adds `scripts/check.sh` (run it with `bash`; patch does not set the executable bit) and updates the two lines in `agent-role.md` when they are unchanged.

## 1.0.1

**Bug fix**: `pnpm lint` failed on every freshly scaffolded project, and `pnpm check` failed on a fresh SPA project, so there was no clean baseline to check changes against.

- `.prettierignore` leaves out generated files: `src/lib/components/ui/` (shadcn-svelte writes them in its own style and `shadcn-svelte add` overwrites them), `skills-lock.json` and `src/libs/api-specs/` (the spec fetched from FastAPI). `eslint.config.js` ignores `src/lib/components/ui/` for the same reason.
- The hand-written files are formatted with the project's Prettier config (`AGENTS.md`, `agent-role.md`, `playwright.config.ts`, `e2e/mock-api.js`, `src/app.css`, the items components, the layouts and pages, and a few modules).
- ESLint errors fixed: links and `goto()` calls use `resolve()` from `$app/paths` (`svelte/no-navigation-without-resolve`); `src/lib/logger.ts` takes `unknown` instead of `any`; in the SPA, unused variables and imports are gone from `auth-interceptor.ts`, `client.ts` (`createFastApiClient` no longer takes an unused `event`), `auth.svelte.ts` and the login form, and the login form types its data with the OpenAPI `Token` and `UserResponse` schemas instead of `any`.
- SPA: `pnpm-lock.yaml` is deduplicated. It had a second copy of `zod` (4.4.3, pulled in by `sveltekit-superforms`), and `svelte-check` rejected `zod4(loginSchema)` in the login form because the two copies' types differ. The SSR lockfiles were deduplicated the same way in 1.0.0.

`pnpx create-sveltekitten patch` updates `.prettierignore` and `eslint.config.js`, and replaces each of the other files only while it is still exactly the 1.0.0 template. For files you have edited, run `pnpm format` and fix what `pnpm lint` reports by hand. In an SPA project, also run `pnpm dedupe` (patch never edits lockfiles). Then `pnpm lint && pnpm check` should pass.

## 1.0.0

**Breaking change in template structure.** The SSR template is split by mode. A new SSR project has only the code and dependencies of the mode you pick:

- **Full-stack** (`--mode fullstack`): SQLite + Drizzle, session auth, the items service. No `/api/proxy`, FastAPI client, OpenAPI spec or scripts, `jsonwebtoken` or `openapi-fetch`. Login checks the local database only. The home page health check calls a new `/api/health` route instead of FastAPI. `.env` no longer has `BACKEND_API_URL`.
- **FastAPI BFF** (`--mode fastapi`): proxy, FastAPI client, OpenAPI spec and scripts. No database, `better-sqlite3`, Drizzle, `src/lib/server/auth`, or items `server.ts` / `service.ts`. Login calls FastAPI only. The `BACKEND_API_URL !== 'http://localhost:9000'` check is gone: with the default URL, login used to skip FastAPI and check an empty local database, so every login failed. A rejected login shows "Invalid username or password." and sets no cookie. The items example calls FastAPI's `/v1/items` through `fastapiClient` (added to the committed spec and to `e2e/mock-api.js`). The OpenAPI types are generated on `pnpm install`, so `pnpm check` passes on a fresh project. `.env` no longer has `DATABASE_URL`.
- Each mode has its own `package.json` and `pnpm-lock.yaml`. The lockfiles are deduplicated, which removes a second copy of `zod` that made `pnpm check` fail in both modes.
- Each mode has its own `AGENTS.md` and `agent-role.md`. The BFF one states the rule: no business rules in SvelteKit.
- `.sveltekitten.json` of every SSR project records `ssrMode`. `pnpx create-sveltekitten patch` in an SSR project without it asks for the mode (or takes `--mode fullstack|fastapi`) and saves it.

### Migrating a project created before 1.0.0

`pnpx create-sveltekitten patch` updates, when unchanged from 0.3.24:

- `src/routes/login/+page.server.ts`: FastAPI only in BFF projects, SQLite only in full-stack projects.
- `e2e/login.test.ts`: a rejected login must leave no `session_id`, `access_token` or `refresh_token` cookie.

It never deletes files, so your project keeps the other mode's code and dependencies. Everything keeps working as before. To remove them by hand, compare with a fresh scaffold of your mode (`pnpx create-sveltekitten --name tmp --template ssr --mode <mode> --yes`), then:

- **BFF projects**: you can delete `src/lib/server/db/`, `src/lib/server/auth/`, `src/lib/server/services.ts`, `src/lib/server/http.ts` (+ test), `src/lib/utils/api-core.ts`, `drizzle.config.ts`, `src/routes/api/items/`, and in `src/lib/features/items/` the `server.ts`, `service.ts`, `service.test.ts` and `testing/in-memory-repository.ts`; remove `better-sqlite3`, `@types/better-sqlite3`, `drizzle-orm`, `drizzle-kit`, `tsx`, the `db:*` scripts and `DATABASE_URL`. Session code in `auth-guard.ts`, `logout`, `app.d.ts` and `(protected)/+layout.server.ts` must go with it; copy those files from the fresh scaffold. Your items data was in SQLite; the new items example expects `/v1/items` on FastAPI.
- **Full-stack projects**: you can delete `src/routes/api/proxy/`, `src/lib/api/`, `src/lib/hooks/fastapi.hook.ts`, `src/lib/server/proxy/`, `src/libs/api-specs/`, `e2e/mock-api.js` and `e2e/proxy-refresh.test.ts`; remove `jsonwebtoken`, `@types/jsonwebtoken`, `openapi-fetch`, `openapi-typescript`, the `openapi*` scripts and `BACKEND_API_URL`. Copy `hooks.server.ts`, `app.d.ts`, `src/lib/utils/auth.ts`, `logout`, the `health` feature, `(protected)/home/+page.server.ts` and `src/routes/api/health/` from the fresh scaffold, since the old ones import the FastAPI client.

Then run `pnpm install && pnpm check && pnpm build`.

## 0.3.24

**Bug fix** for token refresh in SSR FastAPI (BFF) projects. When an access token expired, the `/api/proxy` route called `POST /v1/auth/refresh`. The FastAPI spec that ships with the template (`src/libs/api-specs/fastapi.json`) has no such endpoint, so a backend that matches it answered 404 or 405. The proxy then cleared the cookies and logged the user out about every 10 minutes.

- `src/lib/server/proxy/refresh.ts` now calls `GET /v1/auth/refresh_token` as the spec defines it. It sends the refresh token as the `refresh_token` cookie and as `Authorization: Bearer`. The response has only a new access token, so the existing `refresh_token` cookie is kept. Requests that share one refresh still work as in 0.3.23. Ordinary proxied requests still never carry the browser's cookies.
- `e2e/mock-api.js` now mocks `GET /v1/auth/refresh_token` and `GET /v1/users/me` as the spec does. A new `e2e/proxy-refresh.test.ts` covers refresh through the proxy. It is skipped in full-stack projects, which have no mock backend.

This follows the committed spec. If your backend still serves `POST /v1/auth/refresh`, keep your current `refresh.ts`.

Update existing projects with:

```bash
pnpx create-sveltekitten patch
```

The patch replaces `refresh.ts`, `refresh.test.ts` and `e2e/mock-api.js` only when they are unchanged from 0.3.23. If you edited them, port the changes by hand from the new template.

## 0.3.23

**Security and bug fix** in the SSR `/api/proxy` route. It matters most in FastAPI (BFF) projects, where all API traffic goes through the proxy.

- **Cookies no longer reach the backend.** The proxy forwarded the browser's `cookie` header, so the backend saw `access_token`, `refresh_token` and `session_id`. SvelteKit's `event.fetch` also re-attaches the app's cookies when the backend is on the same host or a subdomain, such as `api.example.com`. The proxy now strips the header and calls the backend with the global `fetch`. The backend gets only `Authorization: Bearer`.
- **Retries after a token refresh keep the request body.** When an access token had expired, the proxy refreshed it and retried with a request body it had already consumed. Every POST, PUT and PATCH failed with 502. The body is now buffered once and sent again on the retry.
- **One refresh call for concurrent 401s.** Requests that get a 401 at the same time with the same refresh token now share one `/v1/auth/refresh` call. A request that still carries the old token just after a rotation reuses the new pair for 10 seconds instead of sending a revoked token. The logic is in the new `src/lib/server/proxy/refresh.ts`.
- **Proxy paths that could escape the backend base path return 400.** This covers slugs with a `..` or `.` segment, such as `v1/..%2F..%2Fadmin`, and slugs that are absolute URLs. This only matters when `BACKEND_API_URL` has a path prefix.
- **The FastAPI-mode auth guard now says what it is.** A comment explains that it is a UX guard only. FastAPI verifies every proxied request.

Update existing projects with:

```bash
pnpx create-sveltekitten patch
```

The patch replaces the proxy route only when it is unchanged from 0.3.22. If you edited it, port the changes by hand from the new template.

## 0.3.22

`pnpm test:e2e` now runs `playwright install chromium` first. A fresh machine, or a Playwright upgrade, used to fail at browser launch until someone ran that command by hand, and neither template said so. When the browser is already installed the step finishes in about a second and needs no network. Applies to SSR and SPA projects.

Update existing projects with:

```bash
pnpx create-sveltekitten patch
```

The patch updates the `test:e2e` script only if it is unchanged from 0.3.21.

## 0.3.21

**Security fix.** In fullstack SSR projects, `/login` created a new account for any username it did not know, so anyone could sign in with any name. FastAPI (BFF) projects had the same hole: when the FastAPI login was skipped or failed, `/login` fell back to the local SQLite database and created the account there. Every SSR login also logged the submitted form, password included, at `info` level, which reaches production logs.

Login now only signs in existing users in both modes, and an unknown username gets the same "Invalid username or password." as a wrong password. FastAPI projects no longer create local users on a failed login. Fullstack projects create accounts with a new script, `pnpm user:create <username>`. The pino logger redacts `password`, `cookie`, and `authorization` fields.

Update existing projects with:

```bash
pnpx create-sveltekitten patch
pnpm install
pnpm user:create <username>   # fullstack only, for each new account
```

`pnpm install` picks up `tsx`, which runs the script. Existing accounts keep working with their current passwords. The `user:create` script only applies to projects whose `.sveltekitten.json` has `"ssrMode": "fullstack"`. Every SSR project stops creating users on login and stops logging passwords. The patch rewrites `src/routes/login/+page.server.ts` only when it is unchanged from 0.3.20. An edited login file still loses the password log line, but you must remove the account creation from it yourself.

## 0.3.20

**Security fix.** In fullstack SSR projects, the auth guard let any `refresh_token` cookie with a future `exp` into `(protected)` routes. The token was decoded but never verified, so a forged, unsigned cookie was enough to get in without a session. Fullstack projects now authorize protected routes from the validated session only.

Update existing projects with:

```bash
pnpx create-sveltekitten patch
```

The patch only touches projects whose `.sveltekitten.json` has `"ssrMode": "fullstack"`. FastAPI (BFF) projects are unchanged.

If your fullstack project sets `BACKEND_API_URL` to a real FastAPI server, logging in through the FastAPI branch of `/login` no longer reaches protected pages, because only sessions count now. That branch is removed in #2.
