/**
 * AlertService
 *
 * Manages alert task notifications.
 *
 * Alert Types:
 * - Timeout: One-time notification after X minutes, then task is marked complete/vanishes
 * - Interval: Repeating notifications every X minutes until task is deleted
 *
 * Uses notifee for scheduling and triggering notifications.
 */

import notifee, {
  AndroidImportance,
  TriggerType,
  TimestampTrigger,
  RepeatFrequency,
} from '@notifee/react-native';
import { database } from '../database';
import Task from '../database/models/Task';
import Settings from '../database/models/Settings';
import { Q } from '@nozbe/watermelondb';
import { emitEvent, EventTypes } from './eventLogger';

// Channel for alert notifications
const ALERT_CHANNEL_ID = 'alert_tasks';

class AlertService {
  private userId: string | null = null;
  private initialized = false;

  /**
   * Initialize alert service
   */
  async init(userId: string): Promise<void> {
    this.userId = userId;
    await this.createChannel();
    this.initialized = true;
    console.log('[AlertService] Initialized');
  }

  /**
   * Create notification channel for alerts with current sound setting
   */
  private async createChannel(): Promise<void> {
    let sound = 'default';

    // Try to get sound setting from database
    if (this.userId) {
      try {
        const settings = await database
          .get<Settings>('settings')
          .query(Q.where('user_id', this.userId))
          .fetch();

        if (settings.length > 0 && settings[0].notificationSound) {
          const soundSetting = settings[0].notificationSound;
          if (soundSetting === 'default') {
            sound = 'default';
          } else if (soundSetting === 'custom' && settings[0].customNotificationSoundUri) {
            // Use the custom sound URI for custom sounds
            sound = settings[0].customNotificationSoundUri;
          } else {
            // Use the preset sound name (chime, bell, alert, gentle)
            sound = soundSetting;
          }
        }
      } catch (error) {
        console.log('[AlertService] Using default sound');
      }
    }

    await notifee.createChannel({
      id: ALERT_CHANNEL_ID,
      name: 'Alert Tasks',
      importance: AndroidImportance.HIGH,
      sound: sound,
      vibration: true,
    });
  }

  /**
   * Refresh channel with updated sound (call after sound setting changes)
   */
  async refreshChannel(): Promise<void> {
    await this.createChannel();
    console.log('[AlertService] Channel refreshed with new sound');
  }

  /**
   * Schedule an alert notification for a task
   * Called when an alert task is created
   */
  async scheduleAlert(task: Task): Promise<void> {
    if (!this.userId) {
      console.error('[AlertService] Not initialized');
      return;
    }

    if (task.type !== 'alert' || !task.alertIntervalMinutes) {
      console.log('[AlertService] Task is not an alert or missing interval');
      return;
    }

    const triggerTime = Date.now() + task.alertIntervalMinutes * 60 * 1000;

    console.log(
      `[AlertService] Scheduling alert for task "${task.title}" at ${new Date(triggerTime).toLocaleString()}`
    );

    try {
      // Create the trigger
      const trigger: TimestampTrigger = {
        type: TriggerType.TIMESTAMP,
        timestamp: triggerTime,
      };

      // Schedule the notification
      await notifee.createTriggerNotification(
        {
          id: `alert_${task.id}`,
          title: `⏰ ${task.title}`,
          body:
            task.description ||
            `Alert: ${task.alertType === 'timeout' ? 'Time is up!' : 'Reminder'}`,
          android: {
            channelId: ALERT_CHANNEL_ID,
            importance: AndroidImportance.HIGH,
            pressAction: {
              id: 'open_task',
              launchActivity: 'default',
            },
            actions: [
              {
                title: task.alertType === 'timeout' ? 'Dismiss' : 'Snooze',
                pressAction: { id: task.alertType === 'timeout' ? 'dismiss' : 'snooze' },
              },
              {
                title: 'Complete',
                pressAction: { id: 'complete' },
              },
            ],
          },
          data: {
            taskId: task.id,
            alertType: task.alertType || 'timeout',
          },
        },
        trigger
      );

      // Update task to mark alert as active
      await database.write(async () => {
        await task.update((record) => {
          record.isAlertActive = true;
        });
      });

      await emitEvent({
        eventType: EventTypes.ALERT_SCHEDULED,
        entityType: 'task',
        entityId: task.id,
        payload: {
          title: task.title,
          alertType: task.alertType,
          triggerTime,
          intervalMinutes: task.alertIntervalMinutes,
        },
        userId: this.userId,
      });

      console.log(`[AlertService] Alert scheduled successfully for task "${task.title}"`);
    } catch (error) {
      console.error('[AlertService] Failed to schedule alert:', error);
    }
  }

  /**
   * Cancel an alert notification
   */
  async cancelAlert(taskId: string): Promise<void> {
    try {
      await notifee.cancelNotification(`alert_${taskId}`);
      console.log(`[AlertService] Cancelled alert for task ${taskId}`);
    } catch (error) {
      console.error('[AlertService] Failed to cancel alert:', error);
    }
  }

  /**
   * Handle alert triggered - called when notification fires
   * For interval type, reschedule the next alert
   */
  async handleAlertTriggered(taskId: string): Promise<void> {
    try {
      const task = await database.get<Task>('tasks').find(taskId);

      if (!task) {
        console.log(`[AlertService] Task ${taskId} not found`);
        return;
      }

      // Check if task is deleted or completed - don't reschedule
      if (task.deletedAt || task.isCompleted || !task.isAlertActive) {
        console.log(
          `[AlertService] Task ${taskId} is deleted/completed/inactive, not rescheduling`
        );
        await this.cancelAlert(taskId);
        return;
      }

      // Use task's userId if service not initialized
      const userId = this.userId || task.userId;
      if (!userId) {
        console.error('[AlertService] No userId available');
        return;
      }

      // Update last triggered time
      await database.write(async () => {
        await task.update((record) => {
          record.lastAlertTriggeredAt = Date.now();
        });
      });

      await emitEvent({
        eventType: EventTypes.ALERT_TRIGGERED,
        entityType: 'task',
        entityId: taskId,
        payload: {
          title: task.title,
          alertType: task.alertType,
          triggeredAt: Date.now(),
        },
        userId: userId,
      });

      // Cancel the notification after handling
      await this.cancelAlert(taskId);

      // If interval type, schedule next alert
      if (task.alertType === 'interval' && task.isAlertActive) {
        console.log(`[AlertService] Rescheduling interval alert for "${task.title}"`);
        await this.scheduleAlert(task);
      } else if (task.alertType === 'timeout') {
        // Timeout alerts complete after one trigger
        await database.write(async () => {
          await task.update((record) => {
            record.isAlertActive = false;
            record.isCompleted = true;
            record.completionPercent = 100;
          });
        });

        await emitEvent({
          eventType: EventTypes.TASK_COMPLETED,
          entityType: 'task',
          entityId: taskId,
          payload: {
            title: task.title,
            completedBy: 'timeout_alert',
          },
          userId: userId,
        });
      }
    } catch (error) {
      console.error('[AlertService] Error handling alert triggered:', error);
    }
  }

  /**
   * Reschedule all active alerts (e.g., on app startup)
   */
  async rescheduleActiveAlerts(): Promise<void> {
    if (!this.userId) return;

    try {
      const alertTasks = await database
        .get<Task>('tasks')
        .query(
          Q.where('type', 'alert'),
          Q.where('is_alert_active', true),
          Q.where('is_completed', false)
        )
        .fetch();

      console.log(`[AlertService] Found ${alertTasks.length} active alerts to reschedule`);

      for (const task of alertTasks) {
        // Check if notification already scheduled
        const notifications = await notifee.getTriggerNotificationIds();
        const alertNotifId = `alert_${task.id}`;

        if (!notifications.includes(alertNotifId)) {
          await this.scheduleAlert(task);
        }
      }
    } catch (error) {
      console.error('[AlertService] Error rescheduling alerts:', error);
    }
  }

  /**
   * Get all pending alert notifications
   */
  async getPendingAlerts(): Promise<string[]> {
    try {
      const notifications = await notifee.getTriggerNotificationIds();
      return notifications.filter((id) => id.startsWith('alert_'));
    } catch (error) {
      console.error('[AlertService] Error getting pending alerts:', error);
      return [];
    }
  }
}

export const alertService = new AlertService();
