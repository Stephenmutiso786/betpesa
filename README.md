# BetPesa (Production-Oriented Starter)

This project is a realistic betting-platform baseline inspired by makepesa.com. It is not yet a licensed production deployment, but it includes the core controls expected in a real-money system.

## Included now
- Account registration/login/logout with signed session tokens
- Phone/username/email login flow (`/login` -> role-based portal)
- Age gate (18+) at registration
- KYC workflow (`unverified -> pending -> verified/blocked`)
- Responsible gambling controls:
  - daily deposit limit
  - self-exclusion window
- Wallet operations:
  - deposit with limits
  - withdrawal (KYC-verified only)
- Betting engine:
  - open events with odds
  - stake checks, event-start checks, max stake
- Aviator game mode:
  - timed rounds
  - bet before takeoff
  - manual cashout before crash
  - live plane flight curve animation
- M-Pesa STK push deposits:
  - user enters phone + amount
  - STK PIN prompt appears on phone
  - wallet is credited only on callback success
- Multi-portal role system:
  - User portal: `/dashboard`
  - Super admin portal: `/admin`
  - Signal provider portal: `/signals-admin`
- Admin tools:
  - create events
  - update KYC status
  - settle bets (`won`, `lost`, `void`)
  - overview metrics
- Audit log persistence
- Repository layer with PostgreSQL support (`DATABASE_URL`)
- Redis-backed sessions and rate limiting (`REDIS_URL`)

## Start
1. Use Node.js 18+.
2. Copy env values:
```bash
cp .env.example .env
```
3. Export env vars (or use your process manager):
```bash
export $(grep -v '^#' .env | xargs)
```
4. Run:
```bash
npm start
```
5. Open `http://127.0.0.1:3000` (redirects to `/login`)

## Architecture Assets Added
- PostgreSQL schema: `db/schema.sql`
- Local infrastructure (PostgreSQL + Redis): `infrastructure/docker-compose.yml`
- Architecture blueprint: `docs/ARCHITECTURE.md`
- Delivery roadmap: `docs/ROADMAP.md`
- Service module boundaries: `server/modules/*.js`

## Run Databases Locally
```bash
cd infrastructure
docker compose up -d
```

This will start:
- PostgreSQL on `localhost:5432`
- Redis on `localhost:6379`

## Storage/Cache Modes
- If `DATABASE_URL` is set and reachable, API uses PostgreSQL.
- If PostgreSQL is unavailable, API falls back to local JSON store.
- If `REDIS_URL` is set and reachable, sessions/rate limiting use Redis.
- If Redis is unavailable, API falls back to in-memory session/rate-limit stores.

## M-Pesa STK Push Setup
- Configure in `.env`:
  - `MPESA_ENV=sandbox` (or `live`)
  - `MPESA_CONSUMER_KEY`
  - `MPESA_CONSUMER_SECRET`
  - `MPESA_SHORTCODE`
  - `MPESA_PASSKEY`
  - `MPESA_CALLBACK_URL` (must be publicly reachable HTTPS URL)
- Use dashboard M-Pesa form to trigger STK push.
- User receives Safaricom prompt and enters M-Pesa PIN on phone.
- Callback endpoint used: `POST /api/payments/mpesa/callback`

## Key API routes
- `POST /api/register`
- `POST /api/login`
- `POST /api/logout`
- `GET /api/me`
- `POST /api/profile`
- `POST /api/kyc/submit`
- `GET /api/events`
- `POST /api/deposit`
- `POST /api/withdraw`
- `POST /api/bets`
- `GET /api/bets`
- `GET /api/transactions`
- `GET /api/signals`
- `GET /api/signals/mine`
- `POST /api/signals`
- `GET /api/admin/overview`
- `GET /api/admin/live`
- `POST /api/admin/events`
- `POST /api/admin/kyc`
- `POST /api/admin/settle`
- `GET /api/admin/signals`
- `POST /api/admin/signals/status`
- `POST /api/admin/users/role`

## Default Super Admin
- Username: `admin.dolazetu.com`
- Password: `belac.ke05`

## Default Signal Provider
- Username: `signal-admin.dolazetu.com`
- Password: `belac.ke05`

## Admin authentication
Admin endpoints use logged-in session role checks (`super_admin`).

## What still must be done before real public launch
- Remove JSON fallback in production and enforce PostgreSQL-only mode
- Add payment gateway integrations (M-Pesa STK push, cards, reconciliation)
- Add provably correct odds/settlement pipeline and event feed integrations
- Add 2FA, email verification, password reset, and device/session management
- Add AML screening, sanctions checks, and compliance reporting
- Add test suite (unit/integration/e2e), CI/CD, and observability stack
- Add legal framework for your operating jurisdiction and licensed entities

## Suggested next build phase
1. PostgreSQL + Redis + queue workers
2. Payment microservice and webhook processors
3. Dedicated admin web app with role-based access control
4. Comprehensive automated tests and deployment pipeline
