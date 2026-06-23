# A Stack'd — Project Roadmap

Status of the build toward a launchable product. Backend items below are being
completed in code. Items marked **(you)** require accounts, money, or legal sign‑off
that only the owner can provide.

## Backend (this repo)

### Done
- [x] Fastify + TypeScript scaffold, strict tsconfig, ESLint, Vitest
- [x] Core API: `GET /wallet`, `POST /buy-ticket`, `GET /active-pools`
- [x] Chip economy ruleset: tiers, one‑black‑chip whale limit, black = 10‑seat carpet bomb
- [x] Dynamic "Melting Odds" (`capacity / filled`)
- [x] In‑memory `DataStore` with append‑only immutable ticket ledger
- [x] Buzz landing page (`GET /`), health check (`GET /health`)
- [x] Unit + route tests

### In progress (this PR)
- [ ] CI: GitHub Actions (lint, typecheck, test, build) with a Postgres service
- [ ] Deploy infra: Dockerfile, docker-compose (app + Postgres), Procfile, `.dockerignore`
- [ ] Typed, fail‑fast env config; store selection via `DATABASE_URL`
- [ ] **PostgreSQL `DataStore`** + SQL migrations
  - immutable, append‑only `tickets` table (revoke UPDATE/DELETE)
  - purchase runs in a single transaction (debit + insert rows + advance fill)
  - whale limit enforced with a partial unique index
- [ ] Real **JWT auth** (replace the header placeholder)
- [ ] More endpoints: `GET /pools/:id`, `GET /tickets` (mine), admin create‑pool + draw‑winner
- [ ] Security: `@fastify/helmet`, `@fastify/cors`, `@fastify/rate-limit`
- [ ] OpenAPI / Swagger UI at `/docs`
- [ ] Tests for the new store, auth, and endpoints

### Later (backend follow‑ups)
- [ ] Payments integration (purchase chips) — needs a provider, see **(you)** below
- [ ] Webhooks/receipts + idempotency keys on purchases
- [ ] Background job for pool close + automated winner draw (provably fair RNG)
- [ ] Audit log / immutable event stream for the Floor
- [ ] Observability: structured logs shipping, metrics, error tracking (Sentry)
- [ ] Load testing for pool "surge" traffic

## Frontend (separate repo/app)
- [ ] React Native (or Flutter) app shell calling these endpoints
- [ ] Screens: wallet, active pools, buy flow, my tickets, results
- [ ] Auth flow against the JWT backend

## Owner action items **(you)**
- [ ] Buy the domain (`astackd.io` / `.com`) and point it at the landing page
- [ ] Apple Developer account ($99/yr) and Google Play Console ($25 one‑time)
- [ ] Choose + onboard a **payments processor** (Stripe, etc.) and give me API keys
- [ ] Provision hosting (Heroku/AWS/Fly) + a managed Postgres; share `DATABASE_URL`
- [ ] **Legal/compliance**: sweepstakes vs. lottery/gambling laws vary by state/country.
      Get counsel on "no purchase necessary" alternate entry, age verification (KYC),
      and per‑jurisdiction restrictions **before** taking real money. This is the
      biggest non‑code blocker to launch.

## How to run
```bash
npm install
npm run dev                       # in-memory store, http://localhost:3000
# or with Postgres:
docker compose up --build         # app + postgres
```
See `README.md` for the full API reference.
