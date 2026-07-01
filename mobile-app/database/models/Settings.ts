import { Model } from '@nozbe/watermelondb';
import { field, date, readonly, json } from '@nozbe/watermelondb/decorators';

/**
 * Settings - User preferences and configuration
 *
 * Single row per user containing all app settings.
 * This is a mutable "projection" table for fast reads.
 * Changes to settings also emit SETTINGS_UPDATED events.
 */

const sanitizeObject = (raw: unknown): Record<string, unknown> => {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
};

export default class Settings extends Model {
  static table = 'settings';

  // === Dead Man's Switch Settings ===
  @field('dead_man_threshold_minutes') deadManThresholdMinutes!: number; // Default: 180 (3 hours)
  @field('dead_man_enabled') deadManEnabled!: boolean;

  // === Notification Settings ===
  @field('notification_intensity') notificationIntensity!: string; // 'low', 'medium', 'high'
  @field('notification_sound') notificationSound!: string; // 'default', 'chime', 'bell', 'alert', 'gentle', 'custom'
  @field('custom_notification_sound_uri') customNotificationSoundUri?: string; // URI to custom sound file
  @field('custom_notification_sound_name') customNotificationSoundName?: string; // Display name for custom sound
  @field('notification_sound_enabled') notificationSoundEnabled!: boolean;
  @field('notification_vibration_enabled') notificationVibrationEnabled!: boolean;

  // === Focus Lockdown Settings ===
  @field('lockdown_strictness') lockdownStrictness!: string; // 'normal', 'strict', 'extreme'
  @field('lockdown_allow_calls') lockdownAllowCalls!: boolean;

  // === Task Mode Settings ===
  @field('task_mode') taskMode!: string; // 'weekday', 'holiday'
  @field('auto_load_fixed_tasks') autoLoadFixedTasks!: boolean;

  // === Export Settings ===
  @field('export_format') exportFormat!: string; // 'jsonl'
  @field('include_device_info') includeDeviceInfo!: boolean;

  // === Timezone ===
  @field('timezone') timezone!: string;

  // === Vault Settings ===
  @field('vault_passcode_hash') vaultPasscodeHash?: string;
  @field('vault_auto_lock_minutes') vaultAutoLockMinutes!: number;

  // === Fixed Tasks Template (for weekday mode) ===
  @json('fixed_tasks_template', sanitizeObject) fixedTasksTemplate!: Record<string, unknown>;

  // === Mood Tracker Settings ===
  @field('mood_tracker_enabled') moodTrackerEnabled?: boolean;
  @field('mood_tracker_interval_minutes') moodTrackerIntervalMinutes?: number; // Default: 45 minutes

  // === Sync Settings ===
  @date('last_sync_timestamp') lastSyncTimestamp?: number;

  // === New Focus Lockdown Settings ===
  @field('focus_lockdown_mode') focusLockdownMode?: string;
  @field('focus_allow_incoming_calls') focusAllowIncomingCalls?: boolean;
  @field('day_mode') dayMode?: string;

  // === Fatigue Matrix Settings ===
  @field('fatigue_screen_time_threshold_hours') fatigueScreenTimeThresholdHours?: number;
  @field('fatigue_steps_threshold') fatigueStepsThreshold?: number;

  // === User Reference ===
  @field('user_id') userId!: string;

  @readonly @date('created_at') createdAt!: number;
  @date('updated_at') updatedAt!: number;
}
