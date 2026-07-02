import { NativeModules } from 'react-native';

// Bridge to the native LockdownOverlay foreground-service (system overlay). Best-effort; the module is
// only present in a dev/native build (not Expo Go).
const { LockdownOverlay } = NativeModules as {
  LockdownOverlay?: {
    canDrawOverlays(): Promise<boolean>;
    requestOverlayPermission(): Promise<boolean>;
    startLockdown(durationMs: number, strictness: string): Promise<boolean>;
    stopLockdown(): Promise<boolean>;
  };
};

export const lockdownOverlay = {
  isAvailable: (): boolean => !!LockdownOverlay,
  canDrawOverlays: (): Promise<boolean> => LockdownOverlay?.canDrawOverlays() ?? Promise.resolve(false),
  requestPermission: (): Promise<boolean> =>
    LockdownOverlay?.requestOverlayPermission() ?? Promise.resolve(false),
  start: async (durationMs: number, strictness: string): Promise<boolean> => {
    if (!LockdownOverlay) return false;
    try {
      return await LockdownOverlay.startLockdown(durationMs, strictness);
    } catch (e) {
      console.warn('[lockdownOverlay] start failed (permission?)', e);
      return false;
    }
  },
  stop: (): Promise<boolean> => LockdownOverlay?.stopLockdown() ?? Promise.resolve(false),
};
