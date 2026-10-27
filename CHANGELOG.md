# Changelog

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
