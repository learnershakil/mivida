### Awake / Sleep Mode

- Analytics derived:
    - Sleep duration
    - Awake duration
    - Sleep consistency

### Task Modes

- **Weekday Mode**
    - Auto-loads fixed tasks
- **Holiday Mode**
    - No auto tasks
    - Fully manual

---

### Task Execution

- Start / Stop timer
- Partial completion (0–100%)
- Full completion checkbox
- Resume previous task
- Overlapping task detection (warning)

---

### Task Logs (EVENTS)

- `TASK_CREATED`
- `TASK_STARTED`
- `TASK_PAUSED`
- `TASK_RESUMED`
- `TASK_PROGRESS_UPDATED`
- `TASK_COMPLETED`
- `TASK_SKIPPED`

No task duration is stored — calculated later.

---

## 3️⃣ DEAD MAN’S SWITCH (ANTI-DISTRACTION CORE)

### Inactivity Detection

- Trigger condition:
    - `State = Awake`
    - No interaction > configurable threshold (default 3h)

---

### Trigger Action

- High-priority notification
- Full-screen if needed
- Custom text / image (Phase-1 local config)

---

### Mandatory Response

- Cannot dismiss without input
- Input types:
    - Free text
    - Predefined options (optional)
- Logs:
    - `INACTIVITY_DETECTED`
    - `NUDGE_SENT`
    - `NUDGE_RESPONDED`
    - `NUDGE_IGNORED` (timeout)

---

## 4️⃣ NOTIFICATION SYSTEM (INTERACTIVE & LOGGED)

### Notification Types

- Informational
- Warning
- Mandatory-input
- System-enforced (Focus Lock)

---

### Notification Capabilities

- Text
- Image / GIF (local)
- Input field
- Multiple-choice
- Sound / vibration config

---

### Notification Logs

- `NOTIFICATION_SCHEDULED`
- `NOTIFICATION_TRIGGERED`
- `NOTIFICATION_VIEWED`
- `NOTIFICATION_RESPONDED`
- `NOTIFICATION_DISMISSED`

---

## 5️⃣ HARD FOCUS LOCKDOWN (DISCIPLINE MODE)

### Lockdown Setup

- Duration-based (15m, 30m, 1h, custom)
- Triggered locally
- Can be chained

---

### Lockdown Behavior

- Full-screen overlay
- Countdown timer
- Disable:
    - Back
    - Home
    - Recent apps
- Allow:
    - Incoming calls
- Break attempt detection

---

### Lockdown Logs

- `FOCUS_LOCK_STARTED`
- `FOCUS_LOCK_ENDED`
- `FOCUS_BREAK_ATTEMPTED`
- `FOCUS_FORCE_EXIT`

---

## 6️⃣ FINANCE MANAGER (EVENT-BASED)

### Transactions

- Revenue
- Expense
- Scheduled future transactions

---

### Transaction Inputs

- Amount
- Source / Destination
- Category (free text)
- Date & time

---

### Finance Logs

- `FINANCE_CREDIT_ADDED`
- `FINANCE_DEBIT_ADDED`
- `FINANCE_SCHEDULED`
- `FINANCE_TRIGGERED`
- `FINANCE_CANCELLED`

Balance is **computed**, never stored.

---

## 7️⃣ SECURE VAULT & MOTIVATION SYSTEM

### Music Player

- Local audio files
- Play / pause / skip
- Playback logged

---

### Hidden Vault (Stealth)

- Access:
    - Long-press gesture
    - Passcode
- Content:
    - Notes
    - Images
    - Videos
- Storage:
    - Encrypted
    - App sandbox only
    - Invisible to gallery

---

### Vault Logs

- `VAULT_ACCESS_ATTEMPT`
- `VAULT_ACCESS_GRANTED`
- `VAULT_ACCESS_DENIED`
- `VAULT_ITEM_ADDED`
- `VAULT_ITEM_VIEWED`
- `VAULT_ITEM_DELETED`

---

## 8️⃣ MOOD, REFLECTION & PSYCHOLOGY

### Nightly Review

- Mood score (1–10)
- Optional note

---

### Logs

- `MOOD_REPORTED`
- `DAILY_REFLECTION_ADDED`

Used later for correlations.

---

## 9️⃣ DELEGATION CENTER

### Delegated Tasks

- Assign task to external person
- Track:
    - Assigned
    - Partial
    - Completed
- Manual status update

---

### Logs

- `DELEGATED_TASK_CREATED`
- `DELEGATED_TASK_UPDATED`
- `DELEGATED_TASK_COMPLETED`

---

## 🔟 PROFILE & SETTINGS

### Profile

- Name
- Photo
- Personal details

---

### Settings

- Dead Man’s threshold
- Notification intensity
- Lockdown strictness
- Export preferences
- Timezone

---

## 1️⃣1️⃣ ANALYTICS (LOCAL, DERIVED)

### Visible Metrics

- Daily productivity %
- Awake vs Sleep ratio
- Focus lock time
- Finance daily snapshot

---

### Rules

- No stored aggregates
- Calculated from event logs every time

---

## 1️⃣2️⃣ EXPORT & SYNC HUB (PART-A VERSION)

### Export

- Format: `.jsonl`
- Includes:
    - All events
    - Schema version
    - Device info
    - Timezone

# Mobile Phase - User Stories

---

# **USER STORIES**

---

## 👤 **PRIMARY USER (INDIVIDUAL / END USER)**

*(Student / Founder / Professional using the app for self-discipline)*

---

## ✅ **Onboarding & Core Identity**

- As a **user**, I can **start using the app without internet or account creation**, so that my data stays local and private.
- As a **user**, I can **set my name and profile photo locally**, so the app feels personal.
- As a **user**, I can **update or reset my profile details anytime**, without losing my logs.
- As a **user**, I can **use the app fully without authentication**, because Phase-1 is offline-first.

---

## ✅ **Awake / Sleep State Management**

- As a **user**, I can **switch between Awake and Sleep modes**, so the app understands my real-life state.
- As a **user**, I want **task tracking and nudges to pause automatically during Sleep**, so I’m not punished for resting.
- As a **user**, I want **exact timestamps logged when I sleep and wake**, so I can later analyze sleep hygiene.
- As a **user**, I can **see my Sleep vs Awake ratio for the day**, so I understand my energy patterns.

---

## ✅ **Task & Activity Management**

### Task Creation & Modes

- As a **user**, I can **define fixed tasks (e.g., classes, routine)** for weekdays.
- As a **user**, I can **switch between Weekday and Holiday mode**, so tasks adapt to my schedule.
- As a **user**, I can **create custom tasks anytime**, without affecting fixed routines.

---

### Task Execution

- As a **user**, I can **start, pause, resume, and stop a task timer**, so my work is accurately logged.
- As a **user**, I can **mark a task as fully completed**, when I finish it.
- As a **user**, I can **log partial completion (0–100%)**, when a task is only partially done.
- As a **user**, I get **warnings if tasks overlap**, so my time data stays clean.
- As a **user**, I can **resume my last active task quickly**, without re-selecting it.

---

## ✅ **Dead Man’s Switch (Inactivity Accountability)**

- As a **user**, I want the app to **detect long inactivity while I am Awake**, so I don’t drift unconsciously.
- As a **user**, I receive a **high-priority “Are you distracted?” prompt** after inactivity.
- As a **user**, I **cannot dismiss the prompt without writing a reason**, so I’m forced to self-reflect.
- As a **user**, I want **every inactivity event and response to be logged**, so I can review distraction patterns later.
- As a **user**, I can **configure inactivity thresholds locally**, to control strictness.

---

## ✅ **Notification System (Interactive & Offline)**

- As a **user**, I can **receive notifications with input fields**, not just reminders.
- As a **user**, I can **respond to notifications while offline**, and trust that responses are stored locally.
- As a **user**, I want **all notifications to be logged** (sent, viewed, responded, dismissed).
- As a **user**, I can **see my notification history**, so I understand how often I’m being nudged.
- As a **user**, I can **control notification intensity and sound**, based on my tolerance.

---

## ✅ **Hard Focus Lockdown (Discipline Mode)**

- As a **user**, I can **start a Focus Lock for a fixed duration**, so distractions are physically blocked.
- As a **user**, I see **only a countdown timer during focus**, nothing else.
- As a **user**, I cannot exit the app or switch apps during focus**, so discipline is enforced.
- As a **user**, I can **receive phone calls during focus**, for emergencies.
- As a **user**, I want **all focus sessions and break attempts logged**, so I can measure discipline.

---

## ✅ **Finance Management (Offline Ledger)**

- As a **user**, I can **log income transactions**, with amount and source.
- As a **user**, I can **log expenses**, with destination and category.
- As a **user**, I can **schedule future transactions**, so I don’t forget payments.
- As a **user**, I receive **alerts when scheduled finance events trigger**.
- As a **user**, I can **see my daily financial snapshot**, derived from logs.
- As a **user**, I trust that **no balance is stored permanently**, only computed.

---

## ✅ **Secure Vault & Motivation**

### Music

- As a **user**, I can **play motivational audio locally**, without internet.
- As a **user**, I want **playback actions logged**, so I know when I rely on motivation.

---

### Hidden Vault

- As a **user**, I can **access a hidden vault via gesture + passcode**, so it stays private.
- As a **user**, I can **store notes, images, and videos securely**, invisible to the phone gallery.
- As a **user**, I want **vault access attempts logged**, for security awareness.
- As a **user**, I can **add or remove vault items**, without exposing them externally.

---

## ✅ **Mood & Reflection**

- As a **user**, I can **record a nightly mood score (1–10)**, to reflect on my day.
- As a **user**, I can **add optional reflection notes**, if I want context.
- As a **user**, I want **mood logs stored as events**, not summaries.
- As a **user**, I can later **correlate mood with sleep, tasks, and focus**.

---

## ✅ **Delegation Center**

- As a **user**, I can **assign tasks to external people**, even if they don’t use the app.
- As a **user**, I can **track delegated task progress manually**.
- As a **user**, I want **delegation events logged**, so accountability remains.

---

## ✅ **Analytics (Local, Derived)**

- As a **user**, I can **see today’s productivity percentage**, derived from task logs.
- As a **user**, I can **see Awake vs Sleep breakdown**, without stored summaries.
- As a **user**, I can **see focus time and distraction count**, derived from events.
- As a **user**, I trust analytics because **they are recomputed from raw logs**.

---

## ✅ **Export & Sync (Phase-1 Part-A)**

- As a **user**, I can **export all my data as structured JSON logs**, anytime.
- As a **user**, I can **import logs back into the app**, without duplication.
- As a **user**, I can **upload exported logs to ChatGPT / Gemini / Dashboard**, for analysis.
- As a **user**, I want **schema versioning**, so future imports remain compatible.

---

---

# 🛠️ **SYSTEM / TECHNICAL STORIES**

- As a **system**, every user action must **emit a structured event**.
- As a **system**, events must be **immutable and timestamped**.
- As a **system**, derived metrics must **never be stored permanently**.
- As a **system**, exports must be **schema-versioned and deterministic**.
- As a **system**, data must remain **usable without internet**.
- As a **system**, all future integrations must **consume logs, not UI state**.