# The-Srilatha-Arts

Premium handcrafted-art e-commerce - Next.js frontend (static export hosted
on Azure Static Web Apps) + Azure Functions backend on Azure Table Storage.

## Repo layout

- `frontend/` - Next.js 14 + React + Tailwind. `output: 'export'`.
- `backend/` - Azure Functions (TypeScript v4 model). One file per route
  group in `backend/src/functions/*.ts`.
- `e2e/` - Playwright end-to-end tests.
- `infra/` - Bicep + scripts for the Azure deployment.

## Local dev

Frontend: `cd frontend && npm install && npm run dev`
Backend:  `cd backend  && npm install && npm start`  (requires `func` CLI)

The frontend reads the backend URL from
`NEXT_PUBLIC_API_BASE_URL` (defaults to `http://localhost:7071/api`).

## First-time admin bootstrap

The site has no UI for creating the very first admin user - that path is
intentionally hidden behind a setup key so a public deploy can't be
hijacked. To create the first admin, set the env var `ADMIN_SETUP_KEY` on
the Functions app (it's only ever used by `POST /api/auth/admin/setup`),
then POST to it:

```bash
curl -X POST 'https://<your-api>/api/auth/admin/setup' \
  -H 'content-type: application/json' \
  -d '{
    "setupKey": "<the value of ADMIN_SETUP_KEY>",
    "username": "studio@srilatha.art",
    "password": "<strong password>",
    "name":     "Srilatha"
  }'
```

That endpoint refuses with 403 if any admin already exists, so it's safe
to leave the env var set. After the first admin exists, additional admins
are created from the admin dashboard or by writing rows to the `admins`
table directly.

If you forget the setup key on a fresh environment: rotate the env var,
restart the Functions app, and re-run the curl above.

## End-to-end tests

`npx playwright test` from the repo root (uses
`playwright.config.ts`). Tests assume the local frontend + backend are
both running.
