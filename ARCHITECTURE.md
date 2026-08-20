# Mi Vida — Phase 2 Architecture

> Design contract for Phase 3 implementation. Reconciled against the **actual** WatermelonDB schema
> (`mobile-app/database/schema.ts`, v13) and the existing sync route — not the brief's proposal. Read
> `AUDIT.md` first. Decisions here are binding unless a Phase-3 discovery contradicts them (record any such
> deviation back into `AUDIT.md`).

## 0. Principles carried from Phase 1

- **Keep the WatermelonDB `synchronize()` engine.** The server adapts to *its* pull/push shape; we do not
  hand-roll a protocol and never touch `_status`/`_changed`.
- **Offline-first is invariant.** Every device feature works with zero network; the server is additive.
- **Server owns wall-clock truth.** A backend cron drives the time transitions; device timers are UX.
- **Vault plaintext never leaves the device.** Server stores ciphertext + metadata only.
- **Secrets in env/secure-store only.** No secrets in the bundle or the DB in plaintext.
- **Single user, multi-row-ready.** One `User` row today; all models keep `userId` FKs so nothing has to be
  restructured later.

---

## 1. Identity & auth model

Single human, two clients, **two disjoint endpoint namespaces**:

- **`/api/m/*` — mobile.** Auth = `x-http-key` header, verified by **constant-time compare** against the
  server's configured key (env `MOBILE_HTTP_KEY`), then resolve the single `User` by `xHttpKey`. **No more
  "upsert-by-whatever-key"** (the current silent-provisioning hole, `AUDIT.md §3.2`). Unknown key → 401.
- **`/api/w/*` — web.** Auth = **httpOnly signed session cookie** (`iron-session`-style / signed JWT in a
  cookie; `SESSION_SECRET` in env). Login verifies `email` + `passwordHash` (argon2/bcrypt). Middleware
  guards every `/api/w/*` route and every dashboard page (today `page.tsx` renders unconditionally).

`User` holds **both** credentials (mobile `xHttpKey`, web `email`/`passwordHash`) because it is one person.
The device's `users` row (name/avatar/awake) maps to **`Profile`**, not to auth.

---

## 2. Final Prisma schema

Conventions for every **device-synced** model (so WatermelonDB sync + LWW work uniformly):
- `id String @id` — **the WatermelonDB record id** (or a web-generated `uuid()` for web-authored rows).
  Upserting by this id is what makes push idempotent.
- `updatedAt BigInt` — the device-reported `updated_at` in **epoch millis**; the **LWW comparator**.
- `serverUpdatedAt DateTime @updatedAt @db.Timestamptz` — server clock; **indexed**; drives pull deltas.
- `deletedAt BigInt?` — soft delete (millis) where the device table has it.
- Millis time fields stay `BigInt` (WatermelonDB sends numbers); booleans/strings map directly.

```prisma
// Prisma 7: the connection `url` is NOT declared here — it lives in prisma.config.ts
// (loaded via `import "dotenv/config"`), and the client is constructed with @prisma/adapter-pg.
datasource db {
  provider = "postgresql"
}

generator client {
  provider = "prisma-client-js"
}

// ─────────────────────────── IDENTITY ───────────────────────────
model User {
  id           String   @id @default(uuid())
  email        String?  @unique            // web login
  passwordHash String?                     // argon2/bcrypt (web)
  xHttpKey     String   @unique            // mobile auth (constant-time compared)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  profile         Profile?
  setting         Setting?
  syncState       SyncState?
  googleAuth      GoogleAuth?
  tasks           Task[]
  taskInstances   TaskInstance[]
  categories      Category[]
  contacts        Contact[]
  events          EventLog[]
  financeLogs     FinanceLog[]
  moodLogs        MoodLog[]
  musicTracks     MusicTrack[]
  musicCategories MusicCategory[]
  vaultItems      VaultItem[]
  focusSessions   FocusSession[]
  schedules       Schedule[]
  notifications   NotificationLog[]
  codingLogs      CodingLog[]
  usageStats      UsageStat[]
  sensorStats     SensorStat[]
  insights        Insight[]
}

// mirrors device `users` (projection, NOT auth)
model Profile {
  id              String   @id                 // device user id (e.g. "local_user")
  userId          String   @unique
  user            User     @relation(fields: [userId], references: [id])
  name            String?
  avatarR2Key     String?                       // R2 key; replaces local avatarUrl
  passcode        String?                       // legacy device field; unused
  isAwake         Boolean  @default(false)
  lastInteraction BigInt?
  updatedAt       BigInt
  serverUpdatedAt DateTime @updatedAt @db.Timestamptz
  @@index([serverUpdatedAt])
}

// mirrors device `settings` (one row/user) + adds insights JSON
model Setting {
  id                            String   @id
  userId                        String   @unique
  user                          User     @relation(fields: [userId], references: [id])
  deadManThresholdMinutes       Int      @default(180)
  deadManEnabled                Boolean  @default(true)
  notificationIntensity         String   @default("normal")
  notificationSound             String   @default("default")
  customNotificationSoundUri     String?
  customNotificationSoundName    String?
  notificationSoundEnabled      Boolean  @default(true)
  notificationVibrationEnabled  Boolean  @default(true)
  lockdownStrictness            String   @default("normal")   // normal|strict|extreme
  lockdownAllowCalls            Boolean  @default(true)
  taskMode                      String   @default("weekday")  // canonical day-mode
  autoLoadFixedTasks            Boolean  @default(true)
  exportFormat                  String   @default("jsonl")
  includeDeviceInfo             Boolean  @default(true)
  timezone                      String   @default("UTC")
  vaultPasscodeHash             String?
  vaultAutoLockMinutes          Int      @default(5)
  moodTrackerEnabled            Boolean  @default(false)
  moodTrackerIntervalMinutes    Int      @default(45)
  insights                      Json?    // { [metric]: { enabled, thresholds… } } — Insights group
  lastSyncTimestamp             BigInt?
  updatedAt                     BigInt
  serverUpdatedAt               DateTime @updatedAt @db.Timestamptz
  @@index([serverUpdatedAt])
}

// ─────────────────────────── TASKS ───────────────────────────
model Task {
  id                    String    @id
  userId                String
  user                  User      @relation(fields: [userId], references: [id])
  title                 String
  description           String?
  categoryId            String?                              // NEW: FK to master Category
  category              Category? @relation(fields: [categoryId], references: [id])
  categoryName          String?                              // denormalized (device sends free text today)
  expectedDurationMinutes Int?
  type                  String                               // custom|fixed|alert
  priority              String    @default("normal")
  assignedPersons       Json?                                // legacy free-text names
  contactId             String?
  contact               Contact?  @relation(fields: [contactId], references: [id])
  startDate             BigInt?
  endDate               BigInt?
  startTime             BigInt?
  endTime               BigInt?
  isTimeOnly            Boolean   @default(false)            // NEW: fixed tasks are time-only
  status                String    @default("pending")        // pending|active|paused|completed|failed|incomplete|cancelled
  isActive              Boolean   @default(false)
  isCompleted           Boolean   @default(false)
  completionPercent     Int       @default(0)
  timerStartedAt        BigInt?
  totalElapsedSeconds   Int       @default(0)
  completionRemark      String?                              // NOW persisted (was write-only-to-events)
  completedAt           BigInt?                              // NEW: fixes the 16h-hide bug
  failedAt              BigInt?                              // NEW: distinct failed state
  scheduledDate         BigInt?
  scheduledTime         BigInt?
  alertType             String?
  alertIntervalMinutes  Int?
  isAlertActive         Boolean?  @default(false)
  lastAlertTriggeredAt  BigInt?
  isDelegated           Boolean   @default(false)
  delegatedTo           String?
  delegatedStatus       String?
  isCancelled           Boolean?  @default(false)
  cancelledAt           BigInt?
  cancelReason          String?
  googleEventId         String?                              // NEW: Google Calendar event id (dedupe)
  createdAt             BigInt
  updatedAt             BigInt
  deletedAt             BigInt?
  serverUpdatedAt       DateTime  @updatedAt @db.Timestamptz
  instances             TaskInstance[]
  @@index([userId, type])
  @@index([serverUpdatedAt])
}

// NEW: per-day instance for fixed tasks (7-day allocation + renewal history)
model TaskInstance {
  id              String   @id
  userId          String
  user            User     @relation(fields: [userId], references: [id])
  taskId          String
  task            Task     @relation(fields: [taskId], references: [id])
  date            BigInt                                     // day bucket (midnight millis)
  status          String   @default("pending")              // pending|completed|failed|incomplete
  completedAt     BigInt?
  remark          String?
  googleEventId   String?
  updatedAt       BigInt
  serverUpdatedAt DateTime @updatedAt @db.Timestamptz
  @@unique([taskId, date])
  @@index([serverUpdatedAt])
}

// NEW: master category list (web-authored + mobile-created)
model Category {
  id              String   @id @default(uuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id])
  name            String
  color           String?
  source          String   @default("web")                  // web|mobile
  createdAt       BigInt
  updatedAt       BigInt
  deletedAt       BigInt?
  serverUpdatedAt DateTime @updatedAt @db.Timestamptz
  tasks           Task[]
  @@unique([userId, name])
  @@index([serverUpdatedAt])
}

model Contact {
  id              String   @id
  userId          String
  user            User     @relation(fields: [userId], references: [id])
  name            String
  email           String?
  phone           String?
  socials         Json?
  createdAt       BigInt
  updatedAt       BigInt
  deletedAt       BigInt?
  serverUpdatedAt DateTime @updatedAt @db.Timestamptz
  tasks           Task[]
  @@index([serverUpdatedAt])
}

// ─────────────────────────── EVENT LOG (idempotency spine) ───────────────────────────
model EventLog {
  id              String   @id                               // WatermelonDB id == client event id
  userId          String
  user            User     @relation(fields: [userId], references: [id])
  eventType       String
  entityType      String?
  entityId        String?
  payload         Json
  deviceId        String?
  sessionId       String?
  timezone        String
  schemaVersion   Int
  createdAt       BigInt
  serverUpdatedAt DateTime @updatedAt @db.Timestamptz
  @@index([userId, eventType])
  @@index([serverUpdatedAt])
  // append-only; id uniqueness is the double-write guard (see §3.3)
}

// ─────────────────────────── FINANCE (append-only ledger) ───────────────────────────
model FinanceLog {
  id              String   @id
  userId          String
  user            User     @relation(fields: [userId], references: [id])
  amount          Float
  type            String                                     // credit|debit (INCOME|EXPENSE)
  category        String?
  source          String?
  destination     String?
  description     String?
  transactionDate BigInt
  isScheduled     Boolean  @default(false)
  scheduledFor    BigInt?
  isTriggered     Boolean  @default(true)
  isCancelled     Boolean  @default(false)
  createdAt       BigInt
  updatedAt       BigInt
  deletedAt       BigInt?
  serverUpdatedAt DateTime @updatedAt @db.Timestamptz
  @@index([serverUpdatedAt])
}

model MoodLog {
  id              String   @id
  userId          String
  user            User     @relation(fields: [userId], references: [id])
  mood            String
  moodValue       Int                                        // 1..5 (see §7 mood note)
  level           Int
  score10         Int?                                       // NEW: raw 1..10 (stop stuffing in note)
  note            String?
  createdAt       BigInt
  updatedAt       BigInt
  deletedAt       BigInt?
  serverUpdatedAt DateTime @updatedAt @db.Timestamptz
  @@index([serverUpdatedAt])
}

// ─────────────────────────── MUSIC ───────────────────────────
model MusicTrack {
  id              String   @id
  userId          String
  user            User     @relation(fields: [userId], references: [id])
  title           String
  artist          String
  album           String?
  r2Key           String?                                    // cloud copy
  localPathHint   String?                                    // was file_uri
  fileName        String
  albumArtR2Key   String?
  duration        Int
  category        String
  isFavorite      Boolean  @default(false)
  playCount       Int      @default(0)
  createdAt       BigInt
  updatedAt       BigInt
  serverUpdatedAt DateTime @updatedAt @db.Timestamptz
  @@index([serverUpdatedAt])
}

model MusicCategory {
  id              String   @id
  userId          String
  user            User     @relation(fields: [userId], references: [id])
  name            String
  icon            String?
  color           String?
  defaultArtUri   String?
  position        Int      @default(0)
  isSystem        Boolean  @default(false)
  createdAt       BigInt
  updatedAt       BigInt
  serverUpdatedAt DateTime @updatedAt @db.Timestamptz
  @@index([serverUpdatedAt])
}

// ─────────────────────────── VAULT (ciphertext only, metadata-safe) ───────────────────────────
model VaultItem {
  id              String   @id
  userId          String
  user            User     @relation(fields: [userId], references: [id])
  kind            String                                     // note|image|video|audio
  r2Key           String?                                    // encrypted blob in R2
  ciphertextRef   String?                                    // encrypted note body (AES)
  encTitle        String?                                    // encrypted title
  encMeta         Json?                                      // IV, algo, encrypted filename, etc.
  duration        Int?
  createdAt       BigInt
  updatedAt       BigInt
  deletedAt       BigInt?
  serverUpdatedAt DateTime @updatedAt @db.Timestamptz
  @@index([serverUpdatedAt])
  // NO plaintext columns. Ever.
}

// ─────────────────────────── FOCUS / SCHEDULING ───────────────────────────
model FocusSession {
  id              String   @id
  userId          String
  user            User     @relation(fields: [userId], references: [id])
  kind            String                                     // focus|break
  forcedPostBreak Boolean  @default(false)
  strictness      String   @default("normal")
  scheduledFor    BigInt?
  startedAt       BigInt?
  endedAt         BigInt?
  breakAttempts   Int      @default(0)
  panicExit       Boolean  @default(false)                   // panic-exit audit
  createdAt       BigInt
  updatedAt       BigInt
  serverUpdatedAt DateTime @updatedAt @db.Timestamptz
  @@index([serverUpdatedAt])
}

model Schedule {
  id              String   @id @default(uuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id])
  kind            String                                     // focus|mood|...
  rule            String                                     // rrule string or "HH:mm"
  enabled         Boolean  @default(true)
  createdAt       BigInt
  updatedAt       BigInt
  serverUpdatedAt DateTime @updatedAt @db.Timestamptz
  @@index([serverUpdatedAt])
}

model NotificationLog {
  id              String   @id
  userId          String
  user            User     @relation(fields: [userId], references: [id])
  type            String
  title           String
  body            String?
  imagePath       String?
  inputPrompt     String?
  inputOptions    String?
  userResponse    String?
  status          String
  scheduledFor    BigInt?
  triggeredAt     BigInt?
  viewedAt        BigInt?
  respondedAt     BigInt?
  dismissedAt     BigInt?
  createdAt       BigInt
  updatedAt       BigInt
  serverUpdatedAt DateTime @updatedAt @db.Timestamptz
  @@index([serverUpdatedAt])
}

// ─────────────────────────── ANALYTICS SOURCES / CACHE ───────────────────────────
model CodingLog {
  id              String   @id @default(uuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id])
  date            BigInt
  duration        Int
  project         String?
  language        String?
  createdAt       BigInt
  updatedAt       BigInt
  deletedAt       BigInt?
  serverUpdatedAt DateTime @updatedAt @db.Timestamptz
  @@unique([userId, date, project, language])                // fixes duplicate inserts (AUDIT §7)
  @@index([serverUpdatedAt])
}

model UsageStat {                                            // NEW: Android usage-stats
  id              String   @id @default(uuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id])
  date            BigInt
  totalScreenMs   BigInt
  perApp          Json?
  serverUpdatedAt DateTime @updatedAt @db.Timestamptz
  @@unique([userId, date])
}

model SensorStat {                                           // NEW: pedometer
  id              String   @id @default(uuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id])
  date            BigInt
  steps           Int
  meta            Json?
  serverUpdatedAt DateTime @updatedAt @db.Timestamptz
  @@unique([userId, date])
}

model Insight {                                              // NEW: cached computed analytics
  id              String   @id @default(uuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id])
  type            String
  computedAt      DateTime @default(now())
  payload         Json
  @@index([userId, type])
}

// ─────────────────────────── SERVER-ONLY (never synced to device) ───────────────────────────
model SyncState {
  id                String   @id @default(uuid())
  userId            String   @unique
  user              User     @relation(fields: [userId], references: [id])
  deviceLastSyncAt  BigInt?
  serverLastAppliedAt DateTime @default(now())
}

model GoogleAuth {                                           // Google Calendar OAuth tokens (server-side)
  id           String   @id @default(uuid())
  userId       String   @unique
  user         User     @relation(fields: [userId], references: [id])
  accessToken  String                                        // encrypted at rest
  refreshToken String                                        // encrypted at rest
  expiryDate   BigInt
  calendarId   String?                                       // target calendar
  scope        String
  updatedAt    DateTime @updatedAt
}

model WakatimeCache {                                        // rate-limit / offline cache
  id        String   @id @default(uuid())
  userId    String
  date      BigInt
  payload   Json
  fetchedAt DateTime @default(now())
  @@unique([userId, date])
}
```

Notes:
- `wakatimeUsername/Password` move **off `User`** into env-driven server config or, if per-user needed, an
  **encrypted** field — never the current plaintext (`AUDIT.md §7`). WakaTime *API key* (not password) is the
  correct credential.
- `NODE_TLS_REJECT_UNAUTHORIZED='0'` in `lib/prisma.ts` is removed; use the CA cert / `sslmode=require`.

---

## 3. Sync contract (WatermelonDB engine, expanded)

### 3.1 Endpoints
- `GET  /api/m/sync?lastPulledAt=<millis>` → `{ changes, timestamp }` (pull).
- `POST /api/m/sync` body `{ changes, lastPulledAt }` → `{ success, timestamp }` (push).
- Legacy `/api/sync` kept as a thin alias for one release, then deleted. Client base URL moves from the
  hardcoded LAN IP to `EXPO_PUBLIC_API_URL`; `x-http-key` from secure-store, not source.

### 3.2 Pull (server → device)
For **every** synced model, return rows where `serverUpdatedAt > lastPulledAt`, shaped as WatermelonDB
`{ table: { created, updated, deleted } }`. Bucketing rule: rows whose `createdAt > lastPulledAt` → `created`;
else `updated`; soft-deleted (`deletedAt != null` and changed since) → `deleted` (id only). `timestamp` =
server `now()` used as the next `lastPulledAt`. Empty delta → all-empty arrays (valid, cheap).
**Vault:** only ciphertext/metadata columns are ever serialized (a shared `serializeVaultItem` guarantees no
plaintext field can be added by accident; a unit test asserts the key set).

### 3.3 Push (device → server) — idempotent, atomic
Wrap the whole batch in `prisma.$transaction`:
1. For each table's `created` + `updated`: **`upsert` by `id`** (the WatermelonDB record id). Re-POSTing the
   same batch re-upserts identical data → **no double-write** (satisfies §3's "event-id" requirement using
   the record id as the event id).
2. `event_logs` is append-only: `createMany({ skipDuplicates: true })` keyed on `id` → replayed events are
   dropped, never duplicated.
3. `deleted`: set `deletedAt` (soft delete), never hard-delete synced rows.
4. Only after the transaction commits, return the new `timestamp`. **If anything throws, nothing commits and
   the device keeps its old watermark** → no corruption on partial failure.

### 3.4 Conflict resolution (per-table)
- **Default: LWW on `updatedAt`** (device millis). Server keeps the row with the larger `updatedAt`.
- **FinanceLog: append-only.** Existing rows are immutable ledger entries; on conflict the server **never
  overwrites** amount/type/date — only `isCancelled`/`isTriggered` flag transitions (driven by events) may
  change. New rows insert.
- **EventLog: never updated.** Insert-or-ignore only.
- **VaultItem: metadata LWW**, plaintext excluded entirely.
- **Setting/Profile: LWW**, single row per user.

### 3.5 Edge cases (each gets a test)
| Case | Handling |
|---|---|
| Empty delta | All-empty arrays; watermark still advances to server `now()` |
| Huge delta | WatermelonDB batches natively; server uses `createMany`/chunked upserts |
| Clock skew | **Server arrival time is authority** for pull watermarks; device millis used only for LWW ordering |
| Offline mid-sync | Watermark advances only post-commit (§3.3) → safe retry |
| Duplicate rapid long-press | `SyncService` holds an in-flight `Promise` lock; second press no-ops until the first resolves |
| Vault plaintext | Stripped by `serializeVaultItem`; asserted by test |

---

## 4. API surface

### `/api/m/*` (mobile, `x-http-key`) — keep it thin
| Method | Path | Purpose |
|---|---|---|
| GET/POST | `/api/m/sync` | The batched pull/push (§3) — most data flows here |
| POST | `/api/m/upload/presign` | R2 presigned PUT/GET for `{ kind, key }` (§5) |
| GET | `/api/m/wakatime` | Server-proxied WakaTime (API-first, scrape fallback, cached) |
| POST | `/api/m/vault/unlock` | Verify vault passcode → short-lived scoped token (verification only) |
| POST | `/api/m/google/enqueue` | Optional: queue a Calendar op when created offline (else piggybacks on sync) |

### `/api/w/*` (web, session)
- `POST /api/w/auth/login`, `POST /api/w/auth/logout`, `GET /api/w/auth/session`.
- CRUD: `/api/w/{categories,contacts,tasks,finance,music,settings,profile}`.
- Vault (password-gated): `/api/w/vault/*`, **`POST /api/w/vault/password`** (reset/change — **web only**,
  closes the mobile-reset hole in `AUDIT.md §6.1`).
- Dashboards: `GET /api/w/dashboard`, `GET /api/w/insights`.
- `GET /api/w/google/oauth/start`, `GET /api/w/google/oauth/callback` (§6).

---

## 5. R2 presign flow

```
device → POST /api/m/upload/presign { kind:"vault-media"|"music"|"album-art"|"avatar", ext, size }
server  → validates kind/size, builds key `<userId>/<kind>/<uuid>.<ext>`,
          returns { putUrl (presigned, ~5min), key }
device  → PUT bytes directly to R2 putUrl (for vault: bytes are ALREADY encrypted client-side)
device  → stores `key` in the row (avatarR2Key / r2Key / albumArtR2Key), syncs the key via §3
download→ device/web → POST presign {op:"get", key} → presigned GET URL (short-lived)
```
R2 secret keys (`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`, `R2_BUCKET`) live in server env
only. Device never sees them. Vault blobs are encrypted **before** upload → R2 holds ciphertext.

---

## 6. Google Calendar OAuth flow (Calendar events — user decision)

Server-side OAuth (tokens never on device):
```
web user → GET /api/w/google/oauth/start → redirect to Google consent
           (scope https://www.googleapis.com/auth/calendar.events, access_type=offline, prompt=consent)
Google   → GET /api/w/google/oauth/callback?code=… → exchange for {access,refresh,expiry}
server   → encrypt + store in GoogleAuth; pick/create target calendarId
```
**On task create/update** (custom + fixed only; alerts excluded): during sync processing (or the enqueue
endpoint if created offline), the server calls the **Calendar API**:
- create → `events.insert` (timed event from `startTime`/`endTime`) → store `googleEventId` on the Task
  (and per-`TaskInstance` for fixed), returned to the device on the next pull.
- update → if `googleEventId` exists → `events.patch` (**no more duplicate-on-edit**, `AUDIT.md §4`); else
  insert.
- delete/cancel → `events.delete`.
Token refresh handled server-side via `refreshToken`; on failure (revoked/2FA) → surface a clear error, mark
the op pending, retry next sync. Offline task creation queues the op and reconciles on next sync.

---

## 7. Cron / scheduler (server = time authority)

Vercel Cron / node-cron hitting internal authenticated routes. Each job is **idempotent** and writes
`event_logs` + updates projections; the device **reconciles on next sync** (device timers remain as UX but
are no longer the source of truth). Timezone: use the user's `Setting.timezone`.

| Job | Cadence | Logic |
|---|---|---|
| **Fixed renewal** | daily 05:00 (user tz) | For each active fixed task: close yesterday's `TaskInstance` (completed→completed, else→incomplete/failed), create today's instance; **skip on Holiday day-mode** (no submit/fail on holidays) |
| **7-day allocation** | daily + on task create | Ensure the next 7 days of `TaskInstance` rows exist for each fixed task |
| **Custom 6h-fail sweep** | every 15 min | Custom tasks `now > endTime + 6h` and not completed → `status=failed`, `failedAt` (distinct from cancelled; **does not touch fixed tasks** — fixes the §4 conflict) |
| **16h "Completed Today" hide** | every 15 min | Compute/mark completed tasks past `completedAt + 16h` (device also filters; server authoritative) |
| **Scheduled finance trigger** | every 15 min | `isScheduled && scheduledFor <= now && !isTriggered` → `isTriggered=true`, emit event |
| **Mood notification schedule** | per `moodTrackerIntervalMinutes` | Server-authoritative mood prompt scheduling |
| **Fatigue trigger** | hourly | If `screenTime > threshold` AND `steps < threshold` (from UsageStat/SensorStat, thresholds from `Setting.insights`) → auto-create a mandatory physical-activity fixed task |
| **Insights recompute** | hourly/daily | Recompute the 4 analytics → `Insight` cache |
| **WakaTime fetch** | daily | API-first (API key), scrape fallback, upsert `CodingLog` (unique constraint dedupes) |

---

## 8. Lockdown enforcement architecture (best-effort, MIUI/HyperOS)

Reality matrix is in `AUDIT.md §5.4` (power-button/kiosk = not achievable without Device Owner, which we are
**not** doing). Phase-3 hardening architecture:
- **Real system overlay:** request `SYSTEM_ALERT_WINDOW`, gate on `Settings.canDrawOverlays()`, draw a
  `TYPE_APPLICATION_OVERLAY` window (native) so the lock survives leaving the app — replacing the in-app JS
  `Modal`.
- **Foreground service:** Notifee foreground service + `FOREGROUND_SERVICE`(+`_SPECIAL_USE`) so the lock/
  dead-man survives backgrounding.
- **Boot + autostart:** `BOOT_COMPLETED` receiver (`RECEIVE_BOOT_COMPLETED`) to resume scheduled sessions.
- **Exact alarms:** `AlarmManager` + `SCHEDULE_EXACT_ALARM` to actually *start* scheduled focus (today it
  only posts a reminder) and to back time transitions on-device.
- **MIUI wizard:** detect and deep-link the user to Autostart, battery "No restrictions", lock-in-Recents,
  and "display pop-up while background" — none can be forced; document each. Add `POST_NOTIFICATIONS`.
- **Wire `lockdown_allow_calls`** into the actual lockdown path; add a **panic-exit audit** (`FocusSession.
  panicExit` + event) whenever the user breaks out.
- Every unenforceable item is stated plainly in-app and in docs. Fix the stale "5 min vs 10 min" comment.

---

## 9. Reversible migration plan

### 9.1 Device (WatermelonDB) — additive & reversible
All existing migrations are additive (v4→v13). New work = **migrations v14+**, each `addColumns`/`createTable`
only (never drop):
- v14: `tasks.completed_at`, `tasks.failed_at`, `tasks.status`, `tasks.is_time_only`, `tasks.google_event_id`,
  `tasks.category_id`.
- v15: `categories` table; `task_instances` table.
- v16: `settings.insights` (JSON), plus persist the currently-dropped fields (`day_mode` reconciled into
  `task_mode`, `notification_sound*`, `focus_*`, `fatigue_*` via a fixed `updateSettings`).
- v17: `mood_logs.score10`; music/vault `*_r2_key` hints; `focus_sessions`, `schedules` tables.
**Reversibility:** WatermelonDB migrations are forward-only, so "reversible" = **backup-before-apply**: copy
the SQLite file (`FileSystem`) before running new migrations at startup; a failed migration restores the
copy. No column is dropped, so old app builds keep working (they ignore new columns).

### 9.2 Server (Prisma) — expand-only, staged
1. `prisma migrate` to add all new models/columns (additive; the current 5 models are a strict subset).
2. Backfill: create the single `User` (real `email`/`passwordHash` + `xHttpKey` from env), one `Profile`
   (from device `users`), `SyncState`, `Setting`.
3. Keep `/api/sync` alias live until the mobile client ships pointing at `/api/m/sync`; then remove.

### 9.3 Identity mapping (`local_user` → server identity)
Device keeps id `local_user` for its `users` row → maps to `Profile.id = "local_user"` under the real
`User.id`. All device rows carry their WatermelonDB ids as server PKs; no id rewrite, no data migration on the
device. Existing user data is fully preserved.

---

## 10. WatermelonDB ↔ Prisma mapping (1:1)

| WatermelonDB table (device) | Prisma model | Notes |
|---|---|---|
| `users` | **Profile** (+ **User** for auth) | auth split out; `avatar_url` → `avatarR2Key` |
| `settings` | **Setting** | + `insights` JSON; persist previously-dropped fields |
| `tasks` | **Task** | + `completedAt/failedAt/status/isTimeOnly/googleEventId/categoryId` |
| — (new) | **TaskInstance** | fixed-task daily instances |
| — (new) | **Category** | master category list |
| `contacts` | **Contact** | 1:1 |
| `event_logs` | **EventLog** | id = client event id; append-only |
| `finance_logs` | **FinanceLog** | append-only ledger |
| `mood_logs` | **MoodLog** | + `score10` |
| `music_tracks` | **MusicTrack** | + `r2Key/albumArtR2Key/localPathHint` |
| `music_categories` | **MusicCategory** | 1:1 |
| `vault_media` | **VaultItem** | ciphertext/metadata only |
| `notification_logs` | **NotificationLog** | 1:1 |
| `coding_logs` | **CodingLog** | + unique constraint |
| — (new) | **UsageStat / SensorStat** | analytics sources (needs new device tables/libs) |
| — (server-only) | **Insight / SyncState / GoogleAuth / WakatimeCache** | never synced to device |

---

## 11. Env / secrets (→ `.env.example` in Phase 4)

Server: `DATABASE_URL`, `MOBILE_HTTP_KEY`, `SESSION_SECRET`, `WEB_ADMIN_EMAIL`, `WEB_ADMIN_PASSWORD_HASH`,
`R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `GOOGLE_CLIENT_ID`,
`GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `WAKATIME_API_KEY` (+ optional `WAKATIME_USERNAME/PASSWORD`
for the scrape fallback), `TOKEN_ENC_KEY` (encrypts Google tokens at rest), `CRON_SECRET`.
Device (`EXPO_PUBLIC_*` / secure-store): `EXPO_PUBLIC_API_URL`; `x-http-key` in `expo-secure-store`, not source.

---

## 12. Phase 3 slice order (unchanged from plan, now grounded in this schema)
`3.1` Backend skeleton (namespaces, real auth, R2 presign) · `3.2` sync engine to full coverage + idempotency
+ vault sanitizer · `3.3` task correctness + cron time-authority + Google Calendar · `3.4` lockdown hardening
+ scheduling + panic audit · `3.5` vault fixes (decrypt bug, at-rest encryption, web-only reset, unify UIs,
R2, rich-text) · `3.6` finance/music/profile/settings sync + §7 UI fixes + remove Import · `3.7` analytics
(sensors + usage-stats + the 4 metrics + Insights settings + WakaTime fixes) · `3.8` web dashboard to parity.
Each slice: `typecheck` + tests + build, checkpoint, report.

*End of Phase 2. Next gate: Phase 3 implementation — awaiting explicit "go."*
