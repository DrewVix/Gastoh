# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Gastoh: a self-hosted, single-tenant-per-user personal finance tracker. All transactions are entered manually (no bank import/sync) and manually categorized. Next.js App Router + Prisma/SQLite, deployed via Docker. UI copy and commit history are in Spanish — match that when writing user-facing strings or commit messages touching this app.

## Commands

```bash
npm run dev          # next dev
npm run build        # next build
npm run start         # next start (standalone output)
npm run lint          # eslint
npm run init-admin     # npx tsx scripts/init-admin.ts <password> [username] — creates/updates an admin user
```

There is no test suite/runner configured in package.json.

Prisma (SQLite, schema at `prisma/schema.prisma`):
```bash
npx prisma migrate dev --name <name>   # create + apply a migration locally
npx prisma migrate deploy               # apply pending migrations (used in docker-entrypoint.sh)
npx prisma generate
node prisma/seed.js                     # seed default categories (idempotent, skips if categories exist)
```

Local setup without Docker: copy `.env.example` to `.env` and set `DATABASE_URL` and a `SESSION_SECRET` (>= 32 chars). Docker-based setup is via `setup.sh` / `setup.ps1`, which generate the session secret, build the image, and prompt for admin credentials — see README.md for the full flow.

## Architecture

- **Auth**: cookie session via `iron-session` (`lib/session.ts`), no middleware.ts. Every protected route group/handler calls `getSession()` itself and checks `session.isLoggedIn` (and `session.isAdmin` for admin-only endpoints like `app/api/users/*`). The `(app)` route group's `layout.tsx` is the single gate for all pages under it — redirects to `/login` if not logged in. API routes each re-check the session independently; there is no shared auth wrapper/middleware, so new API routes must repeat the `getSession()` + `isLoggedIn` check themselves.
- **Data model** (`prisma/schema.prisma`): `User` → `Transaction` and `Category`, both scoped by `userId` (multi-user, but each user's data is fully isolated — no shared/global data except category seeding). `Category` is self-referential (`parentId`/`children`) to support one level of grouping (group category → subcategories); the API for creating/assigning transactions enforces that a transaction can only be assigned to a leaf category, not a group (see `app/api/transactions/route.ts` POST, and `app/api/categories/[id]/route.ts`). Categories also carry `isFixed` (fixed vs. variable expense) used for reporting filters.
- **New users**: `app/api/users/route.ts` POST (admin-only) creates a user and calls `seedDefaultCategories` (`lib/seed-categories.ts`) to populate a standard Spanish category tree (groups + children) for that user. `prisma/seed.js` / `prisma/default-categories.js` do the equivalent at container startup for the first admin user.
- **Transactions**: `amount` sign encodes gasto/ingreso (negative/positive); `isTransfer` flags transfers, which are excluded by default from expense/income filtering in list queries (see the `type` query-param handling in `app/api/transactions/route.ts`). Amount range filters compare by magnitude regardless of sign.
- **Route structure**: `app/(app)/*` are the authenticated pages (dashboard, transactions, categories, calendar, report, settings), each with a matching `*Client.tsx` component in `components/` that does the client-side data fetching/interaction against the `app/api/*` route handlers. `app/login` and `app/page.tsx` are unauthenticated.
- **`lib/encryption.ts`** (AES-256-GCM helpers) is currently unused dead code — no callers exist and `ENCRYPTION_KEY` isn't in `.env.example`. Don't assume any data is actually encrypted at rest.
- **Deployment**: single container (`Dockerfile`, Next `output: 'standalone'`), SQLite file on a Docker volume, nginx config present for reverse-proxy setups. `docker-entrypoint.sh` runs `prisma migrate deploy` then `prisma/seed.js` before starting the server — keep migrations deploy-safe (no interactive steps) since this is how they run in production.
