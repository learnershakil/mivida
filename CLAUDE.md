# CLAUDE.md — mi vida

Guidance for any future session working in this repo. Read `AUDIT.md` (repo root) for the full,
evidence-backed state of the codebase; read the plan/architecture docs before implementing.

## What this is

`mi vida` — a **single-user, offline-first** life-management app with two clients over one backend:

- **`mobile-app/`** — React Native, **Expo SDK 54 (bare)**, expo-router. Local-first via **WatermelonDB**.
  **No login** on mobile.
- **`web-dashboard/`** — **Next.js 16 (App Router)** + **Prisma 7 / Postgres**. It is simultaneously the
  control-panel dashboard **and** the API backend for both clients. Web **requires login** (to be built).

Postgres is the cloud source of truth; WatermelonDB is the on-device mirror. Offline-first is sacred;
online is purely additive.

## Commands

| | mobile-app | web-dashboard |
|---|---|---|
| Install | `bun install` | `bun install` |
| Dev / run | `bun run android` (`expo run:android`), `bun run start` | `bun run dev` |
| Build | `expo prebuild` / Android build | `bun run build` (`next build`) |
| Lint | `bun run lint` | `bun run lint` |
| Typecheck | `bun run typecheck` (`tsc --noEmit`) | `bun run typecheck` (`tsc --noEmit`) |
| Tests | none yet (add Jest/Vitest in Phase 3) | none yet |

**Package manager is `bun`** in both apps (`bun.lock`). Ignore the stray `package-lock.json`s.

> `web-dashboard/AGENTS.md` warns: this Next.js version has breaking changes vs. training data — consult
> `node_modules/next/dist/docs/` before writing web code.

## Architecture facts (verified — don't re-derive)

- **Sync = WatermelonDB `synchronize()`** (`mobile-app/services/syncService.ts` ↔
  `web-dashboard/src/app/api/sync/route.ts`). We **keep this engine** — never hand-roll a replacement, never
  hand-edit `_status`/`_changed`. Server must upsert **by record id** (idempotent) and wrap writes in
  `prisma.$transaction`; only advance the sync watermark after a fully successful round-trip.
- **Two API namespaces (target):** `/api/m/*` (mobile, `x-http-key`) and `/api/w/*` (web, session). No
  shared endpoints — this isolation is a requirement.
- **Reactivity** is WatermelonDB observables (`withObservables`), **not** TanStack Query (not installed).
  Global client state = Zustand (`store/`, currently only a toast store).
- **Event-sourced core:** every user action emits an immutable row into `event_logs` via
  `services/eventLogger.ts`; projections (tasks, finance, mood, …) are derived. Derived metrics/balances are
  **computed, never stored**.
- **Time-authority (target):** a backend cron owns 5 AM fixed-renewal, 6 h custom-fail, 16 h
  "Completed Today" hide, and mood-interval. On-device timers are UX only; today they run **only on app
  launch** (`app/_layout.tsx`) — the cron is unbuilt.
- **Object storage (target):** Cloudflare R2 via backend-issued **presigned URLs**. R2 secrets never touch
  the device. None of this exists yet.

## Guardrails (non-negotiable)

1. **Audit before build.** Confirm assumptions against code; the code wins over any brief. Record
   divergences in `AUDIT.md`.
2. **Do no harm.** Preserve working behavior and existing user data. **Never** drop a WatermelonDB table or
   run an irreversible migration without a reversible plan + explicit approval. Migrations to date are
   purely additive (v4→v13) — keep new ones additive and reversible; back up the local DB first.
3. **Vault stays secret.** Vault plaintext must **never** appear in the sync payload, logs, analytics, AI
   digests, or the `DatabaseBrowser`. On-device vault data must be encrypted and hidden.
4. **Secrets live in env / secure store only** — WakaTime creds, Google OAuth, R2 keys, the mobile
   `x-http-key`, `DATABASE_URL`. Never commit them; never ship them in the app bundle in plaintext.
   (Current debt: hardcoded LAN IPs + `hardcoded-dev-key` in `syncService.ts`;
   `NODE_TLS_REJECT_UNAUTHORIZED='0'` in `web-dashboard/src/lib/prisma.ts`.)
5. **UI parity.** Keep the mobile app's current dark design 100% intact; the web app mirrors that same
   design language. Restyle only the specific surfaces called out in the brief, always into the existing
   design system (tokens in `mobile-app/tailwind.config.js`; accent green `#C0F67F`, blue `#4AC3FF`,
   surfaces `#1E1E1E/#1C1C1E`).
6. **Be honest about platform limits.** On stock non-rooted MIUI/HyperOS the app cannot block the power
   button or truly lock the user in (no Device Owner). Build the strongest feasible approximation and
   document exactly what's enforceable vs not (see `AUDIT.md §5.4`).
7. **TypeScript strict; type the boundaries.** No `any` dumping grounds — type sync payloads, WakaTime/
   Google/R2 flows, and analytics structures.
8. **Verify after every change:** typecheck + relevant tests + a build where feasible; report results. If a
   command can't run here, say so and state what you'd run.
9. **Git discipline.** Branch off `main`; focused conventional commits; clean tree; never force-push; never
   commit secrets. Commit/push only when asked.
10. **STOP gates.** End of Phase 1 and Phase 2 require an explicit "go" before proceeding.

## Delivery phases (see `AUDIT.md` / plan for detail)

1. **Audit** (done → `AUDIT.md`, this file). 2. **Architecture** → `ARCHITECTURE.md` (final Prisma schema +
1:1 WatermelonDB mapping, sync contract, two-namespace API, R2 presign, Google Calendar OAuth, cron jobs,
honest lockdown matrix, reversible migration plan). 3. **Implement** in vertical slices (each builds/
typechecks/tests/runs). 4. **Verify & hand off** (`.env.example`, run instructions, changelog, walkthrough).

## Known dead code / traps

- `mobile-app/services/socket.ts` + `services/background.ts` — never initialized; point at a phantom socket
  server. Real dead-man switch is `services/deadMan.ts` (foreground-only).
- Orphaned `settings` stack screen in `app/_layout.tsx` (no file; Settings is a modal component).
- Two vault content UIs: `VaultContentModal` (works, but note-decrypt bug) vs `VaultContentScreen`
  (crashes — calls nonexistent service methods).
- `contact_id` / `completion_remark` columns and `scheduledDate/Time` params are declared but unwired.
