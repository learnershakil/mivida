<div align="center">

# Mi Vida

**A single‑user, offline‑first life‑management system — one backend, two clients.**

Tasks · Focus lockdown · Encrypted vault · Finance · Mood · Music · Contacts & delegation · Coding stats · Correlated insights

<sub>React Native (Expo) mobile app · Next.js + Prisma/Postgres web dashboard & API · WatermelonDB ⇄ Postgres sync · Cloudflare R2 · Google Calendar · FCM</sub>

</div>

---

## Table of contents

1. [What is Mi Vida?](#1-what-is-mi-vida)
2. [Core principles](#2-core-principles)
3. [Feature tour](#3-feature-tour)
4. [System architecture](#4-system-architecture)
5. [Technology stack](#5-technology-stack)
6. [Repository layout](#6-repository-layout)
7. [Prerequisites](#7-prerequisites)
8. [Getting started (local setup)](#8-getting-started-local-setup)
9. [Environment variables](#9-environment-variables)
10. [Data model & sync contract](#10-data-model--sync-contract)
11. [API reference](#11-api-reference)
12. [Background jobs (server time‑authority)](#12-background-jobs-server-time-authority)
13. [Security model](#13-security-model)
14. [Native Android lockdown — honest capability matrix](#14-native-android-lockdown--honest-capability-matrix)
15. [Development workflow](#15-development-workflow)
16. [How to make modifications](#16-how-to-make-modifications)
17. [Deployment](#17-deployment)
18. [Testing & verification](#18-testing--verification)
19. [Troubleshooting](#19-troubleshooting)
20. [Roadmap & deferred work](#20-roadmap--deferred-work)
21. [Further documentation](#21-further-documentation)

---

## 1. What is Mi Vida?

**Mi Vida** ("my life") is a personal productivity and life‑management application built for a **single user**. It is deliberately **offline‑first**: the phone is fully functional with no network, and the cloud is purely additive (backup, cross‑surface visibility, and a time‑authoritative backend).

It ships as **two clients over one backend**:

| Client | What it is | Auth |
|---|---|---|
| **`mobile-app/`** | React Native app (Expo SDK 54, bare workflow). The primary, always‑available surface. All data lives on‑device in **WatermelonDB** (SQLite). | **No login** — it is a single‑user personal device. |
| **`web-dashboard/`** | Next.js app that is **simultaneously** the control‑panel dashboard **and** the HTTP API/back‑end for both clients. Owns Postgres (the cloud source of truth), object storage, OAuth, and the cron time‑authority. | **Login required** (email + password). |

Postgres is the cloud **source of truth**; WatermelonDB is the on‑device **mirror**. They reconcile through WatermelonDB's `synchronize()` engine.

> This README is the operational guide. For the deep, evidence‑backed engineering docs see [`AUDIT.md`](./AUDIT.md) (state of the codebase), [`ARCHITECTURE.md`](./ARCHITECTURE.md) (schema, sync contract, cron, migration plan), [`CHANGELOG.md`](./CHANGELOG.md), and [`CLAUDE.md`](./CLAUDE.md) (contributor guardrails).

---

## 2. Core principles

These are non‑negotiable invariants. Every change must preserve them.

- **Offline‑first is sacred.** The mobile app must work with zero connectivity. Online features are additive; they never gate core behaviour.
- **Event‑sourced core.** Every user action emits an immutable row into `event_logs` (via `services/eventLogger.ts`). Projections (tasks, finance, mood, …) are derived from events; **derived metrics/balances are computed, never stored**.
- **Keep the sync engine.** Sync is stock WatermelonDB `synchronize()`. Never hand‑roll a replacement, never hand‑edit the `_status` / `_changed` bookkeeping columns. The server upserts **by record id** (idempotent), wraps writes in `prisma.$transaction`, and only advances the sync watermark after a fully successful round‑trip.
- **Two isolated API namespaces.** `/api/m/*` (mobile, `x-http-key`) and `/api/w/*` (web, session cookie). No shared endpoints.
- **Vault stays secret.** Vault plaintext must never appear in the sync payload, logs, analytics, or the in‑app DatabaseBrowser. Only AES ciphertext + safe metadata may leave the device.
- **Secrets live in env / secure‑store only.** Never commit them; never ship them in the app bundle in plaintext.
- **Migrations are additive & reversible.** Never drop a WatermelonDB table or run an irreversible migration without a reversible plan, a backup, and explicit approval.
- **Reactivity = WatermelonDB observables** (`withObservables`), not a data‑fetching cache. Global client state = Zustand.
- **TypeScript strict; type the boundaries** (sync payloads, WakaTime/Google/R2 flows, analytics structures).

---

## 3. Feature tour

| Domain | Highlights |
|---|---|
| **Tasks** | `custom` / `fixed` / `alert` types. Fixed tasks are time‑only and renew at 5 AM; custom tasks auto‑**fail** after 6 h (a distinct `failed` state, not "cancelled"). 16 h "Completed Today" hide + 48 h windows. Completion remarks, category master‑list with a live‑filter picker, contact linkage, Google Calendar push with a stored event id (de‑duplicated). |
| **Focus & lockdown** | In‑app focus countdown, break flow, and a best‑effort **native lockdown overlay** (foreground service + full‑screen `TYPE_APPLICATION_OVERLAY`). **Scheduled focus** arms an exact alarm that auto‑starts even if the app is closed and re‑arms after reboot. See the honest [capability matrix](#14-native-android-lockdown--honest-capability-matrix). |
| **Vault** | Passcode‑protected. Notes are **AES‑encrypted** at rest; encrypted media is uploaded to R2 (ciphertext only). Wrong‑passcode lockout with exponential backoff. Excluded from sync plaintext and from the DatabaseBrowser. |
| **Finance** | Append‑only ledger (income/expense), scheduled transactions triggered server‑side, categories, INR formatting. |
| **Mood** | Periodic mood check‑ins (configurable interval), server‑driven FCM "mood ping" push at the chosen cadence. |
| **Music** | On‑device library; audio + album art background‑uploaded to R2. |
| **Contacts & delegation** | Contacts with phone/email/socials and a free‑text **"source"** (where you met / got their details). Delegation centre to hand tasks to people and track assigned → partial → completed. |
| **Insights** | Four correlated analytics computed by the pure `services/insights.ts`: **Task Velocity** (slowest category = procrastination hotspot), **Burn Rate** (spend per focus hour), **Productivity × Mood** correlation, and **Fatigue** (screen‑time vs steps → auto physical‑activity task). Thresholds are user‑configurable in Settings. |
| **Coding stats** | WakaTime daily coding logs (API‑key auth, upserted per day) with a fragile public‑profile scrape fallback. |
| **Dead‑man switch** | Foreground inactivity monitor (documented platform limits on MIUI). |

---

## 4. System architecture

```
┌───────────────────────────┐         ┌──────────────────────────────────────────────┐
│        mobile-app          │         │                 web-dashboard                   │
│  (React Native / Expo)     │         │            (Next.js 16 · App Router)            │
│                            │         │                                                 │
│  WatermelonDB (SQLite)     │         │   ┌───────────── Dashboard (UI, login) ──────┐  │
│  ├─ 19 tables (mirror)     │         │   │  server components + Prisma direct        │  │
│  ├─ event_logs (sourced)   │         │   └───────────────────────────────────────────┘  │
│  ├─ AES-encrypted vault    │         │                                                 │
│  └─ Zustand + observables  │         │   ┌──────────── HTTP API (backend) ───────────┐  │
│                            │  HTTPS  │   │  /api/m/*  (mobile · x-http-key)          │  │
│  syncService.synchronize() │◀───────▶│   │  /api/w/*  (web · HMAC session cookie)    │  │
│  R2 presigned upload       │         │   │  /api/cron (server time-authority)        │  │
│  FCM device token          │         │   └───────────────────────────────────────────┘  │
└───────────────────────────┘         │            │            │            │            │
                                       │        Postgres      Cloudflare   Google Cal +   │
                                       │       (Prisma 7)        R2         WakaTime + FCM │
                                       └──────────────────────────────────────────────────┘
```

**Data flow.**

1. The user acts on the phone → an **event** is logged and projections update locally (works fully offline).
2. A **long‑press on the Sync tab** (1.5 s) triggers `synchronize()`: push local changes, pull server deltas.
3. The server maps device rows (snake_case, millis, JSON strings) ⇄ Prisma rows (camelCase, BigInt/DateTime/Json) through a **DMMF‑driven generic mapper** (`web-dashboard/src/lib/sync.ts`), upserts by id in a transaction, and returns a new watermark only on full success.
4. A **Vercel cron** hits `/api/cron` every 15 minutes to enforce time‑based rules the phone can't guarantee while closed (5 AM renewal, custom‑task fail, scheduled finance, fatigue trigger, WakaTime/Calendar sync, mood pings).
5. Binaries (avatar, music, encrypted vault media) are uploaded **directly to R2** via server‑issued presigned URLs; only the R2 key is stored and synced.

---

## 5. Technology stack

| Layer | Mobile (`mobile-app/`) | Web (`web-dashboard/`) |
|---|---|---|
| Framework | Expo SDK 54 (bare), React Native 0.81.5, React 19.1, expo‑router 6 | Next.js 16.2.9 (App Router), React 19.2 |
| Local data | WatermelonDB 0.28 (SQLite) | — |
| Cloud data | — | Prisma 7.8 + `@prisma/adapter-pg`, Postgres |
| Styling | NativeWind v4 + Tailwind 3 | Tailwind v4 |
| State / reactivity | Zustand 5 + WatermelonDB `withObservables` | Server components |
| Object storage | presigned uploads via backend | `@aws-sdk/client-s3` + `s3-request-presigner` → Cloudflare R2 |
| Push | `expo-notifications` (device token) | `firebase-admin` (FCM) |
| Native | Notifee, Kotlin modules (device admin, overlay service, exact alarms) | — |
| Sensors | `expo-sensors` (pedometer) | — |
| Crypto | `crypto-js`, `expo-crypto`, `expo-secure-store` | scrypt (auth), HMAC (session) |
| Scraping | — | `cheerio` (WakaTime fallback) |
| Package manager | **bun** | **bun** |
| Tests | Jest 29 + ts‑jest | Vitest 4 |

> ⚠️ **Next.js caveat:** this Next.js version has breaking changes vs. common training data. Consult `web-dashboard/node_modules/next/dist/docs/` before writing web code (see `web-dashboard/AGENTS.md`).

---

## 6. Repository layout

```
mivida/
├── AUDIT.md                 # Evidence-backed audit of the codebase
├── ARCHITECTURE.md          # Final schema, sync contract, cron, migration plan
├── CHANGELOG.md             # Chronological change log
├── CLAUDE.md                # Contributor guardrails & verified architecture facts
├── README.md                # ← you are here
│
├── mobile-app/              # React Native / Expo client
│   ├── app/                 # expo-router screens
│   │   ├── _layout.tsx      # Root: init sync/push/sensors, launch-time task maintenance
│   │   ├── index.tsx
│   │   └── (tabs)/          # dashboard · finance · music · profile · index (tasks)
│   ├── components/          # Modals & UI (TaskCard, FocusLockModal, ContactModal, …)
│   ├── services/            # Business logic (one file per concern — see below)
│   ├── database/            # WatermelonDB schema.ts, migrations.ts, models/
│   ├── store/               # Zustand stores
│   ├── android/             # Native project incl. Kotlin modules
│   │   └── app/src/main/java/com/mivida/app/
│   │       ├── DeviceAdminModule.kt        # LockTask / screen pinning
│   │       ├── LockdownOverlayService.kt   # Foreground service + overlay window
│   │       ├── FocusScheduleModule.kt      # Exact-alarm scheduled focus
│   │       └── FocusAlarmReceiver.kt       # Fire + BOOT_COMPLETED re-arm
│   ├── tailwind.config.js   # Design tokens (accent green #C0F67F, blue #4AC3FF)
│   └── .env.example
│
└── web-dashboard/           # Next.js dashboard + API backend
    ├── src/app/
    │   ├── api/
    │   │   ├── m/           # Mobile namespace: sync, register-push, upload/presign
    │   │   ├── w/           # Web namespace: auth, contacts, categories, google oauth, push-test
    │   │   └── cron/        # Server time-authority
    │   └── …                # Dashboard pages
    ├── src/lib/             # sync.ts, cron.ts, prisma.ts, auth.ts, r2.ts, fcm.ts,
    │                        # google.ts, calendarSync.ts, wakatime.ts, lifecycle.ts, env.ts
    ├── prisma/
    │   ├── schema.prisma    # 24 models
    │   └── migrations/      # SQL migrations (additive)
    ├── scripts/hash-password.js
    ├── vercel.json          # Cron schedule (*/15 * * * *)
    └── .env.example
```

**Notable mobile services** (`mobile-app/services/`): `syncService`, `eventLogger`, `taskService` / `taskLifecycle` / `taskMaintenance`, `lockdown` / `lockdownOverlay` / `lockTaskService` / `focusSchedule`, `vaultService` / `vaultEncryptionService`, `financeService`, `moodService`, `musicService`, `contactService` / `delegationService`, `insights`, `sensorService`, `pushService`, `notifications`, `calendarService`, `analyticsService`, `dbBackup`, `uploadService` / `apiConfig`.

---

## 7. Prerequisites

- **[Bun](https://bun.sh)** ≥ 1.1 (package manager for both apps).
- **Node.js** ≥ 20 (some tooling/scripts).
- **PostgreSQL** database (local Docker, or a managed provider such as Aiven).
- **Android toolchain** for the mobile app: Android Studio / SDK, a JDK, and either a physical device (USB debugging) or an emulator. (iOS is scaffolded via `expo run:ios` but Android is the target platform.)
- Optional cloud accounts for full functionality: **Cloudflare R2**, **Google Cloud** (Calendar OAuth), **Firebase** (FCM), **WakaTime**.

---

## 8. Getting started (local setup)

```bash
git clone https://github.com/learnershakil/mivida.git
cd mivida
```

### 8.1 Backend (`web-dashboard/`) — start this first

```bash
cd web-dashboard
bun install

# 1. Configure environment
cp .env.example .env
#    → fill in DATABASE_URL, MOBILE_HTTP_KEY, SESSION_SECRET, CRON_SECRET at minimum.

# 2. Create the first web-admin password hash and paste it into .env (WEB_ADMIN_PASSWORD_HASH)
node scripts/hash-password.js 'your-strong-password'   # prints scrypt:<saltHex>:<hashHex>

# 3. Apply migrations & generate the Prisma client
bunx prisma migrate deploy
bunx prisma generate

# 4. Run the dev server (dashboard + API on http://localhost:3000)
bun run dev
```

Log in at `http://localhost:3000` with `WEB_ADMIN_EMAIL` and the password you hashed.

### 8.2 Mobile (`mobile-app/`)

```bash
cd ../mobile-app
bun install

# 1. Configure environment
cp .env.example .env
#    Set EXPO_PUBLIC_API_URL so the device can reach the backend:
#      Android emulator → http://10.0.2.2:3000
#      Physical device  → http://<your-LAN-IP>:3000   (e.g. http://192.168.1.20:3000)
#    EXPO_PUBLIC_HTTP_KEY is a dev fallback; prefer setting the key in secure-store
#    at runtime via SyncService.setHttpKey(). It MUST equal the server's MOBILE_HTTP_KEY.

# 2. Build & run on Android (bare workflow → needs a native build)
bun run android           # = expo run:android  (installs onto the connected device/emulator)

# For subsequent JS-only iteration you can just run the Metro bundler:
bun run start             # then press "a" / reload on device
```

> **Physical device tip:** if the app can't reach the backend, either put the device on the same LAN and use your host IP, or run `adb reverse tcp:3000 tcp:3000` and point `EXPO_PUBLIC_API_URL` at `http://localhost:3000`. Remember `EXPO_PUBLIC_*` values are **inlined at bundle time** — restart Metro with `--clear` after changing them.

### 8.3 Local Postgres via Docker (optional)

```bash
docker run --name mivida-pg -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=mivida \
  -p 5432:5432 -d postgres:16
# DATABASE_URL="postgres://postgres:dev@localhost:5432/mivida?sslmode=disable"
```

---

## 9. Environment variables

### 9.1 `web-dashboard/.env`

| Variable | Required | Purpose |
|---|:---:|---|
| `DATABASE_URL` | ✅ | Postgres connection string. |
| `DATABASE_CA_CERT` | | PEM of a self‑signed CA (e.g. Aiven) for verified TLS. If unset, the pool falls back to encrypted‑but‑unverified TLS (scoped to the pool only). |
| `MOBILE_HTTP_KEY` | ✅ | The single shared key the device sends as `x-http-key` (verified constant‑time). Long random value. |
| `SESSION_SECRET` | ✅ | HMAC secret for the web session cookie. |
| `WEB_ADMIN_EMAIL` | ✅ | First‑run web admin login email. |
| `WEB_ADMIN_PASSWORD_HASH` | ✅ | scrypt hash `scrypt:<saltHex>:<hashHex>` — generate with `node scripts/hash-password.js '<password>'`. |
| `R2_ENDPOINT` / `R2_BUCKET` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | | Cloudflare R2 object storage for presigned uploads. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` | | Google Calendar OAuth (server‑side tokens). |
| `TOKEN_ENC_KEY` | | Encrypts Google access/refresh tokens at rest. |
| `WAKATIME_API_KEY` | | WakaTime coding stats (preferred). `WAKATIME_USERNAME` / `WAKATIME_PASSWORD` only for the scrape fallback. |
| `CRON_SECRET` | ✅ | Guards the internal `/api/cron` route. Long random value. |

### 9.2 `mobile-app/.env`

| Variable | Required | Purpose |
|---|:---:|---|
| `EXPO_PUBLIC_API_URL` | ✅ | Base URL of the backend. Inlined into the bundle at build time. |
| `EXPO_PUBLIC_HTTP_KEY` | | Dev fallback for the mobile key. **Not secret** (ships in the bundle) — prefer `SyncService.setHttpKey()` into secure‑store. Must equal server `MOBILE_HTTP_KEY`. |

> **Never commit `.env` files** — both are gitignored. R2/Google/FCM secrets stay server‑side only.

---

## 10. Data model & sync contract

### 10.1 Postgres (Prisma) — 24 models

`User`, `PushToken`, `Profile`, `Setting`, `Task`, `TaskInstance`, `Category`, `Contact`, `EventLog`, `FinanceLog`, `MoodLog`, `MusicTrack`, `MusicCategory`, `VaultItem`, `FocusSession`, `Schedule`, `NotificationLog`, `CodingLog`, `UsageStat`, `SensorStat`, `Insight`, `SyncState`, `GoogleAuth`, `WakatimeCache`.

The device mirrors the syncable subset in **WatermelonDB (schema v19)** — tasks, contacts, finance, mood, music, vault (metadata), event logs, sensors, settings, categories, etc.

### 10.2 Sync contract (verified — do not re‑derive)

- **Engine:** WatermelonDB `synchronize()` — `pullChanges(?lastPulledAt=)` + `pushChanges`. The client owns `_status`/`_changed`; never touch them.
- **Mapping:** a **DMMF‑driven generic mapper** (`src/lib/sync.ts`) converts snake_case↔camelCase, millis↔BigInt/DateTime, and JSON‑strings↔Json for every table. Device columns with no matching Prisma field are simply dropped.
- **Idempotency & atomicity:** each row carries a stable client UUID; the server **upserts by id** inside `prisma.$transaction`. Re‑posting a batch is a no‑op.
- **Conflict rule:** `updated_at` last‑write‑wins; the server uses its own arrival time for the returned watermark, which advances **only** after a fully successful round‑trip.
- **Vault sanitizer:** the payload builder strips vault plaintext — only ciphertext + the R2 key + safe metadata traverse the wire.

---

## 11. API reference

Two isolated namespaces plus the cron route. Mobile requests carry `x-http-key`; web requests carry the HMAC session cookie.

| Method | Route | Namespace | Purpose |
|---|---|---|---|
| GET/POST | `/api/m/sync` | mobile | WatermelonDB pull/push. |
| POST | `/api/m/register-push` | mobile | Register the device FCM token. |
| POST | `/api/m/upload/presign` | mobile | Issue a presigned R2 PUT/GET URL. |
| POST | `/api/w/auth/login` | web | Email + password → session cookie. |
| POST | `/api/w/auth/logout` | web | Clear the session. |
| GET | `/api/w/auth/session` | web | Current session status. |
| GET/POST | `/api/w/contacts` | web | Contacts CRUD (dashboard). |
| GET/POST | `/api/w/categories` · `/api/w/categories/[id]` | web | Category master‑list. |
| GET | `/api/w/google/oauth/start` → `/callback` | web | Google Calendar OAuth handshake. |
| POST | `/api/w/push-test` | web | Send a test FCM push. |
| POST/GET | `/api/cron` | internal | Server time‑authority (guarded by `CRON_SECRET`). |
| — | `/api/sync`, `/api/wakatime/sync` | legacy | Transitional aliases (superseded by `/api/m/*`). |

---

## 12. Background jobs (server time‑authority)

`vercel.json` schedules `/api/cron` every 15 minutes. `src/lib/cron.ts` runs (guarded by `CRON_SECRET`):

| Job | What it does |
|---|---|
| `renewFixed` | 5 AM renewal of fixed daily tasks. |
| `failExpiredCustom` | Custom tasks past 6 h → distinct `failed` state. |
| `triggerScheduledFinance` | Fire scheduled transactions when due. |
| `allocateFixedInstances` | Materialise upcoming fixed‑task instances. |
| `fatigueTrigger` | High screen‑time + low steps (per‑user thresholds) → auto physical‑activity task. |
| `syncWakatime` | Pull daily coding stats (upserted). |
| `syncCalendar` | Reconcile Google Calendar events. |
| `sendMoodPings` | FCM mood check‑in at each user's configured interval. |

On‑device launch‑time maintenance (`app/_layout.tsx`) is a UX convenience; the cron is the authority for a closed phone.

---

## 13. Security model

- **Mobile ⇄ backend:** a single shared `x-http-key`, verified in **constant time** (no timing oracle, no silent user provisioning). Prefer storing the key in `expo-secure-store` over the bundled env fallback.
- **Web auth:** scrypt password hashing + HMAC‑signed session cookie.
- **Vault:** notes AES‑encrypted at rest; media encrypted before R2 upload. Plaintext never enters sync, logs, analytics, or the DatabaseBrowser. Wrong‑passcode lockout with exponential backoff. (Full SQLCipher DB‑at‑rest is **not** feasible with the current WatermelonDB adapter and is documented as such — note content is already AES‑encrypted.)
- **TLS:** scoped to the Postgres pool with optional CA‑cert verification; **no** process‑wide TLS bypass.
- **Secrets:** env / secure‑store only; R2/Google/FCM secrets stay server‑side; `.env` gitignored.

---

## 14. Native Android lockdown — honest capability matrix

The app runs as a **normal app** (not Device Owner). On stock non‑rooted **MIUI/HyperOS** it cannot truly lock the user in. It builds the strongest feasible approximation and states the limits plainly.

| Capability | Enforceable? | Reality |
|---|:---:|---|
| Focus/countdown UI while foreground | ✅ | Native overlay + JS UI. |
| Full‑screen system overlay | ✅ | `LockdownOverlayService` foreground service + `TYPE_APPLICATION_OVERLAY` (requires the "display over other apps" permission). |
| Scheduled focus auto‑start (app closed) | ✅ | Exact alarm (`FocusScheduleModule`) → starts the overlay service; re‑arms on `BOOT_COMPLETED`. |
| Block hardware **Back** | ⚠️ best‑effort | `BackHandler`; Home/Recents can still exit. |
| Prevent leaving the app | ❌ best‑effort | Detects departure and applies a penalty; cannot force‑block. |
| Block power button / power‑off | ❌ impossible | Not possible on stock non‑rooted Android. |
| True kiosk (non‑dismissable) | ❌ | Needs Device Owner provisioning (factory reset) — intentionally not used. |
| Background survival on MIUI | ⚠️ manual | Requires user‑granted Autostart, battery "No restrictions", and lock‑in‑Recents — cannot be forced programmatically. |

See `AUDIT.md §5.4 / §D` for the full matrix and MIUI setup caveats.

---

## 15. Development workflow

### 15.1 Commands

| | mobile‑app | web‑dashboard |
|---|---|---|
| Install | `bun install` | `bun install` |
| Dev / run | `bun run android` · `bun run start` | `bun run dev` |
| Build | `expo prebuild` / Android build | `bun run build` |
| Typecheck | `bun run typecheck` | `bun run typecheck` |
| Test | `bun run test` (Jest) | `bun run test` (Vitest) |
| Lint | `bun run lint` | `bun run lint` |
| Prisma | — | `bunx prisma migrate deploy` · `bunx prisma generate` · `bunx prisma studio` |

### 15.2 Design system

Keep the mobile app's current design 100% intact; the web app mirrors it. Tokens live in `mobile-app/tailwind.config.js`. Screens/modals are **light** (white `rounded-t-[40px]` sheets, `gray-50` cards, dark `#1E1E1E` text, `X` close button); accents are **green `#C0F67F`**, **blue `#4AC3FF`**, dark surface `#1E1E1E`. `Alert.alert` is globally themed via a dark `CustomAlertProvider`.

### 15.3 Verify after every change

Run `typecheck` + relevant tests (and a build where feasible) in the app(s) you touched, and report results. Current green baseline: **mobile `tsc` 0 errors / 43 Jest tests**; **web `tsc` 0 errors / 22 Vitest tests**.

### 15.4 Git discipline

Branch off `main`; focused **conventional commits**; clean tree; never force‑push; never commit secrets. Commit/push only when asked.

---

## 16. How to make modifications

### 16.1 Add a new field that syncs end‑to‑end

This is the most common change. Example: adding `contacts.source` (already shipped — mirror it).

1. **Device schema** — add the column and **bump the version** in `mobile-app/database/schema.ts`:
   ```ts
   export const SCHEMA_VERSION = 20; // was 19
   // …inside the contacts table columns:
   { name: 'source', type: 'string', isOptional: true },
   ```
2. **Device migration** — append an **ascending, additive** migration in `mobile-app/database/migrations.ts`:
   ```ts
   { toVersion: 20, steps: [ addColumns({ table: 'contacts', columns: [{ name: 'source', type: 'string', isOptional: true }] }) ] }
   ```
3. **Model** — add the decorated field in `mobile-app/database/models/Contact.ts`:
   ```ts
   @field('source') source?: string;
   ```
4. **Service** — thread it through create/update in `mobile-app/services/contactService.ts`.
5. **UI** — wire the input/state in the relevant component (e.g. `ContactModal.tsx`).
6. **Prisma** — add the matching nullable column to `web-dashboard/prisma/schema.prisma` (**same camelCase name** so the DMMF mapper auto‑maps it), then:
   ```bash
   cd web-dashboard
   # create prisma/migrations/<timestamp>_contact_source/migration.sql with:
   #   ALTER TABLE "Contact" ADD COLUMN "source" TEXT;
   bunx prisma migrate deploy && bunx prisma generate
   ```
7. **Verify** — `bun run typecheck && bun run test` in both apps.
8. **Reload the app fully** (not just Metro fast‑refresh) so the WatermelonDB migration runs at startup.

> The generic mapper means you usually **don't** touch `sync.ts` — matching column names carry the field automatically. Add a sync alias only when names must differ, and always keep vault plaintext out of the payload.

### 16.2 Other common changes

- **Add an API endpoint:** create `web-dashboard/src/app/api/{m|w}/<name>/route.ts`. Mobile routes verify `x-http-key`; web routes verify the session (`src/lib/auth.ts`). Keep the namespaces isolated.
- **Add a cron job:** implement it in `src/lib/cron.ts`, add it to `runCron` + the `CronReport`, and store any marker on `SyncState`. Advance markers only on success.
- **Add an insight:** add a pure function + types to `mobile-app/services/insights.ts`, unit‑test it in `insights.test.ts`, then render it in `app/(tabs)/dashboard.tsx` and (optionally) mirror it server‑side.
- **Change task lifecycle rules:** edit `mobile-app/services/taskLifecycle.ts` and the server twin `web-dashboard/src/lib/lifecycle.ts`; both are unit‑tested — keep them in sync.

---

## 17. Deployment

### 17.1 Backend → Vercel (recommended)

1. Import `web-dashboard/` into Vercel.
2. Set **all** `web-dashboard` env vars in the project settings (Production + Preview).
3. Ensure `DATABASE_URL` points at your production Postgres and run migrations against it:
   ```bash
   DATABASE_URL=<prod> bunx prisma migrate deploy
   ```
4. `vercel.json` already registers the cron (`*/15 * * * *` → `/api/cron`). Vercel calls it; the route is guarded by `CRON_SECRET`.
5. Set `GOOGLE_REDIRECT_URI` to the production callback (`https://<domain>/api/w/google/oauth/callback`) and complete the one‑time Google consent from the dashboard.

Any Node host works too — build with `bun run build` and serve with `bun run start`, then wire an external scheduler to POST `/api/cron` with the `CRON_SECRET`.

### 17.2 Cloud service setup

- **Cloudflare R2:** create a bucket, generate an access key pair, set `R2_*`. Uploads are presigned server‑side; R2 secrets never reach the device.
- **Firebase / FCM:** create the Android app with applicationId `me.learnershakil.mivida`, download `google-services.json` into `mobile-app/android/app/`, and set the `firebase-admin` service‑account credentials in the backend env.
- **Google Calendar:** create OAuth credentials, set `GOOGLE_*` + `TOKEN_ENC_KEY`, and authorise once via `/api/w/google/oauth/start`.
- **WakaTime:** set `WAKATIME_API_KEY`.

### 17.3 Mobile → Android build

```bash
cd mobile-app
bun run android                    # dev build onto a connected device
# Release build:
cd android && ./gradlew assembleRelease   # → app/build/outputs/apk/release/
```

- Point `EXPO_PUBLIC_API_URL` at your deployed backend **before** building (it is inlined into the bundle).
- On MIUI, `gradlew installDebug`/`installRelease` may hit `INSTALL_FAILED_USER_RESTRICTED`; use `adb install -r <apk>` instead.
- Signing: configure a release keystore in `android/app/build.gradle` (standard React Native release‑signing flow).

---

## 18. Testing & verification

```bash
# Mobile
cd mobile-app && bun run typecheck && bun run test      # tsc + Jest (43 tests)

# Web
cd web-dashboard && bun run typecheck && bun run test   # tsc + Vitest (22 tests)
```

Test coverage focuses on the risky boundaries: sync idempotency / LWW / **vault‑no‑plaintext**, the task state machine (custom fail, fixed renewal, 16 h hide), the four analytics computations, and Google/lifecycle helpers. Add tests alongside new logic (`*.test.ts` next to the source).

---

## 19. Troubleshooting

| Symptom | Fix |
|---|---|
| App can't reach backend on a physical device | Use your host LAN IP in `EXPO_PUBLIC_API_URL`, or `adb reverse tcp:3000 tcp:3000` + `http://localhost:3000`. Rebuild Metro with `--clear` after env changes. |
| Env var change not taking effect | `EXPO_PUBLIC_*` is inlined at bundle time — restart Metro with `--clear`. |
| Metro "Unable to resolve <module>" after installing a dep | Restart Metro with `--clear`. |
| New column errors after a schema bump | Fully **reload/restart** the app so the WatermelonDB migration runs (fast‑refresh does not re‑init the DB). |
| `INSTALL_FAILED_USER_RESTRICTED` on MIUI | Use `adb install -r <apk>` instead of the gradle install task. |
| `adb` can't inject touch on MIUI | MIUI blocks `INJECT_EVENTS`; drive the UI manually. |
| Prisma "column does not exist" | `bunx prisma migrate deploy && bunx prisma generate`. |
| TLS/self‑signed DB errors | Paste the CA PEM into `DATABASE_CA_CERT`. |

---

## 20. Roadmap & deferred work

Shipped & verified: backend skeleton + two namespaces, full sync engine with vault sanitizer, task correctness + server cron, vault fixes, finance/music/profile sync, R2 upload wiring, FCM mood pings, sensors + insights + Insights settings, native lockdown overlay + scheduled‑focus exact alarm/boot re‑arm, web login gate, light‑theme Contacts/Delegation + contact `source`.

Deferred (need external consent, larger UI, or platform features): full web CRUD parity for every domain, Google Calendar one‑time browser consent in production, richer MIUI permission‑setup wizard, and media/DB‑at‑rest encryption beyond the current AES vault. See `CHANGELOG.md` and `AUDIT.md` for specifics.

---

## 21. Further documentation

| Doc | What's inside |
|---|---|
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | Final Prisma schema, 1:1 WatermelonDB mapping, sync contract, two‑namespace API, R2 presign, Google OAuth, cron jobs, migration plan. |
| [`AUDIT.md`](./AUDIT.md) | Evidence‑backed state of the codebase, corrections to assumptions, honest lockdown matrix, tech‑debt backlog. |
| [`CHANGELOG.md`](./CHANGELOG.md) | Chronological record of every slice. |
| [`CLAUDE.md`](./CLAUDE.md) | Contributor guardrails and verified architecture facts (read before implementing). |

---

<div align="center">
<sub>Mi Vida · single‑user, offline‑first · built with React Native, Next.js, Prisma & WatermelonDB.</sub>
</div>
