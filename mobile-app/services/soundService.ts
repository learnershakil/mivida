/**
 * SoundService
 *
 * Manages notification sounds and provides utilities for playing/previewing sounds.
 *
 * Available sounds are stored in android/app/src/main/res/raw/
 * Sound names must be lowercase, no spaces, only letters/numbers/underscores.
 * Also supports custom sounds from user's device storage.
 */

import notifee, { AndroidImportance } from '@notifee/react-native';
import { database } from '../database';
import Settings from '../database/models/Settings';
import { Q } from '@nozbe/watermelondb';

// Available notification sounds
// These correspond to files in android/app/src/main/res/raw/
// For now, we'll use system sounds until custom sounds are added
export const NOTIFICATION_SOUNDS = {
  default: {
    id: 'default',
    name: 'Default',
    description: 'System default notification sound',
    file: 'default', // Uses system default
  },
  chime: {
    id: 'chime',
    name: 'Chime',
    description: 'Pleasant chime sound',
    file: 'chime', // res/raw/chime.mp3
  },
  bell: {
    id: 'bell',
    name: 'Bell',
    description: 'Classic bell ring',
    file: 'bell', // res/raw/bell.mp3
  },
  alert: {
    id: 'alert',
    name: 'Alert',
    description: 'Urgent alert tone',
    file: 'alert', // res/raw/alert.mp3
  },
  gentle: {
    id: 'gentle',
    name: 'Gentle',
    description: 'Soft, calming notification',
    file: 'gentle', // res/raw/gentle.mp3
  },
  custom: {
    id: 'custom',
    name: 'Custom',
    description: 'Custom sound from your device',
    file: 'custom',
  },
} as const;

export type NotificationSoundId = keyof typeof NOTIFICATION_SOUNDS;

class SoundService {
  private userId: string | null = null;
  private currentSound: NotificationSoundId = 'default';
  private customSoundUri: string | null = null;
  private customSoundName: string | null = null;

  /**
   * Initialize sound service
   */
  async init(userId: string): Promise<void> {
    this.userId = userId;
    await this.loadCurrentSound();
    console.log('[SoundService] Initialized with sound:', this.currentSound);
  }

  /**
   * Load current sound setting from database
   */
  async loadCurrentSound(): Promise<void> {
    if (!this.userId) return;

    try {
      const settings = await database
        .get<Settings>('settings')
        .query(Q.where('user_id', this.userId))
        .fetch();

      if (settings.length > 0) {
        const soundSetting = settings[0].notificationSound as NotificationSoundId;
        if (soundSetting && NOTIFICATION_SOUNDS[soundSetting]) {
          this.currentSound = soundSetting;
        }
        // Load custom sound info
        this.customSoundUri = settings[0].customNotificationSoundUri || null;
        this.customSoundName = settings[0].customNotificationSoundName || null;
      }
    } catch (error) {
      console.error('[SoundService] Failed to load sound setting:', error);
    }
  }

  /**
   * Get custom sound URI
   */
  getCustomSoundUri(): string | null {
    return this.customSoundUri;
  }

  /**
   * Get custom sound name
   */
  getCustomSoundName(): string | null {
    return this.customSoundName;
  }

  /**
   * Set custom sound from device storage
   */
  async setCustomSound(uri: string, name: string): Promise<void> {
    if (!this.userId) return;

    try {
      const settings = await database
        .get<Settings>('settings')
        .query(Q.where('user_id', this.userId))
        .fetch();

      if (settings.length > 0) {
        await database.write(async () => {
          await settings[0].update((record) => {
            record.notificationSound = 'custom';
            record.customNotificationSoundUri = uri;
            record.customNotificationSoundName = name;
          });
        });
        this.currentSound = 'custom';
        this.customSoundUri = uri;
        this.customSoundName = name;

        // Recreate notification channels with new sound
        await this.updateNotificationChannels();

        console.log('[SoundService] Custom sound set:', name, uri);
      }
    } catch (error) {
      console.error('[SoundService] Failed to set custom sound:', error);
    }
  }

  /**
   * Get current notification sound
   */
  getCurrentSound(): NotificationSoundId {
    return this.currentSound;
  }

  /**
   * Get sound configuration for notifee channel
   * Returns the sound file name or 'default' for system sound
   * For custom sounds, returns the URI
   */
  getSoundForChannel(): string {
    if (this.currentSound === 'default') {
      return 'default';
    }
    if (this.currentSound === 'custom' && this.customSoundUri) {
      // notifee can use content:// URIs directly for custom sounds
      return this.customSoundUri;
    }
    return NOTIFICATION_SOUNDS[this.currentSound].file;
  }

  /**
   * Update notification sound setting
   */
  async setSound(soundId: NotificationSoundId): Promise<void> {
    if (!this.userId) return;

    try {
      const settings = await database
        .get<Settings>('settings')
        .query(Q.where('user_id', this.userId))
        .fetch();

      if (settings.length > 0) {
        await database.write(async () => {
          await settings[0].update((record) => {
            record.notificationSound = soundId;
          });
        });
        this.currentSound = soundId;

        // Recreate notification channels with new sound
        await this.updateNotificationChannels();

        console.log('[SoundService] Sound updated to:', soundId);
      }
    } catch (error) {
      console.error('[SoundService] Failed to update sound:', error);
    }
  }

  /**
   * Update all notification channels with the new sound
   */
  private async updateNotificationChannels(): Promise<void> {
    const sound = this.getSoundForChannel();

    // Update alert channel
    await notifee.createChannel({
      id: 'alert_tasks',
      name: 'Alert Tasks',
      importance: AndroidImportance.HIGH,
      sound: sound,
      vibration: true,
    });

    // Update task reminders channel
    await notifee.createChannel({
      id: 'task_reminders',
      name: 'Task Reminders',
      importance: AndroidImportance.DEFAULT,
      sound: sound,
    });

    // Update dead man switch channel
    await notifee.createChannel({
      id: 'dead_man_switch',
      name: 'Inactivity Alerts',
      importance: AndroidImportance.HIGH,
      sound: sound,
      vibration: true,
    });

    console.log('[SoundService] Notification channels updated with sound:', sound);
  }

  /**
   * Preview a notification sound
   */
  async previewSound(soundId: NotificationSoundId): Promise<void> {
    let sound: string;
    let displayName: string;

    if (soundId === 'default') {
      sound = 'default';
      displayName = 'Default';
    } else if (soundId === 'custom' && this.customSoundUri) {
      sound = this.customSoundUri;
      displayName = this.customSoundName || 'Custom';
    } else {
      sound = NOTIFICATION_SOUNDS[soundId].file;
      displayName = NOTIFICATION_SOUNDS[soundId].name;
    }

    // Create a temporary channel for preview
    const previewChannelId = `preview_${soundId}_${Date.now()}`;

    await notifee.createChannel({
      id: previewChannelId,
      name: 'Sound Preview',
      importance: AndroidImportance.HIGH,
      sound: sound,
    });

    // Display a quick notification to play the sound
    const notificationId = await notifee.displayNotification({
      title: '🔔 Sound Preview',
      body: `Playing: ${displayName}`,
      android: {
        channelId: previewChannelId,
        importance: AndroidImportance.HIGH,
        autoCancel: true,
        timeoutAfter: 3000, // Auto dismiss after 3 seconds
      },
    });

    // Cancel the notification after sound plays
    setTimeout(async () => {
      await notifee.cancelNotification(notificationId);
      await notifee.deleteChannel(previewChannelId);
    }, 3000);
  }

  /**
   * Preview custom sound by URI
   */
  async previewCustomSound(uri: string, name: string): Promise<void> {
    const previewChannelId = `preview_custom_${Date.now()}`;

    await notifee.createChannel({
      id: previewChannelId,
      name: 'Custom Sound Preview',
      importance: AndroidImportance.HIGH,
      sound: uri,
    });

    // Display a quick notification to play the sound
    const notificationId = await notifee.displayNotification({
      title: '🔔 Custom Sound Preview',
      body: `Playing: ${name}`,
      android: {
        channelId: previewChannelId,
        importance: AndroidImportance.HIGH,
        autoCancel: true,
        timeoutAfter: 3000,
      },
    });

    // Cancel the notification after sound plays
    setTimeout(async () => {
      await notifee.cancelNotification(notificationId);
      await notifee.deleteChannel(previewChannelId);
    }, 3000);
  }

  /**
   * Get list of available sounds for UI
   */
  getAvailableSounds(): {
    id: NotificationSoundId;
    name: string;
    description: string;
  }[] {
    return Object.values(NOTIFICATION_SOUNDS)
      .filter((sound) => sound.id !== 'custom') // Exclude custom from regular list
      .map((sound) => ({
        id: sound.id as NotificationSoundId,
        name: sound.name,
        description: sound.description,
      }));
  }

  /**
   * Get list of available sounds including custom for UI
   */
  getAvailableSoundsWithCustom(): {
    id: NotificationSoundId;
    name: string;
    description: string;
    isCustom?: boolean;
  }[] {
    const sounds = this.getAvailableSounds();

    // Add custom sound option
    sounds.push({
      id: 'custom' as NotificationSoundId,
      name: this.customSoundName ? `Custom: ${this.customSoundName}` : 'Custom (Select file)',
      description: this.customSoundUri
        ? 'Your custom sound file'
        : 'Select an MP3 file from your device',
      isCustom: true,
    });

    return sounds;
  }
}

export const soundService = new SoundService();
