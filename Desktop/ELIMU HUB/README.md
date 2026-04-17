# ELIMU HUB - JavaScript Migration (Phase 1 Complete)

This workspace is the JavaScript full-stack foundation for migrating SRMS in 6 phases.

## Status

- Phase 1 foundation is complete and validated
- Phase 2 auth and access control is complete and validated
- API is stable on [http://localhost:4100](http://localhost:4100)

## Stack

- Frontend: Next.js 14 + TypeScript + Tailwind
- Backend: Node.js + Express + TypeScript
- Database: PostgreSQL (Supabase-ready) + Prisma
- Shared: Monorepo workspaces with shared types

## Quick Start

1. Copy env template:
   - `cp .env.example .env`
2. Start PostgreSQL:
   - `docker compose up -d`
3. Install dependencies:
   - `npm install`
4. Generate Prisma client:
   - `npm run db:generate`
5. Run migrations:
   - `npm run db:migrate`
6. Start API (stable):
   - `npm run dev:api`
7. Start web (separate terminal, TTY-stabilized):
   - `npm run dev:web`

## Workspace Layout

- `apps/web` Next.js app
- `apps/api` Express API
- `packages/shared` Shared types and constants
- `packages/db` Prisma schema, client, seed utilities
- `supabase` SQL and migration helpers

## Phase 1 Scope Completed

- Monorepo scaffold with workspace scripts
- Base API with health endpoint and route structure
- Base dashboard shell and shared layout
- Supabase/PostgreSQL-ready Prisma schema
- Prisma generate and migrate flow validated
- Root build validated

## Phase 1 Validation

- `npm run db:generate`
- `npm run db:migrate`
- `npm run build`
- API health check on `http://localhost:4100/api/health`

## Phase 2 Complete

- Authentication API scaffold implemented
- Endpoints active: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- Recovery endpoints active: `POST /api/auth/refresh`, `POST /api/auth/logout`, `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`
- Access-control endpoint active: `GET /api/auth/access-control`
- API running on `http://localhost:4100`
- Web auth pages active: `/login`, `/register`, `/forgot-password`, `/reset-password`, `/dashboard`
- Admin UI active: `/admin/users`
- Admin user actions active: edit profile/role, deactivate/reactivate, delete
- Admin users list supports search, role/status filters, and pagination
- Client route guards active for public and protected pages
- Access-control UI active: `/dashboard/access-control`
- Audit logging active for admin user update/delete operations
- API tests active for guard behavior and users mutation routes
- API route guards active for module endpoints by role

## Phase 2 Validation

- `npm run test --workspace @elimu/api`
- `npm run build`
- Access-control auth check: invalid token rejected on `GET /api/auth/access-control`
- Admin protected users endpoint verified with valid admin token

## Phase 3 Complete

- Exam creation validates class and subject existence before insert
- Exam update validates class and subject existence when changed
- Audit logging added for exam create/update/delete (`EXAM_CREATED`, `EXAM_UPDATED`, `EXAM_DELETED`)
- `npm run test --workspace @elimu/api` (now includes exams, marks, and reports route tests)
- `npm run build`

- In this current environment (`Node v22`), `Next.js 14.2.15` starts then exits immediately with code `0`.
- Recommended fix: use `Node 20 LTS` for web development, or upgrade Next.js to a Node 22-compatible version when network access is available.
- API service is stable and running on `http://localhost:4100`.
