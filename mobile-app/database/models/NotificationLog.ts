import { Model } from '@nozbe/watermelondb';
import { field, date, readonly, json } from '@nozbe/watermelondb/decorators';

const sanitizeArray = (raw: unknown): string[] => {
  if (Array.isArray(raw)) return raw as string[];
  return [];
};

/**
 * NotificationLog - Notification lifecycle tracking
 *
 * Tracks notifications from scheduling through response/dismissal.
 * Supports interactive notifications with input fields.
 */
export default class NotificationLog extends Model {
  static table = 'notification_logs';

  @field('type') type!: 'informational' | 'warning' | 'mandatory' | 'system';
  @field('title') title!: string;
  @field('body') body?: string;
  @field('image_path') imagePath?: string;
  @field('input_prompt') inputPrompt?: string;
  @json('input_options', sanitizeArray) inputOptions?: string[];
  @field('user_response') userResponse?: string;

  // Lifecycle status
  @field('status') status!: 'scheduled' | 'triggered' | 'viewed' | 'responded' | 'dismissed';
  @date('scheduled_for') scheduledFor?: number;
  @date('triggered_at') triggeredAt?: number;
  @date('viewed_at') viewedAt?: number;
  @date('responded_at') respondedAt?: number;
  @date('dismissed_at') dismissedAt?: number;

  @field('user_id') userId!: string;

  @readonly @date('created_at') createdAt!: number;
  @date('updated_at') updatedAt!: number;
}
