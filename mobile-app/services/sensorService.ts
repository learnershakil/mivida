import { Pedometer } from 'expo-sensors';
import { Q } from '@nozbe/watermelondb';
import { database } from '../database';
import SensorStat from '../database/models/SensorStat';

/**
 * Pedometer step tracking → daily sensor_stats rows (synced to the server, which the fatigue cron reads).
 * getStepCountAsync historical queries are limited on Android, so we also watch live and accumulate.
 */
let subscription: { remove: () => void } | null = null;

function todayBucket(): number {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Upsert today's step count into sensor_stats. */
export async function recordSteps(steps: number, userId: string): Promise<void> {
  const date = todayBucket();
  const existing = await database
    .get<SensorStat>('sensor_stats')
    .query(Q.where('user_id', userId), Q.where('date', date))
    .fetch();
  await database.write(async () => {
    if (existing.length > 0) {
      await existing[0].update((r) => {
        if (steps > r.steps) r.steps = steps;
      });
    } else {
      await database.get<SensorStat>('sensor_stats').create((r) => {
        r.date = date;
        r.steps = steps;
        r.userId = userId;
      });
    }
  });
}

export async function initSensors(userId: string): Promise<void> {
  try {
    const available = await Pedometer.isAvailableAsync();
    console.log('[sensor] pedometer available:', available);
    if (!available) return;

    // Seed today's total where supported (Android often returns since-boot; best-effort).
    try {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const res = await Pedometer.getStepCountAsync(start, new Date());
      if (res?.steps != null) {
        console.log('[sensor] steps so far today:', res.steps);
        await recordSteps(res.steps, userId);
      }
    } catch {
      // historical query unsupported on this device — rely on the live watcher
    }

    subscription?.remove();
    let baseline = 0;
    subscription = Pedometer.watchStepCount((result) => {
      baseline += result.steps;
      recordSteps(baseline, userId).catch(() => {});
    });
  } catch (e) {
    console.warn('[sensor] initSensors failed', e);
  }
}

export function stopSensors(): void {
  subscription?.remove();
  subscription = null;
}
