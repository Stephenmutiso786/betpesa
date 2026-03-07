# Implementation Roadmap

## Phase 1 (Current)
- Frontend and API MVP with compliance controls completed.
- PostgreSQL schema designed in `db/schema.sql`.
- Local infra defined in `infrastructure/docker-compose.yml`.

## Phase 2 (Next)
- Migrate from JSON storage to PostgreSQL repositories.
- Introduce Redis for sessions, rate limits, live odds cache.
- Split server into modules:
  - `server/modules/user-service.js`
  - `server/modules/wallet-service.js`
  - `server/modules/betting-engine.js`
  - `server/modules/odds-engine.js`
  - `server/modules/payment-service.js`
  - `server/modules/notification-service.js`

## Phase 3
- Add sports odds ingestion workers + scheduler.
- Add M-Pesa STK push + callback signature verification.
- Add dedicated admin web panel + RBAC.

## Phase 4
- Add queue and async processing pipeline.
- Add full test suite, CI/CD, and environment promotion flow.
- Add observability dashboards and fraud/risk rules engine.
