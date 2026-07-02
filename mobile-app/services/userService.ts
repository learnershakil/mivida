/**
 * UserService
 *
 * Manages user state including awake/sleep mode.
 * All state changes emit events for analytics.
 */

import { database } from '../database';
import User from '../database/models/User';
import Settings from '../database/models/Settings';
import { emitEvent, EventTypes } from './eventLogger';

/**
 * Get device timezone
 */
function getTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

const DEFAULT_USER_ID = 'local_user';

/**
 * Initialize user and settings if not exists
 * Called on app startup
 */
export async function initializeUser(): Promise<{ user: User; settings: Settings }> {
  const usersCollection = database.get<User>('users');
  const settingsCollection = database.get<Settings>('settings');

  let users = await usersCollection.query().fetch();
  let user = users[0];

  // Create default user if none exists
  if (!user) {
    user = await database.write(async () => {
      return await usersCollection.create((record) => {
        record._raw.id = DEFAULT_USER_ID;
        record.name = '';
        record.isAwake = true;
        record.lastInteraction = Date.now();
      });
    });
  }

  // Check for settings
  let settingsList = await settingsCollection.query().fetch();
  let settings = settingsList.find((s) => s.userId === user.id);

  // Create default settings if none exists
  if (!settings) {
    settings = await database.write(async () => {
      return await settingsCollection.create((record) => {
        record.userId = user.id;
        record.deadManThresholdMinutes = 180; // 3 hours
        record.deadManEnabled = true;
        record.notificationIntensity = 'medium';
        record.notificationSound = 'default';
        record.notificationSoundEnabled = true;
        record.notificationVibrationEnabled = true;
        record.lockdownStrictness = 'normal';
        record.lockdownAllowCalls = true;
        record.taskMode = 'weekday';
        record.autoLoadFixedTasks = true;
        record.exportFormat = 'jsonl';
        record.includeDeviceInfo = true;
        record.timezone = getTimezone();
        record.vaultAutoLockMinutes = 5;
        record.fixedTasksTemplate = {};
      });
    });
  }

  return { user, settings };
}

/**
 * Get the current user
 */
export async function getCurrentUser(): Promise<User | null> {
  const collection = database.get<User>('users');
  const users = await collection.query().fetch();
  return users[0] || null;
}

/**
 * Get user settings
 */
export async function getUserSettings(userId: string): Promise<Settings | null> {
  const collection = database.get<Settings>('settings');
  const settings = await collection.query().fetch();
  return settings.find((s) => s.userId === userId) || null;
}

/**
 * Toggle awake/sleep state with event logging
 */
export async function toggleAwakeState(user: User): Promise<void> {
  const previousState = user.isAwake ? 'awake' : 'sleep';
  const newState = user.isAwake ? 'sleep' : 'awake';

  // Use the model's writer method for proper reactivity
  await user.toggleAwake();

  // Emit state change event
  await emitEvent({
    eventType: EventTypes.STATE_CHANGE,
    entityType: 'user',
    entityId: user.id,
    payload: {
      from: previousState,
      to: newState,
      timestamp: Date.now(),
    },
    userId: user.id,
  });

  console.log(`[UserService] State changed: ${previousState} → ${newState}`);
}

/**
 * Set awake state explicitly
 */
export async function setAwakeState(user: User, isAwake: boolean): Promise<void> {
  if (user.isAwake === isAwake) return; // No change needed

  const previousState = user.isAwake ? 'awake' : 'sleep';
  const newState = isAwake ? 'awake' : 'sleep';

  // Use the model's writer method for proper reactivity
  await user.setAwake(isAwake);

  await emitEvent({
    eventType: EventTypes.STATE_CHANGE,
    entityType: 'user',
    entityId: user.id,
    payload: {
      from: previousState,
      to: newState,
      timestamp: Date.now(),
    },
    userId: user.id,
  });

  console.log(`[UserService] State set: ${previousState} → ${newState}`);
}

/**
 * Update user profile
 */
export async function updateProfile(
  user: User,
  updates: { name?: string; avatarUrl?: string }
): Promise<void> {
  await database.write(async () => {
    await user.update((record) => {
      if (updates.name !== undefined) record.name = updates.name;
      if (updates.avatarUrl !== undefined) record.avatarUrl = updates.avatarUrl;
      record.lastInteraction = Date.now();
    });
  });

  // Cloud copy: push the new avatar to R2 in the background and store the key (syncs to Profile.avatarR2Key).
  if (updates.avatarUrl && updates.avatarUrl.startsWith('file')) {
    (async () => {
      try {
        const { uploadToR2 } = await import('./uploadService');
        const key = await uploadToR2(updates.avatarUrl!, 'avatar', 'image/jpeg');
        await database.write(async () => {
          await user.update((record) => {
            record.avatarR2Key = key;
          });
        });
        console.log('[userService] avatar uploaded to R2:', key);
      } catch (e) {
        console.warn('[userService] avatar R2 upload failed (kept local)', e);
      }
    })();
  }
}

/**
 * Update user settings with event logging
 */
export async function updateSettings(
  settings: Settings,
  updates: Partial<{
    deadManThresholdMinutes: number;
    deadManEnabled: boolean;
    notificationIntensity: string;
    notificationSound: string;
    notificationSoundEnabled: boolean;
    notificationVibrationEnabled: boolean;
    lockdownStrictness: string;
    lockdownAllowCalls: boolean;
    taskMode: string;
    autoLoadFixedTasks: boolean;
    timezone: string;
    vaultAutoLockMinutes: number;
    moodTrackerEnabled: boolean;
    moodTrackerIntervalMinutes: number;
  }>
): Promise<void> {
  const changedFields: Record<string, { from: unknown; to: unknown }> = {};

  // Track changes for event payload
  Object.entries(updates).forEach(([key, value]) => {
    const currentValue = (settings as unknown as Record<string, unknown>)[key];
    if (currentValue !== value) {
      changedFields[key] = { from: currentValue, to: value };
    }
  });

  if (Object.keys(changedFields).length === 0) return; // No changes

  await database.write(async () => {
    await settings.update((record) => {
      if (updates.deadManThresholdMinutes !== undefined)
        record.deadManThresholdMinutes = updates.deadManThresholdMinutes;
      if (updates.deadManEnabled !== undefined) record.deadManEnabled = updates.deadManEnabled;
      if (updates.notificationIntensity !== undefined)
        record.notificationIntensity = updates.notificationIntensity;
      if (updates.notificationSound !== undefined)
        record.notificationSound = updates.notificationSound;
      if (updates.notificationSoundEnabled !== undefined)
        record.notificationSoundEnabled = updates.notificationSoundEnabled;
      if (updates.notificationVibrationEnabled !== undefined)
        record.notificationVibrationEnabled = updates.notificationVibrationEnabled;
      if (updates.lockdownStrictness !== undefined)
        record.lockdownStrictness = updates.lockdownStrictness;
      if (updates.lockdownAllowCalls !== undefined)
        record.lockdownAllowCalls = updates.lockdownAllowCalls;
      if (updates.taskMode !== undefined) record.taskMode = updates.taskMode;
      if (updates.autoLoadFixedTasks !== undefined)
        record.autoLoadFixedTasks = updates.autoLoadFixedTasks;
      if (updates.timezone !== undefined) record.timezone = updates.timezone;
      if (updates.vaultAutoLockMinutes !== undefined)
        record.vaultAutoLockMinutes = updates.vaultAutoLockMinutes;
      if (updates.moodTrackerEnabled !== undefined)
        record.moodTrackerEnabled = updates.moodTrackerEnabled;
      if (updates.moodTrackerIntervalMinutes !== undefined)
        record.moodTrackerIntervalMinutes = updates.moodTrackerIntervalMinutes;
    });
  });

  // Emit settings update event
  await emitEvent({
    eventType: EventTypes.SETTINGS_UPDATED,
    entityType: 'settings',
    entityId: settings.id,
    payload: {
      changes: changedFields,
      timestamp: Date.now(),
    },
    userId: settings.userId,
  });
}

/**
 * Record user interaction (updates lastInteraction timestamp)
 * Used by Dead Man's Switch to detect inactivity
 */
export async function recordInteraction(user: User): Promise<void> {
  await database.write(async () => {
    await user.update((record) => {
      record.lastInteraction = Date.now();
    });
  });
}

export default {
  initialize: initializeUser,
  getCurrent: getCurrentUser,
  getSettings: getUserSettings,
  toggleAwake: toggleAwakeState,
  setAwake: setAwakeState,
  updateProfile,
  updateSettings,
  recordInteraction,
};
