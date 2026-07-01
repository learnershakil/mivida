import { NativeModules } from 'react-native';

const { DeviceAdminModule } = NativeModules;

export class LockTaskService {
  static async enableExtremeFocus(): Promise<boolean> {
    if (!DeviceAdminModule) {
      console.warn('DeviceAdminModule is not linked.');
      return false;
    }
    try {
      await DeviceAdminModule.enableLockTask();
      return true;
    } catch (e) {
      console.error('Failed to enable extreme focus lockdown:', e);
      return false;
    }
  }

  static async disableExtremeFocus(): Promise<boolean> {
    if (!DeviceAdminModule) {
      return false;
    }
    try {
      await DeviceAdminModule.disableLockTask();
      return true;
    } catch (e) {
      console.error('Failed to disable extreme focus lockdown:', e);
      return false;
    }
  }
}
