import { synchronize } from '@nozbe/watermelondb/sync';
import { database } from '../database';

const SYNC_API_URL = 'http://10.67.217.166:3000/api/sync'; // Adjust for production
const HTTP_KEY = 'hardcoded-dev-key'; // This should be securely stored

export class SyncService {
  static async sync() {
    try {
      console.log('[SyncService] Triggering WakaTime sync...');
      try {
        await fetch('http://10.67.217.166:3000/api/wakatime/sync', {
          method: 'POST',
          headers: { 'x-http-key': HTTP_KEY },
        });
      } catch (err) {
        console.warn('[SyncService] WakaTime sync trigger failed', err);
      }

      console.log('[SyncService] Starting synchronization...');
      await synchronize({
        database,
        pullChanges: async ({ lastPulledAt, schemaVersion, migration }) => {
          console.log('[SyncService] Pulling changes...');
          const response = await fetch(`${SYNC_API_URL}?lastPulledAt=${lastPulledAt || 0}`, {
            method: 'GET',
            headers: {
              'x-http-key': HTTP_KEY,
            },
          });
          if (!response.ok) {
            throw new Error(`Sync pull failed: ${response.statusText}`);
          }
          const { changes, timestamp } = await response.json();
          return { changes, timestamp };
        },
        pushChanges: async ({ changes, lastPulledAt }) => {
          console.log('[SyncService] Pushing changes...', changes);
          const response = await fetch(SYNC_API_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-http-key': HTTP_KEY,
            },
            body: JSON.stringify({ changes, lastPulledAt }),
          });
          if (!response.ok) {
            throw new Error(`Sync push failed: ${response.statusText}`);
          }
        },
        migrationsEnabledAtVersion: 4,
      });
      console.log('[SyncService] Synchronization complete.');
      return true;
    } catch (error) {
      console.error('[SyncService] Synchronization error:', error);
      throw error;
    }
  }
}
