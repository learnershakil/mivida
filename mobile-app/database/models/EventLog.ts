import { Model } from '@nozbe/watermelondb';
import { field, date, readonly, json } from '@nozbe/watermelondb/decorators';

/**
 * EventLog - Immutable, append-only event store
 *
 * This is the core data structure for the entire application.
 * All user actions emit events here. Analytics are derived from these logs.
 * Events are NEVER updated or deleted - only appended.
 *
 * Event Types:
 * - STATE_CHANGE (awake/sleep transitions)
 * - TASK_CREATED, TASK_STARTED, TASK_PAUSED, TASK_RESUMED, TASK_COMPLETED, TASK_SKIPPED, TASK_PROGRESS_UPDATED
 * - INACTIVITY_DETECTED, NUDGE_SENT, NUDGE_RESPONDED, NUDGE_IGNORED
 * - NOTIFICATION_SCHEDULED, NOTIFICATION_TRIGGERED, NOTIFICATION_VIEWED, NOTIFICATION_RESPONDED, NOTIFICATION_DISMISSED
 * - FOCUS_LOCK_STARTED, FOCUS_LOCK_ENDED, FOCUS_BREAK_ATTEMPTED, FOCUS_FORCE_EXIT
 * - FINANCE_CREDIT_ADDED, FINANCE_DEBIT_ADDED, FINANCE_SCHEDULED, FINANCE_TRIGGERED, FINANCE_CANCELLED
 * - VAULT_ACCESS_ATTEMPT, VAULT_ACCESS_GRANTED, VAULT_ACCESS_DENIED, VAULT_ITEM_ADDED, VAULT_ITEM_VIEWED, VAULT_ITEM_DELETED
 * - MOOD_REPORTED, DAILY_REFLECTION_ADDED
 * - DELEGATED_TASK_CREATED, DELEGATED_TASK_UPDATED, DELEGATED_TASK_COMPLETED
 * - MUSIC_PLAY_STARTED, MUSIC_PLAY_PAUSED, MUSIC_PLAY_STOPPED, MUSIC_TRACK_SKIPPED
 * - SETTINGS_UPDATED
 * - EXPORT_CREATED
 */

// Sanitizer for JSON fields
const sanitizePayload = (raw: unknown): Record<string, unknown> => {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
};

export default class EventLog extends Model {
  static table = 'event_logs';

  // Event type identifier (e.g., 'TASK_STARTED', 'STATE_CHANGE')
  @field('event_type') eventType!: string;

  // Optional reference to related entity (task_id, finance_log_id, etc.)
  @field('entity_type') entityType?: string; // 'task', 'finance', 'notification', etc.
  @field('entity_id') entityId?: string;

  // Flexible payload for event-specific data
  // e.g., { from: 'awake', to: 'sleep' } or { progress: 50 }
  @json('payload', sanitizePayload) payload!: Record<string, unknown>;

  // User who triggered the event
  @field('user_id') userId!: string;

  // Device/session info for future multi-device support
  @field('device_id') deviceId?: string;
  @field('session_id') sessionId?: string;

  // Timezone at time of event (important for analytics)
  @field('timezone') timezone!: string;

  // Schema version for forward compatibility
  @field('schema_version') schemaVersion!: number;

  // Immutable timestamp - when the event occurred
  @readonly @date('created_at') createdAt!: number;
}
