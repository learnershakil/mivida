/**
 * AnalyticsService
 *
 * Derives all analytics from event logs.
 * No stored aggregates - everything is computed in real-time.
 *
 * Key metrics:
 * - Daily productivity percentage
 * - Awake vs Sleep ratio
 * - Focus lock time
 * - Distraction count
 * - Finance daily snapshot
 */

import EventLog from '../database/models/EventLog';
import { EventTypes, getEventsInRange } from './eventLogger';
import { getDailySnapshot } from './financeService';

export interface DailyAnalytics {
  // Time metrics
  awakeTimeMs: number;
  sleepTimeMs: number;
  awakeRatio: number; // 0-100

  // Focus metrics
  totalFocusTimeMs: number;
  focusSessionCount: number;
  breakAttempts: number;

  // Task metrics
  tasksCreated: number;
  tasksCompleted: number;
  tasksSkipped: number;
  productivityPercent: number; // 0-100

  // Distraction metrics
  inactivityDetections: number;
  nudgeResponses: number;
  nudgesIgnored: number;

  // Finance snapshot
  totalCredits: number;
  totalDebits: number;
  netChange: number;

  // Mood (if recorded)
  averageMoodScore: number | null;
}

/**
 * AnalyticsSummary - simplified analytics for display
 */
export interface AnalyticsSummary {
  awakeTimeHours: number;
  sleepTimeHours: number;
  focusTimeHours: number;
  productivityPercent: number;
  tasksCompleted: number;
  totalTasks: number;
  inactivityCount: number;
  avgMoodScore: number | null;
}

/**
 * Get simplified analytics summary for display
 */
export async function getAnalyticsSummary(
  userId: string,
  date: Date = new Date()
): Promise<AnalyticsSummary> {
  try {
    const daily = await getDailyAnalytics(userId, date);

    return {
      awakeTimeHours: Math.round((daily.awakeTimeMs / (1000 * 60 * 60)) * 10) / 10,
      sleepTimeHours: Math.round((daily.sleepTimeMs / (1000 * 60 * 60)) * 10) / 10,
      focusTimeHours: Math.round((daily.totalFocusTimeMs / (1000 * 60 * 60)) * 10) / 10,
      productivityPercent: daily.productivityPercent,
      tasksCompleted: daily.tasksCompleted,
      totalTasks: daily.tasksCreated,
      inactivityCount: daily.inactivityDetections,
      avgMoodScore: daily.averageMoodScore,
    };
  } catch (error) {
    console.error('Error getting analytics summary:', error);
    // Return default values on error
    return {
      awakeTimeHours: 0,
      sleepTimeHours: 0,
      focusTimeHours: 0,
      productivityPercent: 0,
      tasksCompleted: 0,
      totalTasks: 0,
      inactivityCount: 0,
      avgMoodScore: null,
    };
  }
}

/**
 * Get complete daily analytics
 */
export async function getDailyAnalytics(
  userId: string,
  date: Date = new Date()
): Promise<DailyAnalytics> {
  const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

  const events = await getEventsInRange(userId, startOfDay, endOfDay);

  // Calculate awake/sleep time
  const { awakeTimeMs, sleepTimeMs } = calculateAwakeSleepTime(events, startOfDay, endOfDay);

  // Calculate focus metrics
  const focusMetrics = calculateFocusMetrics(events);

  // Calculate task metrics
  const taskMetrics = calculateTaskMetrics(events);

  // Calculate distraction metrics
  const distractionMetrics = calculateDistractionMetrics(events);

  // Get finance snapshot
  const financeSnapshot = await getDailySnapshot(userId, date);

  // Get mood data
  const moodScore = calculateAverageMood(events);

  const totalActiveTime = awakeTimeMs + sleepTimeMs;
  const awakeRatio = totalActiveTime > 0 ? (awakeTimeMs / totalActiveTime) * 100 : 0;

  return {
    awakeTimeMs,
    sleepTimeMs,
    awakeRatio: Math.round(awakeRatio),

    totalFocusTimeMs: focusMetrics.totalFocusTimeMs,
    focusSessionCount: focusMetrics.sessionCount,
    breakAttempts: focusMetrics.breakAttempts,

    tasksCreated: taskMetrics.created,
    tasksCompleted: taskMetrics.completed,
    tasksSkipped: taskMetrics.skipped,
    productivityPercent: taskMetrics.productivityPercent,

    inactivityDetections: distractionMetrics.inactivityDetections,
    nudgeResponses: distractionMetrics.nudgeResponses,
    nudgesIgnored: distractionMetrics.nudgesIgnored,

    totalCredits: financeSnapshot.totalIncome,
    totalDebits: financeSnapshot.totalExpenses,
    netChange: financeSnapshot.netChange,

    averageMoodScore: moodScore,
  };
}

/**
 * Calculate awake/sleep time from STATE_CHANGE events
 */
function calculateAwakeSleepTime(
  events: EventLog[],
  startOfDay: Date,
  endOfDay: Date
): { awakeTimeMs: number; sleepTimeMs: number } {
  const stateChanges = events
    .filter((e) => e.eventType === EventTypes.STATE_CHANGE)
    .sort((a, b) => a.createdAt - b.createdAt);

  let awakeTimeMs = 0;
  let sleepTimeMs = 0;

  // Assume awake at start of day (or use first event to determine)
  let currentState: 'awake' | 'sleep' = 'awake';
  let lastChangeTime = startOfDay.getTime();

  // If first event is a change TO awake, user was sleeping
  if (stateChanges.length > 0) {
    const firstPayload = stateChanges[0].payload as { from?: string; to?: string };
    if (firstPayload.to === 'awake') {
      currentState = 'sleep';
    }
  }

  for (const event of stateChanges) {
    const payload = event.payload as { from?: string; to?: string };
    const duration = event.createdAt - lastChangeTime;

    if (currentState === 'awake') {
      awakeTimeMs += duration;
    } else {
      sleepTimeMs += duration;
    }

    currentState = payload.to === 'awake' ? 'awake' : 'sleep';
    lastChangeTime = event.createdAt;
  }

  // Add time from last change to end of day (or now if today)
  const now = Date.now();
  const endTime = Math.min(endOfDay.getTime(), now);
  const remainingTime = endTime - lastChangeTime;

  if (remainingTime > 0) {
    if (currentState === 'awake') {
      awakeTimeMs += remainingTime;
    } else {
      sleepTimeMs += remainingTime;
    }
  }

  return { awakeTimeMs, sleepTimeMs };
}

/**
 * Calculate focus lockdown metrics
 */
function calculateFocusMetrics(events: EventLog[]): {
  totalFocusTimeMs: number;
  sessionCount: number;
  breakAttempts: number;
} {
  const focusStarts = events.filter((e) => e.eventType === EventTypes.FOCUS_LOCK_STARTED);
  const focusEnds = events.filter(
    (e) =>
      e.eventType === EventTypes.FOCUS_LOCK_ENDED || e.eventType === EventTypes.FOCUS_FORCE_EXIT
  );
  const breakAttempts = events.filter((e) => e.eventType === EventTypes.FOCUS_BREAK_ATTEMPTED);

  let totalFocusTimeMs = 0;

  for (const startEvent of focusStarts) {
    const payload = startEvent.payload as { lockdownId?: string; endTime?: number };
    const lockdownId = payload.lockdownId;

    // Find matching end event
    const endEvent = focusEnds.find((e) => {
      const endPayload = e.payload as { lockdownId?: string };
      return endPayload.lockdownId === lockdownId;
    });

    if (endEvent) {
      totalFocusTimeMs += endEvent.createdAt - startEvent.createdAt;
    }
  }

  return {
    totalFocusTimeMs,
    sessionCount: focusStarts.length,
    breakAttempts: breakAttempts.length,
  };
}

/**
 * Calculate task metrics
 */
function calculateTaskMetrics(events: EventLog[]): {
  created: number;
  completed: number;
  skipped: number;
  productivityPercent: number;
} {
  const created = events.filter((e) => e.eventType === EventTypes.TASK_CREATED).length;
  const completed = events.filter((e) => e.eventType === EventTypes.TASK_COMPLETED).length;
  const skipped = events.filter((e) => e.eventType === EventTypes.TASK_SKIPPED).length;

  // Productivity = completed / (completed + skipped) * 100
  const totalFinished = completed + skipped;
  const productivityPercent = totalFinished > 0 ? Math.round((completed / totalFinished) * 100) : 0;

  return { created, completed, skipped, productivityPercent };
}

/**
 * Calculate distraction metrics from Dead Man's Switch events
 */
function calculateDistractionMetrics(events: EventLog[]): {
  inactivityDetections: number;
  nudgeResponses: number;
  nudgesIgnored: number;
} {
  return {
    inactivityDetections: events.filter((e) => e.eventType === EventTypes.INACTIVITY_DETECTED)
      .length,
    nudgeResponses: events.filter((e) => e.eventType === EventTypes.NUDGE_RESPONDED).length,
    nudgesIgnored: events.filter((e) => e.eventType === EventTypes.NUDGE_IGNORED).length,
  };
}

/**
 * Calculate average mood score for the day
 */
function calculateAverageMood(events: EventLog[]): number | null {
  const moodEvents = events.filter((e) => e.eventType === EventTypes.MOOD_REPORTED);

  if (moodEvents.length === 0) return null;

  const totalScore = moodEvents.reduce((sum, event) => {
    const payload = event.payload as { score?: number };
    return sum + (payload.score || 0);
  }, 0);

  return Math.round((totalScore / moodEvents.length) * 10) / 10; // Round to 1 decimal
}

/**
 * Get weekly summary
 */
export async function getWeeklySummary(
  userId: string,
  weekStartDate: Date
): Promise<{
  totalAwakeTimeMs: number;
  totalFocusTimeMs: number;
  totalTasksCompleted: number;
  averageProductivity: number;
  totalCredits: number;
  totalDebits: number;
}> {
  const weekEnd = new Date(weekStartDate);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const events = await getEventsInRange(userId, weekStartDate, weekEnd);

  const taskMetrics = calculateTaskMetrics(events);
  const focusMetrics = calculateFocusMetrics(events);
  const { awakeTimeMs } = calculateAwakeSleepTime(events, weekStartDate, weekEnd);

  // Get finance totals for the week
  let totalIncome = 0;
  let totalExpenses = 0;

  for (let i = 0; i < 7; i++) {
    const day = new Date(weekStartDate);
    day.setDate(day.getDate() + i);
    const snapshot = await getDailySnapshot(userId, day);
    totalIncome += snapshot.totalIncome;
    totalExpenses += snapshot.totalExpenses;
  }

  return {
    totalAwakeTimeMs: awakeTimeMs,
    totalFocusTimeMs: focusMetrics.totalFocusTimeMs,
    totalTasksCompleted: taskMetrics.completed,
    averageProductivity: taskMetrics.productivityPercent,
    totalCredits: totalIncome,
    totalDebits: totalExpenses,
  };
}

/**
 * Format milliseconds to readable duration
 */
export function formatDuration(ms: number): string {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Format milliseconds to hours with decimals
 */
export function formatHours(ms: number, decimals: number = 1): string {
  const hours = ms / (1000 * 60 * 60);
  return hours.toFixed(decimals);
}

export default {
  getDaily: getDailyAnalytics,
  getWeekly: getWeeklySummary,
  getSummary: getAnalyticsSummary,
  formatDuration,
  formatHours,
};
