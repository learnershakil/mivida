/**
 * NotificationService
 *
 * Manages all app notifications with full lifecycle tracking.
 *
 * Notification types:
 * - Informational
 * - Warning
 * - Mandatory-input (cannot dismiss without response)
 * - System-enforced (Focus Lock)
 *
 * All notification events are logged.
 */

import notifee, {
  AndroidImportance,
  EventType,
  TriggerType,
  AndroidCategory,
  AndroidVisibility,
} from '@notifee/react-native';
import { Q } from '@nozbe/watermelondb';
import { database } from '../database';
import NotificationLog from '../database/models/NotificationLog';
import Settings from '../database/models/Settings';
import { emitEvent, EventTypes } from './eventLogger';

// Channel IDs
const CHANNELS = {
  DEFAULT: 'default',
  DEAD_MAN: 'dead_man_switch',
  FOCUS: 'focus_lockdown',
  FINANCE: 'finance_alerts',
  TASKS: 'task_reminders',
} as const;

class NotificationService {
  private userId: string | null = null;

  /**
   * Initialize notification service
   */
  async init(userId: string): Promise<void> {
    this.userId = userId;
    await notifee.requestPermission();
    await this.createChannels();
    this.setupListeners();
  }

  /**
   * Create notification channels
   */
  private async createChannels(): Promise<void> {
    // Get sound setting from database
    let sound = 'default';
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
            sound = settings[0].customNotificationSoundUri;
          } else {
            sound = soundSetting;
          }
        }
      } catch (error) {
        console.log('[NotificationService] Using default sound');
      }
    }

    // Default channel
    await notifee.createChannel({
      id: CHANNELS.DEFAULT,
      name: 'General Notifications',
      importance: AndroidImportance.DEFAULT,
      sound: sound,
    });

    // Dead Man's Switch - highest priority
    await notifee.createChannel({
      id: CHANNELS.DEAD_MAN,
      name: 'Inactivity Alerts',
      importance: AndroidImportance.HIGH,
      sound: sound,
      vibration: true,
    });

    // Focus Lockdown
    await notifee.createChannel({
      id: CHANNELS.FOCUS,
      name: 'Focus Mode',
      importance: AndroidImportance.HIGH,
      sound: sound,
    });

    // Finance alerts
    await notifee.createChannel({
      id: CHANNELS.FINANCE,
      name: 'Finance Alerts',
      importance: AndroidImportance.DEFAULT,
      sound: sound,
    });

    // Task reminders
    await notifee.createChannel({
      id: CHANNELS.TASKS,
      name: 'Task Reminders',
      importance: AndroidImportance.DEFAULT,
      sound: sound,
    });
  }

  /**
   * Refresh notification channels with updated sound settings
   * Call this after sound settings are changed
   */
  async refreshChannels(): Promise<void> {
    await this.createChannels();
    console.log('[NotificationService] Channels refreshed with new sound settings');
  }

  /**
   * Send Dead Man's Switch nudge notification
   */
  async sendDeadManNudge(): Promise<string> {
    const notificationId = await notifee.displayNotification({
      title: '🚨 Are you distracted?',
      body: "You've been inactive for a while. Tap to respond.",
      android: {
        channelId: CHANNELS.DEAD_MAN,
        importance: AndroidImportance.HIGH,
        category: AndroidCategory.ALARM,
        visibility: AndroidVisibility.PUBLIC,
        pressAction: {
          id: 'respond',
          launchActivity: 'default',
        },
        actions: [
          {
            title: "I'm working",
            pressAction: { id: 'working' },
          },
          {
            title: 'Taking a break',
            pressAction: { id: 'break' },
          },
        ],
      },
      ios: {
        sound: 'default',
        critical: true,
      },
    });

    await this.logNotificationEvent('NUDGE_SENT', notificationId);
    return notificationId;
  }

  /**
   * Send a standard notification
   */
  async sendNotification(
    title: string,
    body: string,
    type: 'informational' | 'warning' | 'mandatory' | 'system' = 'informational',
    channelId: string = CHANNELS.DEFAULT,
    requireRemark: boolean = true,
    data?: Record<string, string>
  ): Promise<string> {
    // Create notification log
    const notificationLog = await this.createNotificationLog(title, body, type);

    const notificationId = await notifee.displayNotification({
      id: notificationLog.id,
      title,
      body,
      data: data,
      android: {
        channelId,
        importance:
          type === 'warning' || type === 'mandatory'
            ? AndroidImportance.HIGH
            : AndroidImportance.DEFAULT,
        pressAction: {
          id: 'default',
          launchActivity: 'default',
        },
        // Add actions with text input for remarks
        actions: requireRemark
          ? [
              {
                title: '✓ Complete',
                pressAction: { id: 'complete_with_remark' },
                input: {
                  placeholder: 'Add a remark...',
                  allowFreeFormInput: true,
                },
              },
              {
                title: 'Dismiss',
                pressAction: { id: 'dismiss' },
              },
            ]
          : undefined,
      },
    });

    // Update log with triggered status
    await database.write(async () => {
      await notificationLog.update((record) => {
        record.status = 'triggered';
        record.triggeredAt = Date.now();
      });
    });

    await emitEvent({
      eventType: EventTypes.NOTIFICATION_TRIGGERED,
      entityType: 'notification',
      entityId: notificationLog.id,
      payload: { title, body, type },
      userId: this.userId!,
    });

    return notificationId;
  }

  /**
   * Schedule a notification
   */
  async scheduleNotification(
    title: string,
    body: string,
    timestamp: number,
    type: 'informational' | 'warning' | 'mandatory' | 'system' = 'informational'
  ): Promise<string> {
    // Create notification log
    const notificationLog = await this.createNotificationLog(title, body, type, timestamp);

    await notifee.createTriggerNotification(
      {
        id: notificationLog.id,
        title,
        body,
        android: {
          channelId: CHANNELS.DEFAULT,
          pressAction: {
            id: 'default',
            launchActivity: 'default',
          },
        },
      },
      {
        type: TriggerType.TIMESTAMP,
        timestamp,
      }
    );

    await emitEvent({
      eventType: EventTypes.NOTIFICATION_SCHEDULED,
      entityType: 'notification',
      entityId: notificationLog.id,
      payload: { title, body, scheduledFor: timestamp },
      userId: this.userId!,
    });

    return notificationLog.id;
  }

  /**
   * Create notification log record
   */
  private async createNotificationLog(
    title: string,
    body: string,
    type: 'informational' | 'warning' | 'mandatory' | 'system',
    scheduledFor?: number
  ): Promise<NotificationLog> {
    return await database.write(async () => {
      return await database.get<NotificationLog>('notification_logs').create((record) => {
        record.title = title;
        record.body = body;
        record.type = type;
        record.status = scheduledFor ? 'scheduled' : 'triggered';
        record.scheduledFor = scheduledFor;
        record.triggeredAt = scheduledFor ? undefined : Date.now();
        record.userId = this.userId!;
      });
    });
  }

  /**
   * Log notification event
   */
  private async logNotificationEvent(eventType: string, notificationId: string): Promise<void> {
    if (!this.userId) return;

    await emitEvent({
      eventType: eventType as any,
      entityType: 'notification',
      entityId: notificationId,
      payload: { triggeredAt: Date.now() },
      userId: this.userId,
    });
  }

  /**
   * Setup foreground event listeners
   */
  setupListeners(): () => void {
    return notifee.onForegroundEvent(async ({ type, detail }) => {
      const notificationId = detail.notification?.id;
      if (!notificationId || !this.userId) return;

      // Skip alert notifications - they are handled by alertService
      if (notificationId.startsWith('alert_')) {
        return;
      }

      switch (type) {
        case EventType.DISMISSED:
          await this.handleDismissed(notificationId);
          break;
        case EventType.PRESS:
          await this.handlePressed(notificationId);
          break;
        case EventType.ACTION_PRESS:
          await this.handleActionPress(notificationId, detail.pressAction?.id, detail.input);
          break;
      }
    });
  }

  /**
   * Handle notification dismissed
   */
  private async handleDismissed(notificationId: string): Promise<void> {
    try {
      // Check if notification log exists before trying to update
      let notification: NotificationLog | null = null;
      try {
        notification = await database
          .get<NotificationLog>('notification_logs')
          .find(notificationId);
      } catch (findError) {
        // Record doesn't exist - this can happen for notifications created outside the logging system
        console.log(`[Notification] Log record ${notificationId} not found, skipping update`);
        return;
      }

      if (!notification) return;

      await database.write(async () => {
        await notification!.update((record) => {
          record.status = 'dismissed';
          record.dismissedAt = Date.now();
        });
      });

      await emitEvent({
        eventType: EventTypes.NOTIFICATION_DISMISSED,
        entityType: 'notification',
        entityId: notificationId,
        payload: { dismissedAt: Date.now() },
        userId: this.userId!,
      });
    } catch (error) {
      console.error('[Notification] Failed to handle dismissed:', error);
    }
  }

  /**
   * Handle notification pressed/viewed
   */
  private async handlePressed(notificationId: string): Promise<void> {
    try {
      // Check if notification log exists before trying to update
      let notification: NotificationLog | null = null;
      try {
        notification = await database
          .get<NotificationLog>('notification_logs')
          .find(notificationId);
      } catch (findError) {
        console.log(`[Notification] Log record ${notificationId} not found, skipping update`);
        return;
      }

      if (!notification) return;

      await database.write(async () => {
        await notification!.update((record) => {
          record.status = 'viewed';
          record.viewedAt = Date.now();
        });
      });

      await emitEvent({
        eventType: EventTypes.NOTIFICATION_VIEWED,
        entityType: 'notification',
        entityId: notificationId,
        payload: { viewedAt: Date.now() },
        userId: this.userId!,
      });
    } catch (error) {
      console.error('[Notification] Failed to handle pressed:', error);
    }
  }

  /**
   * Handle action button press
   */
  private async handleActionPress(
    notificationId: string,
    actionId?: string,
    input?: string
  ): Promise<void> {
    try {
      // Check if notification log exists before trying to update
      let notification: NotificationLog | null = null;
      try {
        notification = await database
          .get<NotificationLog>('notification_logs')
          .find(notificationId);
      } catch (findError) {
        console.log(`[Notification] Log record ${notificationId} not found, skipping update`);
        return;
      }

      if (!notification) return;

      const response = input || actionId || '';
      const remark = actionId === 'complete_with_remark' ? input || 'No remark provided' : '';

      await database.write(async () => {
        await notification!.update((record) => {
          record.status = 'responded';
          record.respondedAt = Date.now();
          record.userResponse = response;
        });
      });

      // Log the action with remark to event log
      await emitEvent({
        eventType: EventTypes.NOTIFICATION_RESPONDED,
        entityType: 'notification',
        entityId: notificationId,
        payload: {
          response,
          actionId,
          remark,
          notificationTitle: notification.title,
          respondedAt: Date.now(),
        },
        userId: this.userId!,
      });

      // Cancel the notification after response
      await notifee.cancelNotification(notificationId);
    } catch (error) {
      console.error('[Notification] Failed to handle action:', error);
    }
  }

  /**
   * Cancel a scheduled notification
   */
  async cancelNotification(notificationId: string): Promise<void> {
    await notifee.cancelNotification(notificationId);
  }

  /**
   * Cancel all notifications
   */
  async cancelAllNotifications(): Promise<void> {
    await notifee.cancelAllNotifications();
  }
}

export const notificationService = new NotificationService();
