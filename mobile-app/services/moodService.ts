/**
 * MoodService
 *
 * Mood logging and tracking with event emission.
 *
 * Features:
 * - Log mood at any time
 * - Optional notes with mood entries
 * - Mood analytics derived from events
 * - Pattern detection over time
 * - Periodic mood check notifications
 *
 * All mood entries emit events for analytics.
 */

import { Q } from '@nozbe/watermelondb';
import { database } from '../database';
import MoodLog from '../database/models/MoodLog';
import Settings from '../database/models/Settings';
import { emitEvent, EventTypes, getEventsByType } from './eventLogger';
import { notificationService } from './notifications';

// Mood tracker notification scheduling
let moodTrackerInterval: NodeJS.Timeout | null = null;

/**
 * Mood levels with numeric values for analytics
 */
export const MoodLevels = {
  TERRIBLE: 1,
  BAD: 2,
  MEH: 3,
  GOOD: 4,
  GREAT: 5,
} as const;

export type MoodLevel = keyof typeof MoodLevels;

/**
 * Mood entry creation parameters
 */
export interface MoodEntryParams {
  mood: MoodLevel;
  note?: string;
  userId: string;
}

/**
 * Start mood tracker notifications
 */
export function startMoodTracker(intervalMinutes: number = 45, userId: string): void {
  stopMoodTracker(); // Clear any existing interval

  const intervalMs = intervalMinutes * 60 * 1000;

  console.log(`[MoodService] Starting mood tracker with ${intervalMinutes} minute interval`);

  moodTrackerInterval = setInterval(async () => {
    try {
      await notificationService.sendNotification(
        '🎭 How are you feeling?',
        'Take a moment to check in with your mood',
        'informational',
        'default',
        false, // Don't require remark for mood notifications
        { action: 'mood_check' } // Add action data for handling
      );

      await emitEvent({
        eventType: EventTypes.MOOD_LOGGED,
        entityType: 'mood_tracker',
        entityId: `mood_check_${Date.now()}`,
        payload: {
          action: 'notification_sent',
          intervalMinutes,
          timestamp: Date.now(),
        },
        userId,
      });
    } catch (error) {
      console.error('[MoodService] Failed to send mood notification:', error);
    }
  }, intervalMs);
}

/**
 * Stop mood tracker notifications
 */
export function stopMoodTracker(): void {
  if (moodTrackerInterval) {
    clearInterval(moodTrackerInterval);
    moodTrackerInterval = null;
    console.log('[MoodService] Mood tracker stopped');
  }
}

/**
 * Initialize mood tracker from settings
 */
export async function initMoodTracker(userId: string): Promise<void> {
  try {
    const settings = await database
      .get<Settings>('settings')
      .query(Q.where('user_id', userId))
      .fetch();

    if (settings.length > 0 && settings[0].moodTrackerEnabled) {
      const interval = settings[0].moodTrackerIntervalMinutes || 45;
      startMoodTracker(interval, userId);
    }
  } catch (error) {
    console.error('[MoodService] Failed to initialize mood tracker:', error);
  }
}

/**
 * Log a mood entry
 */
export async function logMood(params: MoodEntryParams): Promise<MoodLog> {
  const { mood, note, userId } = params;

  const moodLog = await database.write(async () => {
    return await database.get<MoodLog>('mood_logs').create((record) => {
      record.mood = mood;
      record.moodValue = MoodLevels[mood];
      record.level = MoodLevels[mood];
      record.note = note;
      record.userId = userId;
    });
  });

  await emitEvent({
    eventType: EventTypes.MOOD_LOGGED,
    entityType: 'mood',
    entityId: moodLog.id,
    payload: {
      mood,
      moodValue: MoodLevels[mood],
      hasNote: !!note,
      timestamp: Date.now(),
    },
    userId,
  });

  return moodLog;
}

/**
 * Get today's mood entries
 */
export async function getTodayMoods(userId: string): Promise<MoodLog[]> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const moods = await database.get<MoodLog>('mood_logs').query(Q.where('user_id', userId)).fetch();

  return moods
    .filter((m) => !m.deletedAt && m.createdAt.getTime() >= startOfDay.getTime())
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * Get recent mood entries
 */
export async function getRecentMoods(userId: string, limit: number = 10): Promise<MoodLog[]> {
  const moods = await database.get<MoodLog>('mood_logs').query(Q.where('user_id', userId)).fetch();

  return moods
    .filter((m) => !m.deletedAt)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}

/**
 * Calculate average mood for a time period
 */
export async function getAverageMood(
  userId: string,
  startDate: Date,
  endDate: Date = new Date()
): Promise<{ average: number; count: number; label: MoodLevel }> {
  const moods = await database.get<MoodLog>('mood_logs').query(Q.where('user_id', userId)).fetch();

  const filtered = moods.filter((m) => {
    if (m.deletedAt) return false;
    return (
      m.createdAt.getTime() >= startDate.getTime() && m.createdAt.getTime() <= endDate.getTime()
    );
  });

  if (filtered.length === 0) {
    return { average: 0, count: 0, label: 'MEH' };
  }

  const sum = filtered.reduce((acc, m) => acc + m.moodValue, 0);
  const average = sum / filtered.length;

  // Map numeric average to mood label
  const label = averageToMoodLabel(average);

  return { average, count: filtered.length, label };
}

/**
 * Get mood distribution over time
 */
export async function getMoodDistribution(
  userId: string,
  days: number = 7
): Promise<Record<MoodLevel, number>> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  const moods = await database.get<MoodLog>('mood_logs').query(Q.where('user_id', userId)).fetch();

  const filtered = moods.filter((m) => !m.deletedAt && m.createdAt >= startDate.getTime());

  const distribution: Record<MoodLevel, number> = {
    TERRIBLE: 0,
    BAD: 0,
    MEH: 0,
    GOOD: 0,
    GREAT: 0,
  };

  for (const mood of filtered) {
    if (mood.mood in distribution) {
      distribution[mood.mood as MoodLevel]++;
    }
  }

  return distribution;
}

/**
 * Get daily mood trend for visualization
 */
export async function getDailyMoodTrend(
  userId: string,
  days: number = 7
): Promise<Array<{ date: string; average: number; count: number }>> {
  const result: Array<{ date: string; average: number; count: number }> = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const { average, count } = await getAverageMood(userId, date, endOfDay);

    result.push({
      date: date.toISOString().split('T')[0],
      average,
      count,
    });
  }

  return result;
}

/**
 * Delete a mood entry (soft delete)
 */
export async function deleteMoodEntry(moodId: string, userId: string): Promise<void> {
  const mood = await database.get<MoodLog>('mood_logs').find(moodId);

  await database.write(async () => {
    await mood.update((record) => {
      record.deletedAt = Date.now();
    });
  });

  await emitEvent({
    eventType: EventTypes.MOOD_LOGGED,
    entityType: 'mood',
    entityId: moodId,
    payload: {
      action: 'deleted',
      originalMood: mood.mood,
    },
    userId,
  });
}

/**
 * Update mood entry note
 */
export async function updateMoodNote(moodId: string, note: string, userId: string): Promise<void> {
  const mood = await database.get<MoodLog>('mood_logs').find(moodId);

  await database.write(async () => {
    await mood.update((record) => {
      record.note = note;
    });
  });

  await emitEvent({
    eventType: EventTypes.MOOD_LOGGED,
    entityType: 'mood',
    entityId: moodId,
    payload: {
      action: 'note_updated',
      mood: mood.mood,
      hasNote: !!note,
    },
    userId,
  });
}

/**
 * Get mood insights derived from event logs
 */
export async function getMoodInsights(userId: string): Promise<{
  totalEntries: number;
  averageThisWeek: number;
  bestDay: string | null;
  worstDay: string | null;
  streak: number;
}> {
  const moodEvents = await getEventsByType(EventTypes.MOOD_LOGGED, userId);

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const recentEvents = moodEvents.filter((e) => e.createdAt >= oneWeekAgo.getTime());

  // Calculate weekly average
  let weeklySum = 0;
  let weeklyCount = 0;

  for (const event of recentEvents) {
    const payload = event.payload || {};
    if (payload.moodValue && payload.action !== 'deleted') {
      weeklySum += payload.moodValue as number;
      weeklyCount++;
    }
  }

  const averageThisWeek = weeklyCount > 0 ? weeklySum / weeklyCount : 0;

  // Calculate best/worst days
  const dayAverages: Record<string, { sum: number; count: number }> = {};

  for (const event of moodEvents) {
    const payload = event.payload || {};
    if (payload.moodValue && payload.action !== 'deleted') {
      const day = new Date(event.createdAt).toLocaleDateString('en-US', { weekday: 'long' });
      if (!dayAverages[day]) {
        dayAverages[day] = { sum: 0, count: 0 };
      }
      dayAverages[day].sum += payload.moodValue as number;
      dayAverages[day].count++;
    }
  }

  let bestDay: string | null = null;
  let worstDay: string | null = null;
  let bestAvg = 0;
  let worstAvg = 6;

  for (const [day, data] of Object.entries(dayAverages)) {
    const avg = data.sum / data.count;
    if (avg > bestAvg) {
      bestAvg = avg;
      bestDay = day;
    }
    if (avg < worstAvg) {
      worstAvg = avg;
      worstDay = day;
    }
  }

  // Calculate streak (consecutive days with mood entries)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let streak = 0;
  let checkDate = new Date(today);

  while (true) {
    const dayStart = new Date(checkDate);
    const dayEnd = new Date(checkDate);
    dayEnd.setHours(23, 59, 59, 999);

    const hasEntry = moodEvents.some((e) => {
      const payload = e.payload || {};
      return (
        e.createdAt >= dayStart.getTime() &&
        e.createdAt <= dayEnd.getTime() &&
        payload.action !== 'deleted'
      );
    });

    if (hasEntry) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  return {
    totalEntries: moodEvents.filter((e) => {
      const payload = e.payload || {};
      return payload.action !== 'deleted';
    }).length,
    averageThisWeek,
    bestDay,
    worstDay,
    streak,
  };
}

/**
 * Convert numeric average to mood label
 */
function averageToMoodLabel(average: number): MoodLevel {
  if (average <= 1.5) return 'TERRIBLE';
  if (average <= 2.5) return 'BAD';
  if (average <= 3.5) return 'MEH';
  if (average <= 4.5) return 'GOOD';
  return 'GREAT';
}

export default {
  log: logMood,
  getTodayMoods,
  getRecent: getRecentMoods,
  getAverage: getAverageMood,
  getDistribution: getMoodDistribution,
  getTrend: getDailyMoodTrend,
  delete: deleteMoodEntry,
  updateNote: updateMoodNote,
  getInsights: getMoodInsights,
  MoodLevels,
};
