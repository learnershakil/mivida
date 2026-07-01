/**
 * EventLogger Service
 *
 * Central service for emitting structured, immutable events.
 * All user actions flow through this service to maintain data integrity.
 *
 * Events are:
 * - Immutable (never updated or deleted)
 * - Timestamped with timezone
 * - Schema-versioned for forward compatibility
 * - Correlated with entity references where applicable
 */

import { database, SCHEMA_VERSION } from '../database';
import EventLog from '../database/models/EventLog';

/**
 * Get device timezone
 * Fallback to UTC if unavailable
 */
function getTimezone(): string {
  try {
    // Try to get timezone from Intl API (available in RN)
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

// Event type constants - organized by feature domain
export const EventTypes = {
  // User State
  STATE_CHANGE: 'STATE_CHANGE',

  // Task Management
  TASK_CREATED: 'TASK_CREATED',
  TASK_STARTED: 'TASK_STARTED',
  TASK_PAUSED: 'TASK_PAUSED',
  TASK_RESUMED: 'TASK_RESUMED',
  TASK_PROGRESS_UPDATED: 'TASK_PROGRESS_UPDATED',
  TASK_COMPLETED: 'TASK_COMPLETED',
  TASK_SKIPPED: 'TASK_SKIPPED',
  TASK_DELETED: 'TASK_DELETED',
  TASK_CANCELLED: 'TASK_CANCELLED',
  TASK_FAILED: 'TASK_FAILED',
  TASK_UPDATED: 'TASK_UPDATED',
  TASK_RENEWED: 'TASK_RENEWED',
  TASK_PARTIAL_COMPLETION: 'TASK_PARTIAL_COMPLETION',

  // Alert Tasks
  ALERT_SCHEDULED: 'ALERT_SCHEDULED',
  ALERT_TRIGGERED: 'ALERT_TRIGGERED',
  ALERT_CANCELLED: 'ALERT_CANCELLED',
  ALERT_DEACTIVATED: 'ALERT_DEACTIVATED',

  // Dead Man's Switch
  INACTIVITY_DETECTED: 'INACTIVITY_DETECTED',
  NUDGE_SENT: 'NUDGE_SENT',
  NUDGE_RESPONDED: 'NUDGE_RESPONDED',
  NUDGE_IGNORED: 'NUDGE_IGNORED',

  // Notifications
  NOTIFICATION_SCHEDULED: 'NOTIFICATION_SCHEDULED',
  NOTIFICATION_TRIGGERED: 'NOTIFICATION_TRIGGERED',
  NOTIFICATION_VIEWED: 'NOTIFICATION_VIEWED',
  NOTIFICATION_RESPONDED: 'NOTIFICATION_RESPONDED',
  NOTIFICATION_DISMISSED: 'NOTIFICATION_DISMISSED',

  // Focus Lockdown
  FOCUS_LOCK_STARTED: 'FOCUS_LOCK_STARTED',
  FOCUS_LOCK_ENDED: 'FOCUS_LOCK_ENDED',
  FOCUS_BREAK_ATTEMPTED: 'FOCUS_BREAK_ATTEMPTED',
  FOCUS_FORCE_EXIT: 'FOCUS_FORCE_EXIT',

  // Finance
  FINANCE_CREDIT_ADDED: 'FINANCE_CREDIT_ADDED',
  FINANCE_DEBIT_ADDED: 'FINANCE_DEBIT_ADDED',
  FINANCE_SCHEDULED: 'FINANCE_SCHEDULED',
  FINANCE_TRIGGERED: 'FINANCE_TRIGGERED',
  FINANCE_CANCELLED: 'FINANCE_CANCELLED',

  // Vault
  VAULT_OPENED: 'VAULT_OPENED',
  VAULT_CLOSED: 'VAULT_CLOSED',
  VAULT_ACCESS_ATTEMPT: 'VAULT_ACCESS_ATTEMPT',
  VAULT_ACCESS_GRANTED: 'VAULT_ACCESS_GRANTED',
  VAULT_ACCESS_DENIED: 'VAULT_ACCESS_DENIED',
  VAULT_ITEM_ADDED: 'VAULT_ITEM_ADDED',
  VAULT_ITEM_VIEWED: 'VAULT_ITEM_VIEWED',
  VAULT_ITEM_DELETED: 'VAULT_ITEM_DELETED',
  MEDIA_ADDED: 'MEDIA_ADDED',
  MEDIA_REMOVED: 'MEDIA_REMOVED',

  // Mood & Reflection
  MOOD_LOGGED: 'MOOD_LOGGED',
  MOOD_REPORTED: 'MOOD_REPORTED',
  DAILY_REFLECTION_ADDED: 'DAILY_REFLECTION_ADDED',

  // Delegation
  DELEGATED_TASK_CREATED: 'DELEGATED_TASK_CREATED',
  DELEGATED_TASK_UPDATED: 'DELEGATED_TASK_UPDATED',
  DELEGATED_TASK_COMPLETED: 'DELEGATED_TASK_COMPLETED',

  // Music
  MUSIC_PLAY_STARTED: 'MUSIC_PLAY_STARTED',
  MUSIC_PLAY_PAUSED: 'MUSIC_PLAY_PAUSED',
  MUSIC_PLAY_STOPPED: 'MUSIC_PLAY_STOPPED',
  MUSIC_TRACK_SKIPPED: 'MUSIC_TRACK_SKIPPED',
  MUSIC_PLAYBACK: 'MUSIC_PLAYBACK',

  // Settings
  SETTINGS_UPDATED: 'SETTINGS_UPDATED',

  // Export
  EXPORT_CREATED: 'EXPORT_CREATED',
  EXPORT_GENERATED: 'EXPORT_GENERATED',
} as const;

export type EventType = (typeof EventTypes)[keyof typeof EventTypes];

export interface EventPayload {
  [key: string]: unknown;
}

interface EmitEventParams {
  eventType: EventType;
  entityType?:
    | 'task'
    | 'finance'
    | 'notification'
    | 'mood'
    | 'vault'
    | 'vault_media'
    | 'delegation'
    | 'music'
    | 'settings'
    | 'user'
    | 'export'
    | 'system';
  entityId?: string;
  payload: EventPayload;
  userId: string;
  deviceId?: string;
  sessionId?: string;
}

// Session ID generated once per app session
let currentSessionId: string | null = null;

function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function getSessionId(): string {
  if (!currentSessionId) {
    currentSessionId = generateSessionId();
  }
  return currentSessionId;
}

// Device ID - in production, use a proper device identifier
function getDeviceId(): string {
  // TODO: Use expo-device or react-native-device-info for real device ID
  return 'device_local';
}

/**
 * Emit an event to the event log
 * This is the primary way to log user actions
 */
export async function emitEvent(params: EmitEventParams): Promise<EventLog> {
  const { eventType, entityType, entityId, payload, userId, deviceId, sessionId } = params;

  const event = await database.write(async () => {
    return await database.get<EventLog>('event_logs').create((record) => {
      record.eventType = eventType;
      record.entityType = entityType;
      record.entityId = entityId;
      record.payload = payload;
      record.userId = userId;
      record.deviceId = deviceId || getDeviceId();
      record.sessionId = sessionId || getSessionId();
      record.timezone = getTimezone();
      record.schemaVersion = SCHEMA_VERSION;
    });
  });

  // Log for debugging in development
  if (__DEV__) {
    console.log(`[Event] ${eventType}`, { entityType, entityId, payload });
  }

  return event;
}

/**
 * Query events by type for analytics
 */
export async function getEventsByType(
  eventType: EventType,
  userId: string,
  startDate?: Date,
  endDate?: Date
): Promise<EventLog[]> {
  const collection = database.get<EventLog>('event_logs');

  let query = collection.query();

  // Build query based on parameters
  const events = await query.fetch();

  // Filter in memory for complex conditions
  // (WatermelonDB doesn't support complex date range queries easily)
  return events.filter((event) => {
    if (event.eventType !== eventType) return false;
    if (event.userId !== userId) return false;
    if (startDate && event.createdAt < startDate.getTime()) return false;
    if (endDate && event.createdAt > endDate.getTime()) return false;
    return true;
  });
}

/**
 * Query events for a specific entity
 */
export async function getEventsForEntity(
  entityType: string,
  entityId: string,
  userId: string
): Promise<EventLog[]> {
  const collection = database.get<EventLog>('event_logs');
  const events = await collection.query().fetch();

  return events
    .filter(
      (event) =>
        event.entityType === entityType && event.entityId === entityId && event.userId === userId
    )
    .sort((a, b) => a.createdAt - b.createdAt);
}

/**
 * Get all events for a user within a date range
 */
export async function getEventsInRange(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<EventLog[]> {
  const collection = database.get<EventLog>('event_logs');
  const events = await collection.query().fetch();

  return events
    .filter(
      (event) =>
        event.userId === userId &&
        event.createdAt >= startDate.getTime() &&
        event.createdAt <= endDate.getTime()
    )
    .sort((a, b) => a.createdAt - b.createdAt);
}

/**
 * Get today's events for a user
 */
export async function getTodayEvents(userId: string): Promise<EventLog[]> {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  return getEventsInRange(userId, startOfDay, endOfDay);
}

/**
 * Export all events as JSONL format
 */
export async function exportEventsAsJsonl(userId: string): Promise<string> {
  const collection = database.get<EventLog>('event_logs');
  const events = await collection.query().fetch();

  const userEvents = events
    .filter((event) => event.userId === userId)
    .sort((a, b) => a.createdAt - b.createdAt);

  const lines = userEvents.map((event) =>
    JSON.stringify({
      id: event.id,
      event_type: event.eventType,
      entity_type: event.entityType,
      entity_id: event.entityId,
      payload: event.payload,
      device_id: event.deviceId,
      session_id: event.sessionId,
      timezone: event.timezone,
      schema_version: event.schemaVersion,
      created_at: new Date(event.createdAt).toISOString(),
    })
  );

  return lines.join('\n');
}

// Default export for convenience
export default {
  emit: emitEvent,
  getByType: getEventsByType,
  getForEntity: getEventsForEntity,
  getInRange: getEventsInRange,
  getToday: getTodayEvents,
  exportJsonl: exportEventsAsJsonl,
  EventTypes,
};
