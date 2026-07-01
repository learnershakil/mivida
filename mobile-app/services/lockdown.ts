/**
 * LockdownService
 *
 * Manages Hard Focus Lockdown (Discipline Mode).
 * Features:
 * - Duration-based lockdown (15m, 30m, 1h, custom)
 * - Full-screen overlay with countdown
 * - Break attempt detection and logging
 * - Emergency call access
 *
 * All actions are logged as events.
 */

import { AppState, AppStateStatus, Linking } from 'react-native';
import { emitEvent, EventTypes } from './eventLogger';

type LockdownStatus = {
  isActive: boolean;
  remainingMs: number;
  totalDurationMs: number;
  breakAttempts: number;
};

type StatusCallback = (status: LockdownStatus) => void;

class LockdownService {
  private isActive = false;
  private endTime: number | null = null;
  private totalDuration: number = 0;
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private subscribers: Set<StatusCallback> = new Set();
  private breakAttempts: number = 0;
  private userId: string | null = null;
  private lockdownId: string | null = null;
  private appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;

  /**
   * Start a focus lockdown session
   */
  async startLockdown(durationMinutes: number, userId: string): Promise<void> {
    if (this.isActive) {
      console.warn('[Lockdown] Already active, ignoring start request');
      return;
    }

    this.isActive = true;
    this.userId = userId;
    this.totalDuration = durationMinutes * 60 * 1000;
    this.endTime = Date.now() + this.totalDuration;
    this.breakAttempts = 0;
    this.lockdownId = `lockdown_${Date.now()}`;

    // Emit start event
    await emitEvent({
      eventType: EventTypes.FOCUS_LOCK_STARTED,
      entityType: 'user',
      entityId: userId,
      payload: {
        lockdownId: this.lockdownId,
        durationMinutes,
        startTime: Date.now(),
        endTime: this.endTime,
      },
      userId,
    });

    // Start monitoring app state for break attempts
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);

    // Start the countdown timer
    this.checkInterval = setInterval(() => this.tick(), 1000);
    this.tick();
  }

  /**
   * Force stop lockdown (emergency or admin override)
   */
  async forceStopLockdown(reason: string = 'user_requested'): Promise<void> {
    if (!this.isActive || !this.userId) return;

    await emitEvent({
      eventType: EventTypes.FOCUS_FORCE_EXIT,
      entityType: 'user',
      entityId: this.userId,
      payload: {
        lockdownId: this.lockdownId,
        reason,
        remainingMs: this.endTime ? Math.max(0, this.endTime - Date.now()) : 0,
        breakAttempts: this.breakAttempts,
        exitTime: Date.now(),
      },
      userId: this.userId,
    });

    this.cleanup();
  }

  /**
   * Handle app state changes to detect break attempts
   */
  private handleAppStateChange = async (state: AppStateStatus) => {
    if (!this.isActive || !this.userId) return;

    if (state === 'background' || state === 'inactive') {
      this.breakAttempts++;

      await emitEvent({
        eventType: EventTypes.FOCUS_BREAK_ATTEMPTED,
        entityType: 'user',
        entityId: this.userId,
        payload: {
          lockdownId: this.lockdownId,
          attemptNumber: this.breakAttempts,
          remainingMs: this.endTime ? Math.max(0, this.endTime - Date.now()) : 0,
          attemptTime: Date.now(),
        },
        userId: this.userId,
      });

      this.notifySubscribers();
    }
  };

  /**
   * Tick - called every second during lockdown
   */
  private async tick(): Promise<void> {
    if (!this.endTime) return;

    const remaining = Math.max(0, this.endTime - Date.now());

    if (remaining <= 0) {
      await this.endLockdown();
    } else {
      this.notifySubscribers();
    }
  }

  /**
   * End lockdown naturally (timer completed)
   */
  private async endLockdown(): Promise<void> {
    if (!this.userId) return;

    await emitEvent({
      eventType: EventTypes.FOCUS_LOCK_ENDED,
      entityType: 'user',
      entityId: this.userId,
      payload: {
        lockdownId: this.lockdownId,
        completedFully: true,
        totalDurationMs: this.totalDuration,
        breakAttempts: this.breakAttempts,
        endTime: Date.now(),
      },
      userId: this.userId,
    });

    this.cleanup();
  }

  /**
   * Cleanup resources after lockdown ends
   */
  private cleanup(): void {
    this.isActive = false;
    this.endTime = null;
    this.totalDuration = 0;
    this.breakAttempts = 0;
    this.lockdownId = null;
    this.userId = null;

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }

    this.notifySubscribers();
  }

  /**
   * Notify all subscribers of status change
   */
  private notifySubscribers(): void {
    const status = this.getStatus();
    this.subscribers.forEach((callback) => callback(status));
  }

  /**
   * Get current lockdown status
   */
  getStatus(): LockdownStatus {
    return {
      isActive: this.isActive,
      remainingMs: this.endTime ? Math.max(0, this.endTime - Date.now()) : 0,
      totalDurationMs: this.totalDuration,
      breakAttempts: this.breakAttempts,
    };
  }

  /**
   * Subscribe to status updates
   */
  subscribe(callback: StatusCallback): () => void {
    this.subscribers.add(callback);
    // Emit current status immediately
    callback(this.getStatus());

    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Open phone dialer for emergency calls
   */
  async openEmergencyDialer(): Promise<void> {
    try {
      await Linking.openURL('tel:');
    } catch (error) {
      console.error('[Lockdown] Failed to open dialer:', error);
    }
  }
}

export const lockdownService = new LockdownService();
