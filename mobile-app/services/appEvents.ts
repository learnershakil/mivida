/**
 * AppEvents
 *
 * Simple event emitter for app-wide events like notification actions.
 * Used to communicate between notification handlers and UI components.
 */

type EventCallback = (...args: any[]) => void;

class AppEventEmitter {
  private listeners: Map<string, Set<EventCallback>> = new Map();

  /**
   * Subscribe to an event
   */
  on(event: string, callback: EventCallback): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  /**
   * Emit an event
   */
  emit(event: string, ...args: any[]): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((callback) => {
        try {
          callback(...args);
        } catch (error) {
          console.error(`[AppEvents] Error in listener for "${event}":`, error);
        }
      });
    }
  }

  /**
   * Remove all listeners for an event
   */
  removeAllListeners(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}

// App event types
export const AppEvents = {
  SHOW_MOOD_MODAL: 'SHOW_MOOD_MODAL',
  NOTIFICATION_ACTION: 'NOTIFICATION_ACTION',
} as const;

// Global instance
export const appEvents = new AppEventEmitter();
