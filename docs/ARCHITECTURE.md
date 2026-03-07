# BetPesa Architecture Blueprint

## 1) Channel Layer
- Web App: current `public/` frontend.
- Mobile App: future Flutter/React Native client consuming same API.

## 2) API Layer
- API Gateway / BFF: Node.js service (current `server/index.js`).
- Responsibilities:
  - auth/session validation
  - request validation + rate limiting
  - orchestrate calls to domain services

## 3) Core Service Layer
- User Service
  - registration, profile, KYC status, responsible-gambling settings
- Wallet Service
  - ledger, deposit, withdrawal, balance checks
- Betting Engine
  - ticket validation, pricing snapshot, placement, settlement
- Odds Engine
  - odds ingestion from providers, versioning, market activation
- Payment Service
  - M-Pesa adapters, callback verification, reconciliation
- Notification Service
  -SMS, push dispatch

## 4) Data Layer
- PostgreSQL (source of truth): users, bets, matches, transactions, settlements.
- Redis (low-latency):
  - live odds cache
  - rate limiting counters
  - session and idempotency keys

## 5) External Integrations
- Sports feeds: Sportradar / BetRadar / SportMonks.
- Payments: M-Pesa, Airtel Money.
- KYC: Sumsub / Onfido.

## 6) Async / Eventing
- Queue (recommended: RabbitMQ/Kafka/SQS later):
  - bet settlement jobs
  - payment webhook retries
  - notification fanout

## 7) Security Baseline
- TLS everywhere, secure cookies/tokens, secret rotation.
- WAF + anti-bot + DDoS controls.
- Audit logs for admin and money actions.
- Role-based admin access and 2FA.

## 8) Deployment Topology
- Frontend: CDN + static hosting.
- API: containerized service behind load balancer.
- DB: managed PostgreSQL with PITR backups.
- Cache: managed Redis.
- Observability: logs, metrics, tracing, alerts.
