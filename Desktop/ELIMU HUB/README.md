# ELIMU HUB - JavaScript Migration (Phase 1 Complete)

This workspace is the JavaScript full-stack foundation for migrating SRMS in 6 phases.

## Status

- Phase 1 foundation is complete and validated
- Phase 2 auth and access control is complete and validated
- Phase 3 exams, marks, and reports is complete and validated
- Phase 4 attendance and notifications is complete and validated
- Phase 5 classes and subjects lifecycle is complete and validated
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

- Exams API lifecycle is implemented under `GET /api/exams`, `POST /api/exams`, `PATCH /api/exams/:id`, and `DELETE /api/exams/:id`
- Exams endpoint supports query filters: `classId`, `subjectId`, and `search`
- Exam creation validates class and subject existence before insert
- Exam update validates class and subject existence when changed
- Audit logging added for exam create/update/delete (`EXAM_CREATED`, `EXAM_UPDATED`, `EXAM_DELETED`)
- Marks API lifecycle is implemented under `GET /api/marks`, `POST /api/marks`, `PATCH /api/marks/:id`, and `DELETE /api/marks/:id`
- Marks endpoint supports query filters: `examId`, `classId`, `subjectId`, and `search`
- Mark creation and update enforce score validity (`score <= maxScore`) and exam existence checks
- Audit logging added for mark create/update/delete (`MARK_CREATED`, `MARK_UPDATED`, `MARK_DELETED`)
- Exams management UI active: `/admin/exams`
- Exams admin UI supports inline edit and delete actions
- Reports API summary endpoint active: `GET /api/reports/summary`
- Reports UI active: `/dashboard/reports`
- Dashboard quick links updated to include Exams and Reports for admin and teacher roles
- API tests expanded with exams, marks, and reports route coverage

## Phase 3 Validation

- `npm run test --workspace @elimu/api` (includes exams, marks, and reports tests)
- `npm run build`

## Phase 4 Complete

- Attendance API lifecycle implemented: `GET /api/attendance`, `POST /api/attendance`, `PATCH /api/attendance/:id`, `DELETE /api/attendance/:id`
- Attendance endpoint supports query filters: `classId`, `status`, date range (`startDate`, `endDate`), and `search`
- Attendance creation validates class existence and audits with `ATTENDANCE_CREATED`
- Attendance update/delete tracks snapshots with `ATTENDANCE_UPDATED`, `ATTENDANCE_DELETED`
- Notifications API lifecycle implemented: `GET /api/notifications`, `POST /api/notifications`, `PATCH /api/notifications/:id`, `DELETE /api/notifications/:id`
- Notifications write access (POST/PATCH/DELETE) restricted to admin and teacher roles
- Notifications publish state tracked with `isPublished` and `publishedAt`
- Attendance UI active: `/teacher/attendance`
- Notifications UI active: `/dashboard/notifications`
- Prisma schema extended with `AttendanceRecord` and `Notification` models
- Database migration created: `20260417090000_phase4`
- API tests expanded with attendance and notifications coverage

## Phase 4 Validation

- `npm run test --workspace @elimu/api`
- `npm run build`

## Phase 5 Complete

- Classes API lifecycle now complete: `GET /api/classes`, `POST /api/classes`, `PATCH /api/classes/:id`, `DELETE /api/classes/:id`
- Classes endpoint supports query filters: `search`, `level`
- Class create/update normalizes class code to uppercase and writes audit logs (`CLASS_CREATED`, `CLASS_UPDATED`, `CLASS_DELETED`)
- Subjects API lifecycle now complete: `GET /api/subjects`, `POST /api/subjects`, `PATCH /api/subjects/:id`, `DELETE /api/subjects/:id`
- Subjects endpoint supports query filter: `search`
- Subject create/update normalizes subject code to uppercase and writes audit logs (`SUBJECT_CREATED`, `SUBJECT_UPDATED`, `SUBJECT_DELETED`)
- Admin classes UI enhanced with filters, inline edit/save/cancel, and delete actions: `/admin/classes`
- Admin subjects UI enhanced with search, inline edit/save/cancel, and delete actions: `/admin/subjects`
- Dashboard phase status updated to Phase 5 with academic operations summary
- API tests expanded with new class and subject route suites

## Phase 5 Validation

- `npm run test --workspace @elimu/api` (9 files, 40 tests passing)
- `npm run build` (all workspaces compiled; web routes generated successfully)

## Web Runtime Note

- In this current environment (`Node v22`), `Next.js 14.2.15` may start then exit immediately with code `0` in dev mode.
- Recommended fix: use `Node 20 LTS` for web development, or upgrade Next.js to a Node 22-compatible version when network access is available.
- API service is stable and running on `http://localhost:4100`.
