import { synchronize } from '@nozbe/watermelondb/sync';
import * as SecureStore from 'expo-secure-store';
import { database } from '../database';

// Config comes from env / secure-store — no more hardcoded LAN IP or dev key (AUDIT §3.2, Guardrail 4).
// EXPO_PUBLIC_API_URL example: http://10.0.2.2:3000 (Android emulator) or your LAN IP for a device.
const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:3000';
const SYNC_URL = `${API_BASE}/api/m/sync`;
const WAKATIME_URL = `${API_BASE}/api/wakatime/sync`;
const HTTP_KEY_STORE = 'mobile_http_key';

/** Resolve the x-http-key from secure store, falling back to a build-time public env for dev. */
async function getHttpKey(): Promise<string> {
  try {
    const stored = await SecureStore.getItemAsync(HTTP_KEY_STORE);
    if (stored) return stored;
  } catch {
    // secure store unavailable (e.g. Expo Go) — fall through to env
  }
  return process.env.EXPO_PUBLIC_HTTP_KEY || '';
}

export class SyncService {
  // Debounce duplicate rapid long-presses: concurrent calls share the in-flight run.
  private static inFlight: Promise<boolean> | null = null;

  static async setHttpKey(key: string): Promise<void> {
    await SecureStore.setItemAsync(HTTP_KEY_STORE, key);
  }

  static async sync(): Promise<boolean> {
    if (this.inFlight) return this.inFlight;
    this.inFlight = this._run().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  private static async _run(): Promise<boolean> {
    const httpKey = await getHttpKey();
    if (!httpKey) {
      throw new Error('No sync key configured (set EXPO_PUBLIC_HTTP_KEY or store mobile_http_key).');
    }
    const headers = { 'x-http-key': httpKey };

    // Best-effort: refresh WakaTime server-side before the round-trip.
    try {
      await fetch(WAKATIME_URL, { method: 'POST', headers });
    } catch (err) {
      console.warn('[SyncService] WakaTime sync trigger failed', err);
    }

    await synchronize({
      database,
      pullChanges: async ({ lastPulledAt }) => {
        const response = await fetch(`${SYNC_URL}?lastPulledAt=${lastPulledAt || 0}`, {
          method: 'GET',
          headers,
        });
        if (!response.ok) throw new Error(`Sync pull failed: ${response.status} ${response.statusText}`);
        const { changes, timestamp } = await response.json();
        return { changes, timestamp };
      },
      pushChanges: async ({ changes, lastPulledAt }) => {
        const response = await fetch(SYNC_URL, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ changes, lastPulledAt }),
        });
        if (!response.ok) throw new Error(`Sync push failed: ${response.status} ${response.statusText}`);
      },
      migrationsEnabledAtVersion: 4,
    });
    return true;
  }
}
