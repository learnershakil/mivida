import { DeviceEventEmitter } from 'react-native';

export interface UIAlertButton {
  text?: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export interface UIAlertOptions {
  cancelable?: boolean;
  onDismiss?: () => void;
}

class UIAlertService {
  public alert(title: string, message?: string, buttons?: UIAlertButton[], options?: UIAlertOptions) {
    DeviceEventEmitter.emit('SHOW_CUSTOM_UI_ALERT', { title, message, buttons, options });
  }
}

export const uiAlertService = new UIAlertService();
