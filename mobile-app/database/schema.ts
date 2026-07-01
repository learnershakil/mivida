import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const SCHEMA_VERSION = 13;

export const schema = appSchema({
  version: SCHEMA_VERSION,
  tables: [
    // ============================================
    // CODING_LOGS - WakaTime coding stats
    // ============================================
    tableSchema({
      name: 'coding_logs',
      columns: [
        { name: 'date', type: 'number', isIndexed: true },
        { name: 'duration', type: 'number' },
        { name: 'project', type: 'string', isOptional: true },
        { name: 'language', type: 'string', isOptional: true },
        { name: 'user_id', type: 'string', isIndexed: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),
    // ============================================
    // EVENT_LOGS - Core immutable event store
    // All user actions are logged here as events
    // ============================================
    tableSchema({
      name: 'event_logs',
      columns: [
        { name: 'event_type', type: 'string', isIndexed: true },
        { name: 'entity_type', type: 'string', isOptional: true, isIndexed: true },
        { name: 'entity_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'payload', type: 'string' }, // JSON string
        { name: 'user_id', type: 'string', isIndexed: true },
        { name: 'device_id', type: 'string', isOptional: true },
        { name: 'session_id', type: 'string', isOptional: true },
        { name: 'timezone', type: 'string' },
        { name: 'schema_version', type: 'number' },
        { name: 'created_at', type: 'number', isIndexed: true },
      ],
    }),
    // ============================================
    // USERS - Current user state (projection)
    // ============================================
    tableSchema({
      name: 'users',
      columns: [
        { name: 'name', type: 'string', isOptional: true },
        { name: 'avatar_url', type: 'string', isOptional: true },
        { name: 'passcode', type: 'string', isOptional: true },
        { name: 'is_awake', type: 'boolean' },
        { name: 'last_interaction', type: 'number' }, // timestamp
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    // ============================================
    // SETTINGS - User preferences (projection)
    // ============================================
    tableSchema({
      name: 'settings',
      columns: [
        { name: 'dead_man_threshold_minutes', type: 'number' },
        { name: 'dead_man_enabled', type: 'boolean' },
        { name: 'notification_intensity', type: 'string' },
        { name: 'notification_sound', type: 'string' }, // 'default', 'chime', 'bell', 'alert', 'gentle', 'custom'
        { name: 'custom_notification_sound_uri', type: 'string', isOptional: true }, // URI to custom sound file
        { name: 'custom_notification_sound_name', type: 'string', isOptional: true }, // Display name for custom sound
        { name: 'notification_sound_enabled', type: 'boolean' },
        { name: 'notification_vibration_enabled', type: 'boolean' },
        { name: 'lockdown_strictness', type: 'string' },
        { name: 'lockdown_allow_calls', type: 'boolean' },
        { name: 'task_mode', type: 'string' },
        { name: 'auto_load_fixed_tasks', type: 'boolean' },
        { name: 'export_format', type: 'string' },
        { name: 'include_device_info', type: 'boolean' },
        { name: 'timezone', type: 'string' },
        { name: 'vault_passcode_hash', type: 'string', isOptional: true },
        { name: 'vault_auto_lock_minutes', type: 'number' },
        { name: 'last_sync_timestamp', type: 'number', isOptional: true },
        { name: 'focus_lockdown_mode', type: 'string', isOptional: true },
        { name: 'focus_allow_incoming_calls', type: 'boolean', isOptional: true },
        { name: 'day_mode', type: 'string', isOptional: true },
        { name: 'fatigue_screen_time_threshold_hours', type: 'number', isOptional: true },
        { name: 'fatigue_steps_threshold', type: 'number', isOptional: true },
        { name: 'fixed_tasks_template', type: 'string' }, // JSON string
        { name: 'mood_tracker_enabled', type: 'boolean', isOptional: true }, // Mood tracking every 45 mins
        { name: 'mood_tracker_interval_minutes', type: 'number', isOptional: true }, // Default 45 minutes
        { name: 'user_id', type: 'string', isIndexed: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    // ============================================
    // CONTACTS - User's contacts for delegation
    // ============================================
    tableSchema({
      name: 'contacts',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'email', type: 'string', isOptional: true },
        { name: 'phone', type: 'string', isOptional: true },
        { name: 'socials', type: 'string', isOptional: true }, // JSON string
        { name: 'user_id', type: 'string', isIndexed: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),
    // ============================================
    // TASKS - Task definitions (projection)
    // Task execution is tracked via events
    // ============================================
    tableSchema({
      name: 'tasks',
      columns: [
        { name: 'title', type: 'string' },
        { name: 'description', type: 'string', isOptional: true },
        { name: 'category', type: 'string', isOptional: true },
        { name: 'expected_duration_minutes', type: 'number', isOptional: true },
        { name: 'type', type: 'string', isIndexed: true }, // 'fixed', 'custom', 'alert'
        { name: 'priority', type: 'string' }, // 'normal', 'important', 'urgent'
        { name: 'assigned_persons', type: 'string', isOptional: true }, // JSON array of person names
        { name: 'contact_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'start_date', type: 'number', isOptional: true },
        { name: 'end_date', type: 'number', isOptional: true },
        { name: 'start_time', type: 'number', isOptional: true }, // Scheduled start datetime
        { name: 'end_time', type: 'number', isOptional: true }, // Scheduled end datetime
        { name: 'completion_remark', type: 'string', isOptional: true },
        { name: 'is_active', type: 'boolean', isIndexed: true }, // Currently running timer
        { name: 'is_completed', type: 'boolean', isIndexed: true },
        { name: 'completion_percent', type: 'number' },
        { name: 'timer_started_at', type: 'number', isOptional: true }, // When current timer session started
        { name: 'total_elapsed_seconds', type: 'number' }, // Accumulated time across all sessions
        { name: 'scheduled_date', type: 'number', isOptional: true, isIndexed: true },
        { name: 'scheduled_time', type: 'number', isOptional: true },
        // Alert task fields
        { name: 'alert_type', type: 'string', isOptional: true }, // 'timeout' or 'interval'
        { name: 'alert_interval_minutes', type: 'number', isOptional: true }, // Minutes for timeout/interval
        { name: 'is_alert_active', type: 'boolean', isOptional: true }, // Whether alert is currently scheduled
        { name: 'last_alert_triggered_at', type: 'number', isOptional: true }, // For interval tracking
        // Delegation fields
        { name: 'is_delegated', type: 'boolean' },
        { name: 'delegated_to', type: 'string', isOptional: true },
        { name: 'delegated_status', type: 'string', isOptional: true }, // 'assigned', 'partial', 'completed'
        // Cancellation
        { name: 'is_cancelled', type: 'boolean', isOptional: true },
        { name: 'cancelled_at', type: 'number', isOptional: true },
        { name: 'cancel_reason', type: 'string', isOptional: true },
        // User reference
        { name: 'user_id', type: 'string', isIndexed: true },
        { name: 'created_at', type: 'number', isIndexed: true },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),
    // ============================================
    // FINANCE_LOGS - Financial transactions (projection)
    // Balance is computed from these logs, never stored
    // ============================================
    tableSchema({
      name: 'finance_logs',
      columns: [
        { name: 'amount', type: 'number' },
        { name: 'type', type: 'string', isIndexed: true }, // 'credit', 'debit'
        { name: 'category', type: 'string', isOptional: true },
        { name: 'source', type: 'string', isOptional: true },
        { name: 'destination', type: 'string', isOptional: true },
        { name: 'description', type: 'string', isOptional: true },
        { name: 'transaction_date', type: 'number', isIndexed: true },
        { name: 'is_scheduled', type: 'boolean', isIndexed: true },
        { name: 'scheduled_for', type: 'number', isOptional: true, isIndexed: true },
        { name: 'is_triggered', type: 'boolean' }, // For scheduled transactions
        { name: 'is_cancelled', type: 'boolean' },
        { name: 'user_id', type: 'string', isIndexed: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),
    // ============================================
    // NOTIFICATION_LOGS - Notification tracking
    // ============================================
    tableSchema({
      name: 'notification_logs',
      columns: [
        { name: 'type', type: 'string', isIndexed: true }, // 'informational', 'warning', 'mandatory', 'system'
        { name: 'title', type: 'string' },
        { name: 'body', type: 'string', isOptional: true },
        { name: 'image_path', type: 'string', isOptional: true },
        { name: 'input_prompt', type: 'string', isOptional: true },
        { name: 'input_options', type: 'string', isOptional: true }, // JSON array
        { name: 'user_response', type: 'string', isOptional: true },
        { name: 'status', type: 'string', isIndexed: true }, // 'scheduled', 'triggered', 'viewed', 'responded', 'dismissed'
        { name: 'scheduled_for', type: 'number', isOptional: true },
        { name: 'triggered_at', type: 'number', isOptional: true },
        { name: 'viewed_at', type: 'number', isOptional: true },
        { name: 'responded_at', type: 'number', isOptional: true },
        { name: 'dismissed_at', type: 'number', isOptional: true },
        { name: 'user_id', type: 'string', isIndexed: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    // ============================================
    // MOOD_LOGS - Mood tracking for reflection
    // ============================================
    tableSchema({
      name: 'mood_logs',
      columns: [
        { name: 'mood', type: 'string', isIndexed: true }, // 'TERRIBLE', 'BAD', 'MEH', 'GOOD', 'GREAT'
        { name: 'mood_value', type: 'number' }, // 1-5 for analytics
        { name: 'level', type: 'number' }, // 1-5 for analytics (duplicate for compat)
        { name: 'note', type: 'string', isOptional: true },
        { name: 'user_id', type: 'string', isIndexed: true },
        { name: 'created_at', type: 'number', isIndexed: true },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),
    // ============================================
    // VAULT_MEDIA - Secure vault storage
    // ============================================
    tableSchema({
      name: 'vault_media',
      columns: [
        { name: 'uri', type: 'string', isOptional: true }, // Optional for notes
        { name: 'media_type', type: 'string', isIndexed: true }, // 'image', 'video', 'audio', 'note'
        { name: 'filename', type: 'string', isOptional: true },
        { name: 'title', type: 'string', isOptional: true }, // Title for notes/audio
        { name: 'content', type: 'string', isOptional: true }, // Text content for notes
        { name: 'duration', type: 'number', isOptional: true }, // Audio duration in ms
        { name: 'user_id', type: 'string', isIndexed: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),
    // ============================================
    // MUSIC_TRACKS - User's music library
    // ============================================
    tableSchema({
      name: 'music_tracks',
      columns: [
        { name: 'title', type: 'string' },
        { name: 'artist', type: 'string' },
        { name: 'album', type: 'string', isOptional: true },
        { name: 'file_uri', type: 'string' },
        { name: 'file_name', type: 'string' },
        { name: 'album_art_uri', type: 'string', isOptional: true }, // Custom album art
        { name: 'duration', type: 'number' }, // Duration in seconds
        { name: 'category', type: 'string', isIndexed: true },
        { name: 'is_favorite', type: 'boolean', isIndexed: true },
        { name: 'play_count', type: 'number' },
        { name: 'user_id', type: 'string', isIndexed: true },
        { name: 'created_at', type: 'number', isIndexed: true },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    // ============================================
    // MUSIC_CATEGORIES - Custom music categories
    // ============================================
    tableSchema({
      name: 'music_categories',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'icon', type: 'string', isOptional: true }, // Emoji or icon name
        { name: 'color', type: 'string', isOptional: true }, // Hex color
        { name: 'default_art_uri', type: 'string', isOptional: true }, // Default album art for category
        { name: 'position', type: 'number' }, // For ordering
        { name: 'is_system', type: 'boolean' }, // System categories can't be deleted
        { name: 'user_id', type: 'string', isIndexed: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
  ],
});
