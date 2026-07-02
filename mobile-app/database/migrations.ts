import { schemaMigrations, addColumns, createTable } from '@nozbe/watermelondb/Schema/migrations';

/**
 * Database Migrations
 *
 * WatermelonDB requires migrations when adding new columns to existing tables.
 * Each migration step moves the database from one version to the next.
 *
 * IMPORTANT: Never modify existing migrations - only add new ones.
 */
export const migrations = schemaMigrations({
  migrations: [
    // Migration from v4 to v5: Add alert task fields
    {
      toVersion: 5,
      steps: [
        addColumns({
          table: 'tasks',
          columns: [
            { name: 'alert_type', type: 'string', isOptional: true },
            { name: 'alert_interval_minutes', type: 'number', isOptional: true },
            { name: 'is_alert_active', type: 'boolean', isOptional: true },
            { name: 'last_alert_triggered_at', type: 'number', isOptional: true },
          ],
        }),
      ],
    },
    // Migration from v5 to v6: Add notification sound setting
    {
      toVersion: 6,
      steps: [
        addColumns({
          table: 'settings',
          columns: [{ name: 'notification_sound', type: 'string' }],
        }),
      ],
    },
    // Migration from v6 to v7: Add task cancellation and custom sound fields
    {
      toVersion: 7,
      steps: [
        addColumns({
          table: 'tasks',
          columns: [
            { name: 'is_cancelled', type: 'boolean', isOptional: true },
            { name: 'cancelled_at', type: 'number', isOptional: true },
            { name: 'cancel_reason', type: 'string', isOptional: true },
          ],
        }),
        addColumns({
          table: 'settings',
          columns: [
            { name: 'custom_notification_sound_uri', type: 'string', isOptional: true },
            { name: 'custom_notification_sound_name', type: 'string', isOptional: true },
          ],
        }),
      ],
    },
    // Migration from v7 to v8: Vault media restructure (notes, audio, media separation)
    {
      toVersion: 8,
      steps: [
        addColumns({
          table: 'vault_media',
          columns: [
            { name: 'title', type: 'string', isOptional: true },
            { name: 'content', type: 'string', isOptional: true },
            { name: 'duration', type: 'number', isOptional: true },
          ],
        }),
      ],
    },
    // Migration from v8 to v9: Add mood tracker settings
    {
      toVersion: 9,
      steps: [
        addColumns({
          table: 'settings',
          columns: [
            { name: 'mood_tracker_enabled', type: 'boolean', isOptional: true },
            { name: 'mood_tracker_interval_minutes', type: 'number', isOptional: true },
          ],
        }),
      ],
    },
    // Migration from v9 to v10: Add music_tracks table
    {
      toVersion: 10,
      steps: [
        createTable({
          name: 'music_tracks',
          columns: [
            { name: 'title', type: 'string' },
            { name: 'artist', type: 'string' },
            { name: 'album', type: 'string', isOptional: true },
            { name: 'file_uri', type: 'string' },
            { name: 'file_name', type: 'string' },
            { name: 'duration', type: 'number' },
            { name: 'category', type: 'string', isIndexed: true },
            { name: 'is_favorite', type: 'boolean', isIndexed: true },
            { name: 'play_count', type: 'number' },
            { name: 'user_id', type: 'string', isIndexed: true },
            { name: 'created_at', type: 'number', isIndexed: true },
            { name: 'updated_at', type: 'number' },
          ],
        }),
      ],
    },
    // Migration from v10 to v11: Add album_art_uri to music_tracks and create music_categories table
    {
      toVersion: 11,
      steps: [
        addColumns({
          table: 'music_tracks',
          columns: [{ name: 'album_art_uri', type: 'string', isOptional: true }],
        }),
        createTable({
          name: 'music_categories',
          columns: [
            { name: 'name', type: 'string' },
            { name: 'icon', type: 'string', isOptional: true },
            { name: 'color', type: 'string', isOptional: true },
            { name: 'default_art_uri', type: 'string', isOptional: true },
            { name: 'position', type: 'number' },
            { name: 'is_system', type: 'boolean' },
            { name: 'user_id', type: 'string', isIndexed: true },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
          ],
        }),
      ],
    },
    // Migration from v11 to v12: Add Contacts table, Sync/Focus fields to Settings, new fields to Tasks
    {
      toVersion: 12,
      steps: [
        addColumns({
          table: 'settings',
          columns: [
            { name: 'last_sync_timestamp', type: 'number', isOptional: true },
            { name: 'focus_lockdown_mode', type: 'string', isOptional: true },
            { name: 'focus_allow_incoming_calls', type: 'boolean', isOptional: true },
            { name: 'day_mode', type: 'string', isOptional: true },
            { name: 'fatigue_screen_time_threshold_hours', type: 'number', isOptional: true },
            { name: 'fatigue_steps_threshold', type: 'number', isOptional: true },
          ],
        }),
        addColumns({
          table: 'tasks',
          columns: [
            { name: 'contact_id', type: 'string', isOptional: true, isIndexed: true },
            { name: 'start_date', type: 'number', isOptional: true },
            { name: 'end_date', type: 'number', isOptional: true },
            { name: 'completion_remark', type: 'string', isOptional: true },
          ],
        }),
        createTable({
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
      ],
    },
    // Migration from v12 to v13: Add coding_logs table
    {
      toVersion: 13,
      steps: [
        createTable({
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
      ],
    },
    // Migration from v13 to v14: Task lifecycle correctness (completed_at, failed_at, status, is_time_only)
    {
      toVersion: 14,
      steps: [
        addColumns({
          table: 'tasks',
          columns: [
            { name: 'completed_at', type: 'number', isOptional: true },
            { name: 'failed_at', type: 'number', isOptional: true },
            { name: 'status', type: 'string', isOptional: true },
            { name: 'is_time_only', type: 'boolean', isOptional: true },
          ],
        }),
      ],
    },
    // Migration from v14 to v15: Add categories master-list table
    {
      toVersion: 15,
      steps: [
        createTable({
          name: 'categories',
          columns: [
            { name: 'name', type: 'string' },
            { name: 'color', type: 'string', isOptional: true },
            { name: 'source', type: 'string', isOptional: true },
            { name: 'user_id', type: 'string', isIndexed: true },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
            { name: 'deleted_at', type: 'number', isOptional: true },
          ],
        }),
      ],
    },
    // Migration from v15 to v16: Add raw 1-10 mood score column
    {
      toVersion: 16,
      steps: [
        addColumns({
          table: 'mood_logs',
          columns: [{ name: 'score10', type: 'number', isOptional: true }],
        }),
      ],
    },
    // Migration from v16 to v17: Add sensor_stats table (pedometer)
    {
      toVersion: 17,
      steps: [
        createTable({
          name: 'sensor_stats',
          columns: [
            { name: 'date', type: 'number', isIndexed: true },
            { name: 'steps', type: 'number' },
            { name: 'meta', type: 'string', isOptional: true },
            { name: 'user_id', type: 'string', isIndexed: true },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
          ],
        }),
      ],
    },
    // Migration from v17 to v18: R2 cloud-copy key columns (avatar, music, vault)
    {
      toVersion: 18,
      steps: [
        addColumns({
          table: 'users',
          columns: [{ name: 'avatar_r2_key', type: 'string', isOptional: true }],
        }),
        addColumns({
          table: 'music_tracks',
          columns: [
            { name: 'r2_key', type: 'string', isOptional: true },
            { name: 'album_art_r2_key', type: 'string', isOptional: true },
          ],
        }),
        addColumns({
          table: 'vault_media',
          columns: [{ name: 'r2_key', type: 'string', isOptional: true }],
        }),
      ],
    },
  ],
});
