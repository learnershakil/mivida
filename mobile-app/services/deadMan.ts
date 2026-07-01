/**
 * Dead Man's Switch Service
 *
 * Anti-distraction core - detects inactivity while user is Awake.
 *
 * Trigger conditions:
 * - User state = Awake
 * - No interaction for > configurable threshold (default 3h)
 *
 * Features:
 * - Configurable inactivity threshold
 * - High-priority notification with mandatory response
 * - Cannot dismiss without input
 * - All events logged for distraction pattern analysis
 */

import { AppState, AppStateStatus } from 'react-native';
import { database } from '../database';
import User from '../database/models/User';
import Settings from '../database/models/Settings';
import { emitEvent, EventTypes } from './eventLogger';
import { notificationService } from './notifications';

type NudgeStatus = {
  isNudgeActive: boolean;
  timeSinceLastInteraction: number;
  thresholdMs: number;
};

type NudgeCallback = (status: NudgeStatus) => void;
type NudgePromptCallback = (promptId: string) => void;

const NUDGE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes to respond

class DeadManService {
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private nudgeTimeout: ReturnType<typeof setTimeout> | null = null;
  private isRunning = false;
  private userId: string | null = null;
  private currentNudgeId: string | null = null;
  private subscribers: Set<NudgeCallback> = new Set();
  private nudgePromptSubscribers: Set<NudgePromptCallback> = new Set();
  private appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;

  // Default threshold (can be overridden by settings)
  private thresholdMs = 3 * 60 * 60 * 1000; // 3 hours

  /**
   * Start monitoring for inactivity
   */
  async start(userId: string): Promise<void> {
    if (this.isRunning) return;

    this.userId = userId;
    this.isRunning = true;

    // Load threshold from settings
    await this.loadThreshold();

    // Check every minute
    this.checkInterval = setInterval(() => this.checkInactivity(), 60 * 1000);

    // Also check immediately
    await this.checkInactivity();

    // Listen for app state changes to record interactions
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);

    console.log(
      '[DeadMan] Started monitoring with threshold:',
      this.thresholdMs / 60000,
      'minutes'
    );
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    this.isRunning = false;
    this.userId = null;
    this.currentNudgeId = null;

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    if (this.nudgeTimeout) {
      clearTimeout(this.nudgeTimeout);
      this.nudgeTimeout = null;
    }

    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }

    console.log('[DeadMan] Stopped monitoring');
  }

  /**
   * Load threshold from user settings
   */
  private async loadThreshold(): Promise<void> {
    if (!this.userId) return;

    try {
      const settingsCollection = database.get<Settings>('settings');
      const settings = await settingsCollection.query().fetch();
      const userSettings = settings.find((s) => s.userId === this.userId);

      if (userSettings && userSettings.deadManEnabled) {
        this.thresholdMs = userSettings.deadManThresholdMinutes * 60 * 1000;
      }
    } catch (error) {
      console.error('[DeadMan] Failed to load settings:', error);
    }
  }

  /**
   * Handle app state changes
   */
  private handleAppStateChange = async (state: AppStateStatus) => {
    if (state === 'active' && this.userId) {
      // User interacted with app - update last interaction
      await this.recordInteraction();
    }
  };

  /**
   * Record a user interaction
   */
  async recordInteraction(): Promise<void> {
    if (!this.userId) return;

    try {
      const usersCollection = database.get<User>('users');
      const users = await usersCollection.query().fetch();
      const user = users.find((u) => u.id === this.userId);

      if (user) {
        await database.write(async () => {
          await user.update((record) => {
            record.lastInteraction = Date.now();
          });
        });
      }

      // If there's an active nudge, this counts as a response
      if (this.currentNudgeId) {
        // Clear the nudge timeout
        if (this.nudgeTimeout) {
          clearTimeout(this.nudgeTimeout);
          this.nudgeTimeout = null;
        }
      }

      this.notifySubscribers();
    } catch (error) {
      console.error('[DeadMan] Failed to record interaction:', error);
    }
  }

  /**
   * Check for inactivity
   */
  private async checkInactivity(): Promise<void> {
    if (!this.userId || !this.isRunning) return;

    try {
      const usersCollection = database.get<User>('users');
      const users = await usersCollection.query().fetch();
      const user = users.find((u) => u.id === this.userId);

      if (!user) return;

      // Only trigger if user is Awake
      if (!user.isAwake) {
        this.notifySubscribers();
        return;
      }

      const timeSinceLastInteraction = Date.now() - user.lastInteraction;

      // Check if threshold exceeded
      if (timeSinceLastInteraction >= this.thresholdMs && !this.currentNudgeId) {
        await this.triggerNudge(user);
      }

      this.notifySubscribers();
    } catch (error) {
      console.error('[DeadMan] Failed to check inactivity:', error);
    }
  }

  /**
   * Trigger a nudge notification
   */
  private async triggerNudge(user: User): Promise<void> {
    this.currentNudgeId = `nudge_${Date.now()}`;

    // Emit inactivity detected event
    await emitEvent({
      eventType: EventTypes.INACTIVITY_DETECTED,
      entityType: 'user',
      entityId: user.id,
      payload: {
        nudgeId: this.currentNudgeId,
        inactivityDurationMs: Date.now() - user.lastInteraction,
        thresholdMs: this.thresholdMs,
        detectedAt: Date.now(),
      },
      userId: user.id,
    });

    // Emit nudge sent event
    await emitEvent({
      eventType: EventTypes.NUDGE_SENT,
      entityType: 'user',
      entityId: user.id,
      payload: {
        nudgeId: this.currentNudgeId,
        sentAt: Date.now(),
      },
      userId: user.id,
    });

    // Notify prompt subscribers to show the nudge UI
    this.nudgePromptSubscribers.forEach((cb) => cb(this.currentNudgeId!));

    // Set timeout for ignored nudge
    this.nudgeTimeout = setTimeout(() => this.handleNudgeIgnored(user), NUDGE_TIMEOUT_MS);

    // Also send a system notification
    await notificationService.sendDeadManNudge();
  }

  /**
   * Handle nudge being ignored (timeout)
   */
  private async handleNudgeIgnored(user: User): Promise<void> {
    if (!this.currentNudgeId) return;

    await emitEvent({
      eventType: EventTypes.NUDGE_IGNORED,
      entityType: 'user',
      entityId: user.id,
      payload: {
        nudgeId: this.currentNudgeId,
        ignoredAt: Date.now(),
        timeoutMs: NUDGE_TIMEOUT_MS,
      },
      userId: user.id,
    });

    this.currentNudgeId = null;
    this.nudgeTimeout = null;
    this.notifySubscribers();

    // Trigger another nudge after a delay
    setTimeout(() => this.checkInactivity(), 60 * 1000);
  }

  /**
   * Respond to a nudge
   */
  async respondToNudge(response: string, userId: string): Promise<void> {
    if (!this.currentNudgeId) return;

    await emitEvent({
      eventType: EventTypes.NUDGE_RESPONDED,
      entityType: 'user',
      entityId: userId,
      payload: {
        nudgeId: this.currentNudgeId,
        response,
        respondedAt: Date.now(),
      },
      userId,
    });

    // Clear the timeout
    if (this.nudgeTimeout) {
      clearTimeout(this.nudgeTimeout);
      this.nudgeTimeout = null;
    }

    this.currentNudgeId = null;

    // Record interaction
    await this.recordInteraction();

    this.notifySubscribers();
  }

  /**
   * Get current status
   */
  async getStatus(): Promise<NudgeStatus> {
    if (!this.userId) {
      return {
        isNudgeActive: false,
        timeSinceLastInteraction: 0,
        thresholdMs: this.thresholdMs,
      };
    }

    try {
      const usersCollection = database.get<User>('users');
      const users = await usersCollection.query().fetch();
      const user = users.find((u) => u.id === this.userId);

      return {
        isNudgeActive: this.currentNudgeId !== null,
        timeSinceLastInteraction: user ? Date.now() - user.lastInteraction : 0,
        thresholdMs: this.thresholdMs,
      };
    } catch {
      return {
        isNudgeActive: false,
        timeSinceLastInteraction: 0,
        thresholdMs: this.thresholdMs,
      };
    }
  }

  /**
   * Subscribe to status updates
   */
  subscribe(callback: NudgeCallback): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  /**
   * Subscribe to nudge prompts (for UI)
   */
  subscribeToNudgePrompt(callback: NudgePromptCallback): () => void {
    this.nudgePromptSubscribers.add(callback);
    return () => this.nudgePromptSubscribers.delete(callback);
  }

  /**
   * Check if nudge is currently active
   */
  isNudgeActive(): boolean {
    return this.currentNudgeId !== null;
  }

  /**
   * Notify all subscribers
   */
  private async notifySubscribers(): Promise<void> {
    const status = await this.getStatus();
    this.subscribers.forEach((cb) => cb(status));
  }

  /**
   * Update threshold (when settings change)
   */
  updateThreshold(thresholdMinutes: number): void {
    this.thresholdMs = thresholdMinutes * 60 * 1000;
    console.log('[DeadMan] Threshold updated to:', thresholdMinutes, 'minutes');
  }
}

export const deadManService = new DeadManService();
