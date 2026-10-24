# Changelog

## 0.3.20

**Security fix.** In fullstack SSR projects, the auth guard let any `refresh_token` cookie with a future `exp` into `(protected)` routes. The token was decoded but never verified, so a forged, unsigned cookie was enough to get in without a session. Fullstack projects now authorize protected routes from the validated session only.

Update existing projects with:

```bash
pnpx create-sveltekitten patch
```

The patch only touches projects whose `.sveltekitten.json` has `"ssrMode": "fullstack"`. FastAPI (BFF) projects are unchanged.

If your fullstack project sets `BACKEND_API_URL` to a real FastAPI server, logging in through the FastAPI branch of `/login` no longer reaches protected pages, because only sessions count now. That branch is removed in #2.
