import { Model } from '@nozbe/watermelondb';
import { field, date, readonly, json } from '@nozbe/watermelondb/decorators';

const sanitizeAssignedPersons = (raw: any) => {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }
  return [];
};

/**
 * Task - Task definition and current state
 *
 * This is a "projection" table for fast UI reads.
 * All task state changes (start, pause, complete) are logged as events.
 * Task duration is tracked in total_elapsed_seconds.
 *
 * Types:
 * - 'fixed': Daily routine tasks that reset at 5 AM
 * - 'custom': One-time tasks that auto-remove after 48 hours
 * - 'alert': Notification-based tasks (timeout or interval)
 */
export default class Task extends Model {
  static table = 'tasks';

  @field('title') title!: string;
  @field('description') description?: string;
  @field('category') category?: string;
  @field('expected_duration_minutes') expectedDurationMinutes?: number;
  @field('type') type!: 'fixed' | 'custom' | 'alert';
  @field('priority') priority!: 'normal' | 'important' | 'urgent';
  @json('assigned_persons', sanitizeAssignedPersons) assignedPersons!: string[];
  @field('contact_id') contactId?: string;
  @date('start_date') startDate?: number;
  @date('end_date') endDate?: number;
  @date('start_time') startTime?: number;
  @date('end_time') endTime?: number;
  @field('completion_remark') completionRemark?: string;

  // Current execution state
  @field('is_active') isActive!: boolean; // Timer currently running
  @field('is_completed') isCompleted!: boolean;
  @field('completion_percent') completionPercent!: number; // 0-100
  @date('timer_started_at') timerStartedAt?: number; // When current session started
  @field('total_elapsed_seconds') totalElapsedSeconds!: number; // Accumulated time

  // Scheduling
  @date('scheduled_date') scheduledDate?: number;
  @date('scheduled_time') scheduledTime?: number;

  // Alert task fields
  @field('alert_type') alertType?: 'timeout' | 'interval'; // Type of alert
  @field('alert_interval_minutes') alertIntervalMinutes?: number; // Minutes for timeout/interval
  @field('is_alert_active') isAlertActive?: boolean; // Whether alert is currently scheduled
  @date('last_alert_triggered_at') lastAlertTriggeredAt?: number; // For interval tracking

  // Delegation
  @field('is_delegated') isDelegated!: boolean;
  @field('delegated_to') delegatedTo?: string;
  @field('delegated_status') delegatedStatus?: 'assigned' | 'partial' | 'completed';

  // Cancellation
  @field('is_cancelled') isCancelled?: boolean;
  @date('cancelled_at') cancelledAt?: number;
  @field('cancel_reason') cancelReason?: string;

  // User reference
  @field('user_id') userId!: string;

  @readonly @date('created_at') createdAt!: number;
  @date('updated_at') updatedAt!: number;
  @date('deleted_at') deletedAt?: number;
}
