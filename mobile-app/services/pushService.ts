import * as Notifications from 'expo-notifications';
import { API_BASE, getHttpKey } from './apiConfig';

/**
 * Register this device's FCM token with the backend so the server (cron) can send mood-check pushes.
 * Requires google-services.json + the app package matching the Firebase Android app.
 */
export async function registerPushToken(): Promise<string | null> {
  try {
    // Notification permission governs DISPLAY (Android 13+ runtime prompt); the FCM token is available
    // regardless, so request permission best-effort but don't gate token retrieval on it.
    Notifications.getPermissionsAsync()
      .then((p) => {
        if (p.status !== 'granted') return Notifications.requestPermissionsAsync();
      })
      .catch(() => {});

    const deviceToken = await Notifications.getDevicePushTokenAsync(); // Android → raw FCM token
    const token = typeof deviceToken.data === 'string' ? deviceToken.data : String(deviceToken.data);
    console.log('[push] FCM device token:', token);

    const httpKey = await getHttpKey();
    if (httpKey && token) {
      await fetch(`${API_BASE}/api/m/register-push`, {
        method: 'POST',
        headers: { 'x-http-key': httpKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      }).catch((e) => console.warn('[push] register failed', e));
    }
    return token;
  } catch (e) {
    console.warn('[push] registerPushToken failed', e);
    return null;
  }
}
