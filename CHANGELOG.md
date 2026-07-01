# Changelog — mi vida

All notable changes on branch `feat/backend-foundation` (Phases 1–3). Dates are 2026-07-01.

## Phase 1 — Audit
- `AUDIT.md`: evidence-backed audit (corrections to the brief, sync status, honest MIUI lockdown matrix,
  schema drift, build baseline, prioritized tech-debt/security backlog).
- Root `CLAUDE.md`: stack, commands, verified architecture facts, guardrails.
- Added `typecheck` scripts to both apps; recorded that neither typechecked clean (28 mobile / 1 web).

## Phase 2 — Architecture
- `ARCHITECTURE.md`: final 23-model Prisma schema + 1:1 WatermelonDB mapping, sync contract, two-namespace
  API, R2 presign, Google Calendar OAuth, cron jobs, reversible migration plan. Schema validated (Prisma 7).

## Phase 3 — Implementation
- **3.0** Removed a build-breaking import of a nonexistent `appStateService` (Metro couldn't bundle).
- **3.1 Backend skeleton** — full Prisma schema applied to Postgres via `init` migration; `/api/m/upload/presign`,
  `/api/w/auth/{login,logout,session}`; constant-time `x-http-key` (no more silent provisioning); scrypt web
  auth + HMAC session; R2 presign lib; removed the process-wide TLS bypass (SSL scoped to the DB pool);
  `.env.example`.
- **3.2 Sync engine** — DMMF-driven generic mapper covering all 13 tables; idempotent + atomic push
  (upsert-by-id in a transaction) with real `updated_at` last-write-wins; `serverUpdatedAt` delta pull;
  **vault sanitizer** (ciphertext + safe metadata only). New `/api/m/sync`; mobile client re-pointed off the
  hardcoded LAN IP/key to `EXPO_PUBLIC_API_URL` + secure-store, with an in-flight debounce lock. 9 vitest tests.
- **3.3 Task correctness** — schema v14/v15; `taskLifecycle.ts` (5am renewal, 6h custom-only fail → distinct
  `failed`, 16h/48h windows); completion remark persisted; `completedAt` fixes the 16h hide; categories
  master-list + live-filter picker (`AutocompleteField`); contact linkage; fixed tasks are time-only. Tests.
- **3.5 Vault** — fix note encrypt/decrypt round-trip; wrong-passcode lockout + exponential backoff; exclude
  vault from the DatabaseBrowser; remove on-device reset (web-only); delete the crashing `VaultContentScreen`
  and unify Profile on `VaultContentModal`; wire the dead profile avatar long-press.
- **3.6 Modules** — finance scheduled transactions actually schedule (not post immediately); Import feature
  removed (export-only); cleared the remaining pre-existing type errors → **mobile typechecks with 0 errors**.
- **3.7 Analytics** — `insights.ts`: the four spec metrics (Productivity×Mood, Burn Rate, Fatigue×Screen-Time,
  Task Velocity) as pure, unit-tested functions; WakaTime route uses the API key (not the password).
- **3.4 Focus (config)** — manifest permissions for the hardening path (foreground service, boot receiver,
  exact alarms, POST_NOTIFICATIONS); fixed a stale break-lock comment.
- **3.8 Web (core)** — web login page + dashboard session gate (unauthenticated → `/login`).

### Verification
- Mobile: `tsc --noEmit` clean; `jest` 43/43.
- Web: `tsc --noEmit` clean; `next build` clean; `vitest` 9/9; live smoke tests for auth, sync
  (idempotency + LWW + vault-no-plaintext), and the login gate.

### Known deferred (need a device build, external creds, or larger UI)
Native lockdown hardening (overlay/foreground-service/boot/exact-alarm Kotlin); sensors + usage-stats data
sources, Insights settings UI, and dashboard wiring; R2 upload flow; Google Calendar OAuth; backend cron
(server time-authority); media-at-rest + DB-at-rest encryption; full web CRUD parity + web vault reset.
