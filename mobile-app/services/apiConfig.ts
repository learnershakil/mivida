import * as SecureStore from 'expo-secure-store';

// Shared backend config for mobile→server calls. See mobile-app/.env.example.
export const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.31.213:3000';

const HTTP_KEY_STORE = 'mobile_http_key';

/** The x-http-key from secure store (preferred) or the build-time public env fallback. */
export async function getHttpKey(): Promise<string> {
  try {
    const stored = await SecureStore.getItemAsync(HTTP_KEY_STORE);
    if (stored) return stored;
  } catch {
    // secure store unavailable (e.g. Expo Go) — fall through to env
  }
  return process.env.EXPO_PUBLIC_HTTP_KEY || '';
}

export async function setHttpKey(key: string): Promise<void> {
  await SecureStore.setItemAsync(HTTP_KEY_STORE, key);
}
