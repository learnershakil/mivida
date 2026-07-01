# mi vida — Phase 1 Deep Audit

> **Status:** Phase 1 complete. Read-only audit of the codebase as it exists on `main`
> (`f840889 feat: finalize with WakaTime sync, global alerts, and analytics`). Every claim below is
> backed by a `file:line` reference. Where the brief and the code disagree, **the code wins** and the
> divergence is recorded here.
>
> **Headline:** the app is far more built-out than the brief assumes. The web app already exists (Prisma
> schema, sync route, WakaTime route, real dashboard); the mobile long-press sync already works; most
> modules are already implemented. The real work is **correctness, security, full server-side coverage,
> and a time-authoritative backend** — not greenfield construction.

---

## 0. Confirmed product decisions (2026-07-01)

| Fork | Decision |
|---|---|
| Sync engine | **Keep WatermelonDB `synchronize()`**; re-point to `/api/m/sync`, expand server to all tables, add event-id idempotency. No hand-rolled replacement. |
| Google integration | First-class **Google Calendar events** (not the Tasks API). |
| Lockdown | Strongest **best-effort** enforcement + honest docs. **No** Device-Owner/kiosk (no factory reset). |
| Target device | Xiaomi **MIUI / HyperOS**. |

---

## 1. Repo map & stack

```
mivida/
├── mobile-app/          Expo SDK 54 (bare) · React Native 0.81.5 · React 19.1 · expo-router 6
│   ├── app/             expo-router routes: index.tsx (→ redirect), _layout.tsx, (tabs)/
│   ├── components/      ~30 modal/screen components
│   ├── database/        WatermelonDB schema (v13), migrations, 12 models
│   ├── services/        ~25 service singletons (task, lockdown, vault, finance, sync, …)
│   ├── store/           Zustand — ONE store (toastStore)
│   ├── plugins/         Expo config plugins (withNotifee, withWatermelonDB)
│   └── android/         bare native project incl. custom DeviceAdminModule (Kotlin)
└── web-dashboard/       Next.js 16.2.9 (App Router) · React 19.2 · Prisma 7.8 + pg
    ├── prisma/          schema.prisma (5 models — severe drift vs device's 12)
    └── src/
        ├── app/         layout.tsx, page.tsx (real dashboard), api/sync, api/wakatime/sync
        └── lib/         prisma.ts
```

### Stack, tooling & commands (verified)

| | Mobile (`mobile-app/`) | Web (`web-dashboard/`) |
|---|---|---|
| Framework | Expo SDK 54 bare, RN 0.81.5, React 19.1, expo-router 6 | Next.js 16.2.9 App Router, React 19.2 |
| Data | WatermelonDB 0.28 (SQLite, `database/index.ts:26` `jsi:false`, **no SQLCipher**) | Prisma 7.8 + `@prisma/adapter-pg`, Postgres (Aiven) |
| State | Zustand 5 (**only** `store/toastStore.ts`). **No TanStack Query.** Reactivity via WatermelonDB `withObservables` | none (server components + Prisma direct) |
| Styling | NativeWind v4 + Tailwind 3 (`tailwind.config.js` palette); some inline `StyleSheet` | Tailwind v4; `globals.css` still create-next-app default |
| Native | Notifee, `react-native-background-timer`, custom `DeviceAdminModule.kt`, `socket.io-client` (dead) | cheerio (scraping) |
| Package manager | **bun** (`bun.lock`; stray `package-lock.json` present) | **bun** (`bun.lock`; stray `package-lock.json` present) |
| Install | `bun install` | `bun install` |
| Run | `expo run:android` · `expo start` · `expo prebuild` | `next dev` · `next build` · `next start` |
| Lint | `bun run lint` (`eslint … && prettier -c …`) | `bun run lint` (`eslint`) |
| Typecheck | none present → **added** `typecheck` = `tsc --noEmit` | none present → **added** `typecheck` = `tsc --noEmit` |
| Tests | **none** (no runner installed) | **none** |

TypeScript is present in both apps (both `tsconfig.json` have `strict: true`) but there is **no CI, no test
suite, and (pre-audit) no typecheck script**. Closing this is the first Phase-3 quality task.

### Build/typecheck baseline (run 2026-07-01, after adding `typecheck` scripts)

**Neither app currently typechecks clean.**

- **Mobile: ~28 errors.** One is **build-breaking**: `app/_layout.tsx:13` imports
  `../services/appStateService` (`handleAppStateChange`) — **that file does not exist**, so Metro would fail
  to resolve it and the mobile app in its current working-tree state (`_layout.tsx` is uncommitted `M`)
  likely **won't bundle/run**. Must be fixed before any Phase-3 work. Other errors confirm audit findings:
  `VaultContentScreen` calls nonexistent `vaultService.getVaultMedia`/`removeMedia` and a nonexistent
  `VaultMedia.note` field (§6.1 crash confirmed at type level); `TaskCard.tsx:949` references undefined
  `handleCancelTask`; `taskService.ts:683` emits a `'TASK_UPDATED'` not in the `EventType` union;
  `moodService`/`exportService` emit `entityType`s outside the allowed union; `Toast.tsx:42` reads private
  Reanimated `_value`; date/number mismatches in `TaskCard`/`moodService`.
- **Web: 1 error.** `page.tsx:38` reads `user.isAwake`, but the Prisma `User` model has no `isAwake` field
  — a concrete instance of the schema drift in §3.2.

These are recorded as-is; fixes belong to Phase 3 (the missing-module import is the one true blocker).

---

## 2. Navigation, shell & state (mobile)

- **Root** (`app/_layout.tsx`): `Stack` inside `DatabaseProvider` + `CustomAlertProvider`, with global
  overlays mounted above it — `<LockdownOverlay/>`, `<DeadManPrompt/>`, `<GlobalToast/>`
  (`_layout.tsx:158-184`). It globally overrides `Alert.alert` to route through `uiAlertService`
  (`_layout.tsx:18-21`). Registers a `settings` modal stack screen (`_layout.tsx:181`) that has **no file**
  — Settings is actually a `<SettingsModal>` component; the stack screen is orphaned/dead.
- **Entry** (`app/index.tsx`): `<Redirect href="/(tabs)" />`.
- **Bottom tab bar** (`app/(tabs)/_layout.tsx:49-68`): floating pill navbar (`position:'absolute'`,
  `bottom:25`, `#1E1E1E`, `borderRadius:30`, labels hidden). Five tabs: **Home** (`index`, blue `#4AC3FF`),
  **Finance** (green `#C0F67F`), **Dashboard** (center, yellow `#FFD465`, custom `SyncTabButton`), **Music**
  (orange `#FF8E6E`), **Profile** (purple `#D8C8FE`).
- **Two "home-like" screens:** `app/(tabs)/index.tsx` (~1220 lines, the Task/Home screen incl. a full
  calendar view) and `app/(tabs)/dashboard.tsx` (~790 lines, the analytics screen with a client-computed
  productivity score).
- **State:** exactly **one Zustand store** (`store/toastStore.ts`). **TanStack Query absent** (no
  `@tanstack`/`useQuery` anywhere). Cross-component state uses WatermelonDB observables + a custom
  `appEvents` emitter + `DeviceEventEmitter`.
- **Color inconsistency:** stack default content bg is black (`_layout.tsx:171`), but Home and Dashboard set
  their own **light** backgrounds (`#F8F9FC` / `#FDFCF8`). Design tokens in `tailwind.config.js`; recurring
  accent green `#C0F67F`, info blue `#4AC3FF`, error reds `#FF2D55/#FF3B30`, dark surfaces
  `#1E1E1E/#1C1C1E`, heavily rounded cards (`rounded-2xl/3xl`), lucide icons + emoji section headers.

---

## 3. Sync & online status

### 3.1 What exists
- **Long-press-to-sync already implemented** and matches the spec's 1.5s: `SyncTabButton`
  (`app/(tabs)/_layout.tsx:10-44`) — `delayLongPress={1500}`, press-in scale micro-animation, toast
  feedback, calls `SyncService.sync()`.
- **Engine = stock WatermelonDB `synchronize()`** (`services/syncService.ts:21-52`) with `pullChanges`
  (GET `?lastPulledAt=`) and `pushChanges` (POST). WatermelonDB owns `_status`/`_changed` and the
  last-pulled watermark — so the brief's "never hand-edit these" is already satisfied by construction, and
  it is idempotent for the tables it covers.
- Client fires a **WakaTime sync first** (`services/syncService.ts:11-18`) before the main sync.

### 3.2 Critical gaps
- **Hardcoded target:** `SYNC_API_URL = 'http://10.67.217.166:3000/api/sync'`, `HTTP_KEY =
  'hardcoded-dev-key'` (`services/syncService.ts:4-5`). LAN-only, single `/api/sync` namespace — **no
  `/api/m/*` ÷ `/api/w/*` split**.
- **Insecure auth:** the web routes only check *presence* of `x-http-key`, then
  `prisma.user.upsert({ where:{ xHttpKey } … })` (`api/sync/route.ts:9-27`, `151-163`;
  `api/wakatime/sync/route.ts:8-25`). **Any key silently provisions and authenticates as a user.** No web
  login exists; `page.tsx` renders every user unconditionally.
- **Partial coverage:** push handles `tasks` (c/u/d, `api/sync/route.ts:41-85`), `contacts` (**create
  only** — update/delete are a literal `// ... Similar logic` stub, `:101`), `settings` (update-upsert,
  `:105-128`). **Pull returns only `coding_logs`** (`:169-192`); every other table returns empty arrays.
- **Not synced at all:** `finance_logs`, `mood_logs`, `music_tracks`, `music_categories`, `vault_media`,
  `event_logs`, `notification_logs`, `users`/profile. (Vault must *stay* excluded from plaintext sync.)
- **Schema drift:** device `SCHEMA_VERSION = 13` / 12 tables (`database/schema.ts:3`) vs 5 Prisma models.
- **No server time-authority:** all time transitions are device-local (see §4). The brief's "backend cron
  is source of truth" is unbuilt.

---

## 4. Tasks & time-based lifecycle

Modeled on one `tasks` table with a `type` discriminator `'fixed'|'custom'|'alert'`
(`database/models/Task.ts:35`). Unified creation in `services/taskService.ts:50-156`.

| Spec item | Status | Evidence |
|---|---|---|
| custom = full date+time | OK | `CustomDateTimePicker mode="datetime"` (`CreateTaskModal.tsx:489`) |
| fixed = time-only picker | **Missing** | Fixed uses the *same* `datetime` picker as custom (`CreateTaskModal.tsx:423-500`) |
| fixed = 7-day allocation | **Missing** | No allocation-generation code anywhere |
| fixed = 5 AM renewal | Present, launch-gated | `taskMaintenance.ts:64-77`; only fires from `app/_layout.tsx:101` on launch. Only resets already-completed instances. |
| custom = 6 h auto-fail | Present, but is a *cancel* | `taskMaintenance.ts:40-61`; sets `isCancelled` (no distinct `failed`); **also cancels fixed** tasks with an end time (conflicts with `deleteTask`'s "fixed can't be deleted" rule at `taskService.ts:378`); launch-gated |
| 16 h "Completed Today" hide | Present, fragile | `index.tsx:70-96`; keys off a **nonexistent** `completedAt` field → silently falls back to `updatedAt` (`index.tsx:71`) |
| completion remark | Partial | Captured for **custom only** (`TaskCard.tsx:293-315`); stored in the **event log**, never in the `completion_remark` column (which is only *cleared* at renewal, `taskMaintenance.ts:73`) |
| pause remark (mandatory) | Present (UI-only) | `TaskCard.tsx:232-236` rejects empty remark; stored only in the `TASK_PAUSED` event (`taskService.ts:229`); the service param is optional |
| categories master + live filter | **Missing** | Free-text `TextInput` only (`CreateTaskModal.tsx:286-297`); no category table/picker |
| assign-to contacts (live filter) | **Missing** | Free-text comma-separated names → `assigned_persons` JSON (`taskService.ts:76`); `contact_id` column declared but **never set/read**; `ContactService.getAll` ignores its `userId` arg (`contactService.ts:8`) |
| Google Tasks/Calendar push | **Mismatched** | Uses `expo-calendar` **local events** (`calendarService.ts:27-32`), custom-only, **no stored event id → duplicates on edit** (`taskService.ts:690`) |

**State machine** (all in `taskService.ts`, each emitting an event): create → start (auto-pauses others,
requires "awake") → pause (accumulates `total_elapsed_seconds`) → resume → updateProgress (100% ⇒
`isCompleted`) → complete / cancel / skip (no persistent skipped flag) / delete (soft; **throws for
fixed**) / delegate. Alerts: `triggerAlertTask` / `deactivateAlertTask`. There is **no distinct `failed`
state** — auto-fail reuses `isCancelled`. Duration is always computed from events, never stored.

**Root cause of every time bug:** automated transitions run **only on app launch** (`app/_layout.tsx:101`);
no background task / cron. A closed phone misses 5 AM renewals and 6 h fails until next open.

---

## 5. Focus, Break & Lockdown (+ notifications, dead-man)

### 5.1 Flow
- **Break→forced Focus exists** but is **10 minutes**, not the 5 the stale comment claims
  (`BreakLockModal.tsx:36` `POST_BREAK_LOCK_MINUTES = 10`; docstring at `:7` wrongly says 5). On break-end,
  shows an ongoing notification, waits 5s, then `lockdownService.startLockdown(10, userId)`
  (`BreakLockModal.tsx:48-86`). **Only fires while the modal is mounted / JS alive** — if the app is killed,
  the scheduled *notification* fires but the lock does **not** start.
- **Focus overlay** (`LockdownOverlay.tsx`): full-screen black `Modal`, countdown, break-attempts banner,
  a single **"Open Dialer"** button (`Linking.openURL('tel:')`, `lockdown.ts:257-263`). **No 5-min-break
  button** is rendered; `forceStopLockdown` exists (`lockdown.ts:95`) but is wired to no button.

### 5.2 Tiers
- `normal | strict | extreme` defined in Settings UI (`SettingsModal.tsx:49-53`) and persisted
  (`Settings.ts:35-36`). Only **extreme** has distinct OS behavior (calls `LockTaskService.enableExtremeFocus()`,
  `lockdown.ts:62-67`); **strict** only blocks task skip/cancel in-app (`isStrictLockdownActive()`,
  `lockdown.ts:236-238`, `TaskCard.tsx:370`). **`lockdown_allow_calls` is a dead setting** — persisted,
  never read in any enforcement path.

### 5.3 Native module — `DeviceAdminModule.kt`
Just `startLockTask()` / `stopLockTask()` (screen pinning). It calls `setLockTaskPackages` **only if
`isDeviceOwnerApp`** (`DeviceAdminModule.kt:17-35`) — false for a normally-installed app — so in practice
it's **user-dismissable screen pinning**. `AdminReceiver.kt` is an empty `DeviceAdminReceiver`; the
declared device-admin policies (`res/xml/device_admin_receiver.xml`) are never invoked. No provisioning code
exists. Manifest declares `SYSTEM_ALERT_WINDOW` (unused) but **not** `FOREGROUND_SERVICE`,
`RECEIVE_BOOT_COMPLETED`, `SCHEDULE_EXACT_ALARM`, or `POST_NOTIFICATIONS`.

### 5.4 Honest enforcement matrix — MIUI/HyperOS, non-rooted, normal install

| Capability | Enforceable? | Reality |
|---|---|---|
| Focus/countdown UI while foreground | ✅ | JS `Modal` only |
| Block hardware **Back** | ⚠️ best-effort | `BackHandler` returns true (`LockdownOverlay.tsx:27-36`); Home/Recents still exit |
| Prevent leaving app / block other apps | ❌ | Only *detects* departure via `AppState`, adds time penalty (`lockdown.ts:118-147`) |
| **Block power button / power-off** | ❌ impossible | Not achievable on stock non-rooted Android — document as unenforceable |
| Screen pinning (extreme) | ⚠️ partial | `startLockTask()` = dismissable "Screen pinned"; user-exitable |
| True kiosk (non-dismissable) | ❌ not built | Needs Device Owner (factory reset) — declined |
| System overlay over other apps | ❌ not built | Permission declared, feature never implemented |
| Background / killed-app enforcement | ❌ | No foreground service / boot receiver; MIUI kills bg JS timers |
| Scheduled focus auto-start | ❌ | "Schedule" only creates an alert-task notification (`FocusLockModal.tsx:53-61`) |
| Allow-incoming-calls toggle | ❌ | Dead setting |
| Dead-man switch in background | ❌ | `deadMan.ts` is a foreground JS `setInterval` |

**MIUI/HyperOS caveats:** manual Autostart, battery "No restrictions", lock-in-Recents, and "display pop-up
while background" are all required for any background survival and **cannot be forced programmatically** —
best we can do is detect + deep-link the user. `POST_NOTIFICATIONS` / `SCHEDULE_EXACT_ALARM` not declared.

### 5.5 Notifications & dead-man
- **Notifee** (`services/notifications.ts`), types `informational|warning|mandatory|system`, full lifecycle
  logging to `notification_logs`. **Sound gap:** presets reference `res/raw/*.mp3` that appear **absent**
  (`soundService.ts:16-18`); `notification_sound_enabled` is stored but never checked; several call sites
  hardcode `sound:'default'`.
- **Real dead-man = `services/deadMan.ts`** (default 3h, JS `setInterval` every 60s, foreground-only;
  triggers `DeadManPrompt` + notification). **`services/background.ts` + `services/socket.ts` are dead
  code** (never initialized; `socket.ts:5` points at another hardcoded IP `192.168.1.10:3000`; no socket
  server exists) → no background inactivity detection.

---

## 6. Vault, Profile & Contacts

### 6.1 Vault
- **Open:** long-press the **Home** avatar (`index.tsx:657-664`, `delayLongPress={500}`). The Profile
  avatar has `delayLongPress` set but **no `onLongPress` handler** (`profile.tsx:109-112`) — vault is
  effectively **Home-only**.
- **Passcode:** salted **SHA-256** (`vaultEncryptionService.ts:58-89`) — salt in SecureStore, hash in the
  `settings.vault_passcode_hash` column. Plain SHA-256 (no PBKDF2/iterations) → weak for a 4-digit PIN.
- **Web-only reset — VIOLATED:** the vault is fully **resettable from mobile** via a destructive "Reset
  Vault" button on the wrong-passcode alert (`VaultAccess.tsx:106-150` → `vaultService.resetVault` wipes
  passcode + all content, `vaultService.ts:484-512`). No web-only restriction. **No lockout / rate-limit /
  attempt counter** — unlimited attempts.
- **Encryption is partial:** note `content`/`title` are AES-encrypted (crypto-js) before DB insert
  (`vaultService.ts:213-214`); **media/audio files are stored plaintext** in the app sandbox
  (`vaultService.ts:279-282, 333-336`). The **SQLite DB is not encrypted at rest** (`database/index.ts:26`),
  so a DB browser sees filenames, URIs, durations, the passcode hash, and audio titles in plaintext (notes
  show as opaque ciphertext).
- **Two bugs:** (a) `VaultContentModal` (the working Home vault) shows/edits note `content` **without
  decrypting** → notes render as ciphertext (`VaultContentModal.tsx:132, 546`). (b) `VaultContentScreen`
  (Profile) calls **nonexistent** `vaultService.getVaultMedia`/`removeMedia` (`:76, :139`) → runtime crash;
  its gallery/camera buttons are "Development Build Required" stubs. The rich-text editor
  (`react-native-pell-rich-editor`) lives only in this broken screen.
- **DatabaseBrowser exposes vault:** `vault_media` is a browsable table dumping every raw column via
  `Object.entries(raw)` (`DatabaseBrowser.tsx:21, 87, 526-533`) with view/edit/delete — **must be excluded**.
- **No R2/cloud** anywhere (see §9).

### 6.2 Profile, Finance, Music, Mood
- **Profile:** name + avatar only; avatar is **copied to the local sandbox**, no upload
  (`EditProfileModal.tsx:76-88, 122-134`). Fallback = hardcoded GitHub avatar URL.
- **Finance:** income/expense ledger; **balance computed, never stored** (`financeService.ts:203-216`). Uses
  `@react-native-community/datetimepicker` (not the custom picker); "Tap to select date" trigger at
  `AddFinanceModal.tsx:239`. **Bug:** the Now/Scheduled toggle always calls `addIncome`/`addExpense` — never
  `scheduleTransaction` — so "scheduled" future transactions post immediately and hit the computed balance
  (`AddFinanceModal.tsx:77-97`); the scheduled-txn machinery is unused.
- **Music:** local-only file storage (`music/`, `album_art/`); 5 seeded system categories + user categories;
  "add track" emits a `MUSIC_PLAYBACK action:'added'` event (`musicService.ts:144-154`), no cloud.
- **Mood:** UI is a **1–10** scale but the model is **5-level** — lossy mapping, raw score stashed in the
  note string `"[Score: 8/10]"` (`MoodLogModal.tsx:41-47, 81`). Interval reminder uses a foreground-only JS
  `setInterval` (`moodService.ts:24, 51-84`) → won't fire in background. `DailyReflectionModal` writes only
  to the event log, not `mood_logs`.
- **Export/Import:** exports **event logs** as JSONL (`exportService.ts:75-164`). **Import IS present**
  (brief wants it removed): full pipeline (`exportService.ts:434-553`) wired into
  `SettingsModal.tsx:592-606`.

### 6.3 Settings surface (what exists today)
Present: dead-man, notifications (intensity/sound/vibration), **lockdown tier**, **allow-calls** (dead),
**day mode** (bound to `task_mode`; a separate unused `day_mode` column exists), **mood interval**, export +
**import**. **Missing:** vault-password-change in Settings, and the **"Insights" analytics
toggles/thresholds group** (only orphaned `fatigue_*` columns exist). `userService.updateSettings`
(`userService.ts:170-242`) doesn't persist `notificationSound*`, `day_mode`, `focus_*`, or `fatigue_*` even
though the columns exist.

---

## 7. Analytics, WakaTime & web dashboard

- **Analytics (`analyticsService.ts`)** computes awake/sleep, focus, task-ratio, distraction, finance
  snapshot, avg mood — **all independently**. **The four spec analytics (Productivity×Mood, Burn Rate,
  Fatigue×Screen-Time, Task Velocity) are unimplemented.** `react-native-usage-stats` and
  `expo-sensors`/pedometer are **not installed** — the fatigue metric has **no data source**.
- **WakaTime route** (`api/wakatime/sync/route.ts`) does API-first + cheerio-scrape fallback, but: (a)
  base64-encodes the stored **password** as the Basic credential — WakaTime expects the **API key**
  (`:34-52`); (b) **always inserts** a new daily `CodingLog` → duplicates (`:103-111`); (c) stores
  `wakatimePassword` **unencrypted** despite the schema comment claiming otherwise.
- **Web dashboard** (`page.tsx`) is a **real** dashboard (per-user cards, task counts, recent coding
  activity) — **no auth/login/session** at all. Only two API routes exist (`api/sync`, `api/wakatime/sync`);
  **no `/api/m/*` or `/api/w/*`**. `layout.tsx` still ships default `"Create Next App"` metadata; `globals.css`
  is the create-next-app default (light theme); dark styling is hand-rolled per-element in `page.tsx`.
- `lib/prisma.ts` sets `NODE_TLS_REJECT_UNAUTHORIZED='0'` — TLS-verification bypass (security concern).

---

## 8. Migrations & data safety

`database/migrations.ts`: 9 steps, v4→v13, **all purely additive** (`addColumns`/`createTable`) — **no
drops/renames/data-mutations**, so existing device data is safe. Minor risk: v6 adds
`settings.notification_sound` as a **non-optional** string with no default. New device columns needed for
Phase 3 (`completed_at`, `google_event_id`, category table, task_instances, insights settings) are additive
→ new migrations v14+, reversible, with a local DB backup step before applying.

---

## 9. Cloud object storage

**None.** No Cloudflare R2 / S3 / presigned-URL code, and no `@aws-sdk`/S3 packages, anywhere in
`mobile-app/`. All media (vault, music, album art, avatar) is device-sandbox-local; the only network egress
is `syncService.ts` (record sync to the LAN dev server + WakaTime trigger). R2 is 100% greenfield.

---

## 10. Corrections to the brief (index)

1. Web is **not** greenfield — evolve, not create.
2. Long-press-to-sync **already exists** (1.5s, matches spec).
3. Sync = **stock WatermelonDB**, LAN-hardcoded, single namespace.
4. Auth **effectively absent/insecure** (any `x-http-key` provisions a user); no web login.
5. Server persists **5 of 12** tables; contacts update/delete stubbed; most tables unsynced.
6. **TanStack Query not installed** (in the brief's target arch) — adopt or drop from spec.
7. **No R2/cloud storage** exists.
8. Task semantics diverge: fixed≠time-only, no 7-day alloc, launch-gated 5am/6h, `isCancelled`≠`failed`,
   16h hide keyed on nonexistent field, `completion_remark`/`contact_id` unwired.
9. Google = **local `expo-calendar` events**, custom-only, dup-on-edit. (Decision: move to Google Calendar
   API events.)
10. Categories = free text (no master/picker).
11. Contacts model exists but unlinked; `getAll` ignores `userId`.
12. The four analytics unimplemented; no sensors/usage-stats.
13. WakaTime route misuses password-as-API-key, duplicates rows, stores creds unencrypted.
14. `socket.ts`/`background.ts` are dead code; real dead-man is foreground-only.
15. **Import data present** (spec wants it removed).
16. No Insights settings group; vault reset possible **from mobile** (spec: web-only).

---

## 11. Prioritized tech-debt / security backlog

**Security (do early):** real `x-http-key` verification + web login; encrypt WakaTime creds; remove
`NODE_TLS_REJECT_UNAUTHORIZED='0'`; encrypt vault at rest (media + DB); exclude vault from `DatabaseBrowser`
+ from sync/analytics/export plaintext; move all hardcoded IPs/keys to env/secure-store.
**Correctness:** vault note decrypt round-trip; finance scheduled-txn bug; task `completedAt`; distinct
`failed` state; fixed-task 6h-cancel conflict; WakaTime upsert; calendar dedupe/event-id; mood 1–10↔5-level;
`updateSettings` missing fields.
**Architecture:** backend cron time-authority; `/api/m/*` + `/api/w/*` split; full server table coverage;
R2 presign; foreground service + boot receiver + exact alarms for lockdown/dead-man.
**Cleanup:** delete `socket.ts`/`background.ts` (or wire intentionally); remove orphaned `settings` stack
screen; remove Import; unify the two vault UIs; reconcile `task_mode` vs `day_mode`.

---

*End of Phase 1 audit. Next gate: Phase 2 (`ARCHITECTURE.md`) — awaiting explicit "go."*
