# A Stack'd — Backend (the private "Floor")

Private transactional backend for **A Stack'd**. It bridges the user-facing app
(**A**) to the immutable chip ledger (**i**) and enforces the Casino Tiered
Economy ruleset, including the one-black-chip whale limit and dynamic "Melting
Odds".

Built with **Fastify + TypeScript**. The storage layer is an abstraction
(`DataStore`) with two implementations:
- **in-memory** (default) — seeded demo data, for local/dev
- **PostgreSQL** — used automatically when `DATABASE_URL` is set; append-only,
  immutable ticket rows enforced by a DB trigger

See [`ROADMAP.md`](./ROADMAP.md) for what's done and what's left.

## Quick start

```bash
npm install
npm run dev          # in-memory store, http://localhost:3000
```

With Postgres (Docker):
```bash
docker compose up --build   # app + postgres, migrations run on boot
```

Scripts: `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`,
`npm start`, `npm run migrate` (run schema against `DATABASE_URL`).

Interactive API docs (Swagger UI): **http://localhost:3000/docs**

## The chip economy

| Chip  | Value | Mood          | Seats per chip   |
|-------|-------|---------------|------------------|
| red   | $1    | Rage          | 1                |
| white | $5    | Safe          | 1                |
| blue  | $10   | Calm          | 1                |
| black | $100  | Consumes All  | 10 (carpet bomb) |

Ruleset enforced on every `/buy-ticket` (see `src/domain/economy.ts`):

1. The pool must be open (not closed, seats remaining).
2. The chip must match the pool's `requiredChip`, or be a **black** chip
   (black is accepted on any pool).
3. **Whale limit:** at most **one black chip per person per pool**.
4. The user must hold at least one chip of the chosen color.
5. The pool must have enough seats left for the claim (10 for a black chip).
6. **A valid, deliverable shipping address is required** (prizes are physical
   goods). The address is validated (`src/domain/address.ts`) and persisted with
   the immutable ticket so a won prize can always be shipped.

**Melting Odds:** `multiplier = capacity / filled`, e.g. a `185/500` pool yields
`2.7x`. Surfaced on `/active-pools` as the Sales Agent surge alert.

## Auth

Endpoints (other than the public `/`, `/health`, `/docs`, `/auth/*`) require a
**JWT** bearer token: `Authorization: Bearer <jwt>`. Tokens carry `{ sub, role }`
where `role` is `user` or `admin`.

Register or log in with email + password to receive a token. New accounts are
granted a demo "free play" chip stack (configurable via `WELCOME_CHIPS`, set it
to `0,0,0,0` once a payment processor is wired in).
```bash
curl -X POST localhost:3000/auth/register -H 'content-type: application/json' \
  -d '{"email":"player@example.com","password":"hunter2hunter"}'
# -> { "token": "...", "userId": "u_...", "role": "user" }

curl -X POST localhost:3000/auth/login -H 'content-type: application/json' \
  -d '{"email":"player@example.com","password":"hunter2hunter"}'
```
Passwords are hashed with bcrypt. For local testing only, `/auth/dev-token` mints
a token for an arbitrary `userId`; it is **disabled when `NODE_ENV=production`**.
`JWT_SECRET` is required in production.

## API

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET  | `/wallet` | user | Read the chip stack |
| POST | `/buy-ticket` | user | Buy a ticket (the data-bridge transition) |
| GET  | `/tickets` | user | List my immutable tickets |
| GET  | `/active-pools` | user | Active pools with melting odds |
| GET  | `/pools/:poolId` | user | A single pool |
| POST | `/admin/pools` | admin | Create a pool |
| POST | `/admin/pools/:poolId/draw` | admin | Draw a winner (closed/full pools) |
| POST | `/auth/register` | public | Create an account, get a token |
| POST | `/auth/login` | public | Log in, get a token |
| POST | `/auth/dev-token` | public (non-prod) | Mint a dev token |
| GET  | `/`, `/health`, `/docs` | public | Landing, health, Swagger UI |

### `GET /wallet`
```json
{ "userId": "u123", "stacks": { "red": 25, "white": 10, "blue": 5, "black": 1 } }
```

### `POST /buy-ticket`
Body:
```json
{
  "poolId": "p_weekly_tv",
  "chipColor": "blue",
  "shippingAddress": {
    "name": "Austin Hanshew",
    "line1": "123 Jackpot Ave",
    "line2": "Apt 4B",
    "city": "Las Vegas",
    "state": "NV",
    "postalCode": "89101"
  }
}
```
A complete, valid US address is required (rejected with `422 INVALID_ADDRESS`
otherwise) and is stored on the ticket so the prize can be delivered.
```json
{ "success": true, "ticketId": "tkt_secure_...", "seats": 1,
  "msg": "Ticket secured on the floor. [1] seats claimed." }
```

### `GET /active-pools`
```json
{ "pools": [ {
  "poolId": "p_weekly_tv", "prize": "55-inch 4K Smart TV", "type": "WEEKLY_GRAND",
  "isGuaranteed": true, "requiredChip": "blue", "status": "185/500 Filled",
  "timeLeft": "3d 4h", "meltingMultiplier": 2.7,
  "salesAgentAlert": "📈 ODDS SURGE: Individual drawing power multiplied by 2.7x right now! (Pool under capacity)"
} ] }
```

Errors use a consistent shape: `{ "error": { "code": "WHALE_LIMIT_REACHED", "message": "..." } }`.
Codes: `POOL_NOT_FOUND` (404), `POOL_CLOSED`/`POOL_FULL`/`POOL_ALREADY_DRAWN`/`POOL_NOT_DRAWABLE`/`NO_TICKETS`/`POOL_EXISTS` (409),
`INVALID_CHIP_FOR_POOL`/`INVALID_ADDRESS` (422), `INSUFFICIENT_CHIPS` (402),
`WHALE_LIMIT_REACHED`/`RATE_LIMITED` (429), `UNAUTHORIZED` (401), `VALIDATION_ERROR` (400).

## Configuration

See [`.env.example`](./.env.example). Key vars: `PORT`, `JWT_SECRET` (required in
prod), `DATABASE_URL` (enables Postgres), `CORS_ORIGIN`, `RATE_LIMIT_MAX`,
`RATE_LIMIT_WINDOW`.

## Project layout

```
src/
  app.ts            Fastify app factory (plugins, error handler, route wiring)
  index.ts          Server entrypoint
  config.ts         Typed, fail-fast env config
  domain/           Pure business logic (chips, pools, economy, errors, tickets)
  store/            DataStore interface, memory + postgres impls, factory, seed, migrate
  routes/           wallet, tickets, pools, admin, auth
  plugins/auth.ts   JWT auth (verify + requireAdmin)
  schemas.ts        TypeBox request/response schemas
  landing.ts        Buzz landing page HTML
test/               Vitest unit + route + postgres tests
```

## Deployment

- **Render:** `render.yaml` is a Blueprint — in Render, New → Blueprint → pick
  this repo → Apply. It provisions a web service + managed Postgres, generates
  `JWT_SECRET`, wires `DATABASE_URL`, runs migrations on boot, and health-checks
  `/health`.
- **Docker:** `docker compose up --build` runs app + Postgres locally.
- **Heroku:** the `Procfile` runs `migrate` on release and `node dist/index.js`
  for web. Set `JWT_SECRET` and attach a Postgres add-on (`DATABASE_URL`).
- **CI:** GitHub Actions (`.github/workflows/ci.yml`) runs lint, typecheck,
  tests (with a Postgres service so the integration tests execute), and build.

## Production notes

- **Immutability:** the Postgres `tickets` table rejects UPDATE/DELETE via a
  trigger, and the whale limit is also enforced by a partial unique index.
- **Air-gap:** run this service on a network-isolated host, reachable only via
  the app's API gateway, per the launch plan.
- **Before real money:** add a payments processor, KYC/age verification, and
  sweepstakes/gambling legal review — see `ROADMAP.md`.
