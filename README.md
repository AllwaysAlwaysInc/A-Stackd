# A Stack'd — Backend (the private "Floor")

Private transactional backend for **A Stack'd**. It bridges the user-facing app
(**A**) to the immutable chip ledger (**i**) and enforces the Casino Tiered
Economy ruleset, including the one-black-chip whale limit and dynamic "Melting
Odds".

Built with **Fastify + TypeScript**. The storage layer is an abstraction
(`DataStore`) with an in-memory implementation by default; a PostgreSQL
implementation can satisfy the same contract for production (append-only,
immutable ticket rows).

## Quick start

```bash
npm install
npm run dev          # hot-reload dev server on http://localhost:3000
# or
npm run build && npm start
```

Other scripts: `npm test`, `npm run lint`, `npm run typecheck`.

## The chip economy

| Chip  | Value | Mood          | Seats per chip |
|-------|-------|---------------|----------------|
| red   | $1    | Rage          | 1              |
| white | $5    | Safe          | 1              |
| blue  | $10   | Calm          | 1              |
| black | $100  | Consumes All  | 10 (carpet bomb) |

Ruleset enforced on every `/buy-ticket` (see `src/domain/economy.ts`):

1. The pool must be open (not closed, seats remaining).
2. The chip must match the pool's `requiredChip`, or be a **black** chip
   (black is accepted on any pool).
3. **Whale limit:** at most **one black chip per person per pool**.
4. The user must hold at least one chip of the chosen color.
5. The pool must have enough seats left for the claim (10 for a black chip).

**Melting Odds:** `multiplier = capacity / filled`, e.g. a `185/500` pool yields
`2.7x`. Surfaced on `/active-pools` as the Sales Agent surge alert.

## API

Auth: send the user id as `Authorization: Bearer <userId>` or `x-user-id:
<userId>`. This is a placeholder for the cryptographic signature check the spec
calls for — replace `resolveUserId` in `src/plugins/auth.ts` before production.

### `GET /wallet` — read the stack
```json
{ "userId": "u123", "stacks": { "red": 25, "white": 10, "blue": 5, "black": 1 } }
```

### `POST /buy-ticket` — the data bridge transition
Body: `{ "poolId": "p_weekly_tv", "chipColor": "blue", "shippingAddress": "..." }`
```json
{ "success": true, "ticketId": "tkt_secure_...", "seats": 1,
  "msg": "Ticket secured on the floor. [1] seats claimed." }
```

### `GET /active-pools` — including melting odds
```json
{ "pools": [ {
  "poolId": "p_weekly_tv", "prize": "55-inch 4K Smart TV", "type": "WEEKLY_GRAND",
  "isGuaranteed": true, "requiredChip": "blue", "status": "185/500 Filled",
  "timeLeft": "3d 4h", "meltingMultiplier": 2.7,
  "salesAgentAlert": "📈 ODDS SURGE: Individual drawing power multiplied by 2.7x right now! (Pool under capacity)"
} ] }
```

Errors use a consistent shape: `{ "error": { "code": "WHALE_LIMIT_REACHED", "message": "..." } }`.
Codes: `POOL_NOT_FOUND` (404), `POOL_CLOSED`/`POOL_FULL` (409),
`INVALID_CHIP_FOR_POOL` (422), `INSUFFICIENT_CHIPS` (402),
`WHALE_LIMIT_REACHED` (429), `UNAUTHORIZED` (401), `VALIDATION_ERROR` (400).

Plus `GET /` (a minimal "buzz" landing page) and `GET /health`.

## Project layout

```
src/
  app.ts            Fastify app factory (error handler, route wiring)
  index.ts          Server entrypoint
  config.ts         Env-based config
  domain/           Pure business logic (chips, pools, economy, errors, tickets)
  store/            DataStore interface, in-memory impl, seed data
  routes/           wallet, tickets, pools
  plugins/auth.ts   Credential extraction
  landing.ts        Buzz landing page HTML
test/               Vitest unit + route tests
```

## Production notes

- **Real database:** implement `DataStore` against PostgreSQL. Keep the ticket
  table append-only (no UPDATE/DELETE) so the Floor stays immutable; do the
  debit + ticket insert + fill-count update in a single transaction.
- **Auth:** swap the placeholder for verified JWT/signature checks.
- **Air-gap:** run this service on a network-isolated host, reachable only via
  the app's API gateway, per the launch plan.
