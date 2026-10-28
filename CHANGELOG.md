# Changelog

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
