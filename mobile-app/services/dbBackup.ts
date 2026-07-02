import * as FileSystem from 'expo-file-system/legacy';
import { exportEventsAsJsonl } from './eventLogger';

/**
 * Local DB backup (Guardrail 2: "back up the local DB before schema changes").
 *
 * WatermelonDB's SQLite file isn't reliably reachable via expo-file-system, so we take a *logical* backup:
 * a JSONL snapshot of the event log — the event-sourced source of truth from which every projection is
 * derived. Runs once per day on app launch (before migrations/maintenance); keeps the last few snapshots.
 */
const BACKUP_DIR = `${FileSystem.documentDirectory}backups/`;
const KEEP = 7;

export async function backupEventLog(userId: string): Promise<void> {
  try {
    const dir = await FileSystem.getInfoAsync(BACKUP_DIR);
    if (!dir.exists) await FileSystem.makeDirectoryAsync(BACKUP_DIR, { intermediates: true });

    const today = new Date().toISOString().slice(0, 10);
    const path = `${BACKUP_DIR}events-${today}.jsonl`;
    if ((await FileSystem.getInfoAsync(path)).exists) return; // already backed up today

    const jsonl = await exportEventsAsJsonl(userId);
    await FileSystem.writeAsStringAsync(path, jsonl);

    // Prune to the last KEEP snapshots.
    const files = (await FileSystem.readDirectoryAsync(BACKUP_DIR))
      .filter((f) => f.startsWith('events-'))
      .sort();
    for (const f of files.slice(0, Math.max(0, files.length - KEEP))) {
      await FileSystem.deleteAsync(`${BACKUP_DIR}${f}`, { idempotent: true });
    }
    console.log(`[dbBackup] snapshot written: ${path}`);
  } catch (e) {
    console.warn('[dbBackup] backup failed (non-fatal)', e);
  }
}
