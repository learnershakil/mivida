-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT,
    "xHttpKey" TEXT NOT NULL,
    "wakatimeApiKey" TEXT,
    "wakatimeUsername" TEXT,
    "wakatimePassword" TEXT,
    "name" TEXT,
    "avatarUrl" TEXT,
    "passcodeHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT,
    "avatarR2Key" TEXT,
    "passcode" TEXT,
    "isAwake" BOOLEAN NOT NULL DEFAULT false,
    "lastInteraction" BIGINT,
    "updatedAt" BIGINT NOT NULL,
    "serverUpdatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deadManThresholdMinutes" INTEGER NOT NULL DEFAULT 180,
    "deadManEnabled" BOOLEAN NOT NULL DEFAULT true,
    "notificationIntensity" TEXT NOT NULL DEFAULT 'normal',
    "notificationSound" TEXT NOT NULL DEFAULT 'default',
    "customNotificationSoundUri" TEXT,
    "customNotificationSoundName" TEXT,
    "notificationSoundEnabled" BOOLEAN NOT NULL DEFAULT true,
    "notificationVibrationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lockdownStrictness" TEXT NOT NULL DEFAULT 'normal',
    "lockdownAllowCalls" BOOLEAN NOT NULL DEFAULT true,
    "taskMode" TEXT NOT NULL DEFAULT 'weekday',
    "autoLoadFixedTasks" BOOLEAN NOT NULL DEFAULT true,
    "exportFormat" TEXT NOT NULL DEFAULT 'jsonl',
    "includeDeviceInfo" BOOLEAN NOT NULL DEFAULT true,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "vaultPasscodeHash" TEXT,
    "vaultAutoLockMinutes" INTEGER NOT NULL DEFAULT 5,
    "moodTrackerEnabled" BOOLEAN NOT NULL DEFAULT false,
    "moodTrackerIntervalMinutes" INTEGER NOT NULL DEFAULT 45,
    "insights" JSONB,
    "lastSyncTimestamp" BIGINT,
    "updatedAt" BIGINT NOT NULL,
    "serverUpdatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT,
    "categoryName" TEXT,
    "expectedDurationMinutes" INTEGER,
    "type" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "assignedPersons" JSONB,
    "contactId" TEXT,
    "startDate" BIGINT,
    "endDate" BIGINT,
    "startTime" BIGINT,
    "endTime" BIGINT,
    "isTimeOnly" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completionPercent" INTEGER NOT NULL DEFAULT 0,
    "timerStartedAt" BIGINT,
    "totalElapsedSeconds" INTEGER NOT NULL DEFAULT 0,
    "completionRemark" TEXT,
    "completedAt" BIGINT,
    "failedAt" BIGINT,
    "scheduledDate" BIGINT,
    "scheduledTime" BIGINT,
    "alertType" TEXT,
    "alertIntervalMinutes" INTEGER,
    "isAlertActive" BOOLEAN DEFAULT false,
    "lastAlertTriggeredAt" BIGINT,
    "isDelegated" BOOLEAN NOT NULL DEFAULT false,
    "delegatedTo" TEXT,
    "delegatedStatus" TEXT,
    "isCancelled" BOOLEAN DEFAULT false,
    "cancelledAt" BIGINT,
    "cancelReason" TEXT,
    "googleEventId" TEXT,
    "createdAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL,
    "deletedAt" BIGINT,
    "serverUpdatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskInstance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "date" BIGINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "completedAt" BIGINT,
    "remark" TEXT,
    "googleEventId" TEXT,
    "updatedAt" BIGINT NOT NULL,
    "serverUpdatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "TaskInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "source" TEXT NOT NULL DEFAULT 'web',
    "createdAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL,
    "deletedAt" BIGINT,
    "serverUpdatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "socials" JSONB,
    "createdAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL,
    "deletedAt" BIGINT,
    "serverUpdatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "payload" JSONB NOT NULL,
    "deviceId" TEXT,
    "sessionId" TEXT,
    "timezone" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL,
    "createdAt" BIGINT NOT NULL,
    "serverUpdatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "EventLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT,
    "source" TEXT,
    "destination" TEXT,
    "description" TEXT,
    "transactionDate" BIGINT NOT NULL,
    "isScheduled" BOOLEAN NOT NULL DEFAULT false,
    "scheduledFor" BIGINT,
    "isTriggered" BOOLEAN NOT NULL DEFAULT true,
    "isCancelled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL,
    "deletedAt" BIGINT,
    "serverUpdatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "FinanceLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MoodLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mood" TEXT NOT NULL,
    "moodValue" INTEGER NOT NULL,
    "level" INTEGER NOT NULL,
    "score10" INTEGER,
    "note" TEXT,
    "createdAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL,
    "deletedAt" BIGINT,
    "serverUpdatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "MoodLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MusicTrack" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "artist" TEXT NOT NULL,
    "album" TEXT,
    "r2Key" TEXT,
    "localPathHint" TEXT,
    "fileName" TEXT NOT NULL,
    "albumArtR2Key" TEXT,
    "duration" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "playCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL,
    "serverUpdatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "MusicTrack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MusicCategory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "color" TEXT,
    "defaultArtUri" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL,
    "serverUpdatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "MusicCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VaultItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "r2Key" TEXT,
    "ciphertextRef" TEXT,
    "encTitle" TEXT,
    "encMeta" JSONB,
    "duration" INTEGER,
    "createdAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL,
    "deletedAt" BIGINT,
    "serverUpdatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "VaultItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FocusSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "forcedPostBreak" BOOLEAN NOT NULL DEFAULT false,
    "strictness" TEXT NOT NULL DEFAULT 'normal',
    "scheduledFor" BIGINT,
    "startedAt" BIGINT,
    "endedAt" BIGINT,
    "breakAttempts" INTEGER NOT NULL DEFAULT 0,
    "panicExit" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL,
    "serverUpdatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "FocusSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Schedule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "rule" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL,
    "serverUpdatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "imagePath" TEXT,
    "inputPrompt" TEXT,
    "inputOptions" TEXT,
    "userResponse" TEXT,
    "status" TEXT NOT NULL,
    "scheduledFor" BIGINT,
    "triggeredAt" BIGINT,
    "viewedAt" BIGINT,
    "respondedAt" BIGINT,
    "dismissedAt" BIGINT,
    "createdAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL,
    "serverUpdatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodingLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" BIGINT NOT NULL,
    "duration" INTEGER NOT NULL,
    "project" TEXT,
    "language" TEXT,
    "createdAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL,
    "deletedAt" BIGINT,
    "serverUpdatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "CodingLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageStat" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" BIGINT NOT NULL,
    "totalScreenMs" BIGINT NOT NULL,
    "perApp" JSONB,
    "serverUpdatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "UsageStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SensorStat" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" BIGINT NOT NULL,
    "steps" INTEGER NOT NULL,
    "meta" JSONB,
    "serverUpdatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "SensorStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Insight" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB NOT NULL,

    CONSTRAINT "Insight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceLastSyncAt" BIGINT,
    "serverLastAppliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoogleAuth" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiryDate" BIGINT NOT NULL,
    "calendarId" TEXT,
    "scope" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleAuth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WakatimeCache" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" BIGINT NOT NULL,
    "payload" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WakatimeCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_xHttpKey_key" ON "User"("xHttpKey");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_userId_key" ON "Profile"("userId");

-- CreateIndex
CREATE INDEX "Profile_serverUpdatedAt_idx" ON "Profile"("serverUpdatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Setting_userId_key" ON "Setting"("userId");

-- CreateIndex
CREATE INDEX "Setting_serverUpdatedAt_idx" ON "Setting"("serverUpdatedAt");

-- CreateIndex
CREATE INDEX "Task_userId_type_idx" ON "Task"("userId", "type");

-- CreateIndex
CREATE INDEX "Task_serverUpdatedAt_idx" ON "Task"("serverUpdatedAt");

-- CreateIndex
CREATE INDEX "TaskInstance_serverUpdatedAt_idx" ON "TaskInstance"("serverUpdatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TaskInstance_taskId_date_key" ON "TaskInstance"("taskId", "date");

-- CreateIndex
CREATE INDEX "Category_serverUpdatedAt_idx" ON "Category"("serverUpdatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Category_userId_name_key" ON "Category"("userId", "name");

-- CreateIndex
CREATE INDEX "Contact_serverUpdatedAt_idx" ON "Contact"("serverUpdatedAt");

-- CreateIndex
CREATE INDEX "EventLog_userId_eventType_idx" ON "EventLog"("userId", "eventType");

-- CreateIndex
CREATE INDEX "EventLog_serverUpdatedAt_idx" ON "EventLog"("serverUpdatedAt");

-- CreateIndex
CREATE INDEX "FinanceLog_serverUpdatedAt_idx" ON "FinanceLog"("serverUpdatedAt");

-- CreateIndex
CREATE INDEX "MoodLog_serverUpdatedAt_idx" ON "MoodLog"("serverUpdatedAt");

-- CreateIndex
CREATE INDEX "MusicTrack_serverUpdatedAt_idx" ON "MusicTrack"("serverUpdatedAt");

-- CreateIndex
CREATE INDEX "MusicCategory_serverUpdatedAt_idx" ON "MusicCategory"("serverUpdatedAt");

-- CreateIndex
CREATE INDEX "VaultItem_serverUpdatedAt_idx" ON "VaultItem"("serverUpdatedAt");

-- CreateIndex
CREATE INDEX "FocusSession_serverUpdatedAt_idx" ON "FocusSession"("serverUpdatedAt");

-- CreateIndex
CREATE INDEX "Schedule_serverUpdatedAt_idx" ON "Schedule"("serverUpdatedAt");

-- CreateIndex
CREATE INDEX "NotificationLog_serverUpdatedAt_idx" ON "NotificationLog"("serverUpdatedAt");

-- CreateIndex
CREATE INDEX "CodingLog_serverUpdatedAt_idx" ON "CodingLog"("serverUpdatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CodingLog_userId_date_project_language_key" ON "CodingLog"("userId", "date", "project", "language");

-- CreateIndex
CREATE UNIQUE INDEX "UsageStat_userId_date_key" ON "UsageStat"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "SensorStat_userId_date_key" ON "SensorStat"("userId", "date");

-- CreateIndex
CREATE INDEX "Insight_userId_type_idx" ON "Insight"("userId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "SyncState_userId_key" ON "SyncState"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GoogleAuth_userId_key" ON "GoogleAuth"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WakatimeCache_userId_date_key" ON "WakatimeCache"("userId", "date");

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Setting" ADD CONSTRAINT "Setting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskInstance" ADD CONSTRAINT "TaskInstance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskInstance" ADD CONSTRAINT "TaskInstance_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventLog" ADD CONSTRAINT "EventLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceLog" ADD CONSTRAINT "FinanceLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoodLog" ADD CONSTRAINT "MoodLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MusicTrack" ADD CONSTRAINT "MusicTrack_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MusicCategory" ADD CONSTRAINT "MusicCategory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaultItem" ADD CONSTRAINT "VaultItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FocusSession" ADD CONSTRAINT "FocusSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodingLog" ADD CONSTRAINT "CodingLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageStat" ADD CONSTRAINT "UsageStat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SensorStat" ADD CONSTRAINT "SensorStat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Insight" ADD CONSTRAINT "Insight_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncState" ADD CONSTRAINT "SyncState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoogleAuth" ADD CONSTRAINT "GoogleAuth_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WakatimeCache" ADD CONSTRAINT "WakatimeCache_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

