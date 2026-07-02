import { NativeModules } from 'react-native';

// Bridge to the native FocusSchedule module (exact-alarm scheduled focus that survives app-close/reboot).
const { FocusSchedule } = NativeModules as {
  FocusSchedule?: {
    schedule(atMs: number, durationMs: number, strictness: string): Promise<boolean>;
    cancel(): Promise<boolean>;
  };
};

export const focusSchedule = {
  isAvailable: (): boolean => !!FocusSchedule,
  /** Schedule a focus session to auto-start at `atMs` for `durationMinutes`. */
  schedule: async (atMs: number, durationMinutes: number, strictness = 'normal'): Promise<boolean> => {
    if (!FocusSchedule) return false;
    try {
      return await FocusSchedule.schedule(atMs, durationMinutes * 60_000, strictness);
    } catch (e) {
      console.warn('[focusSchedule] schedule failed', e);
      return false;
    }
  },
  cancel: (): Promise<boolean> => FocusSchedule?.cancel() ?? Promise.resolve(false),
};
