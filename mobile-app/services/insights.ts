/**
 * insights — pure computations for the four dashboard analytics (ARCHITECTURE §8.4 / brief §8.4).
 * DB-free so they can be unit-tested and mirrored server-side. Each is gated + threshold-configured by the
 * Insights settings group (thresholds passed in as arguments).
 */

// ── shared ────────────────────────────────────────────────────
/** Pearson correlation coefficient, or null when undefined (n<2 or zero variance). */
export function pearson(xs: number[], ys: number[]): number | null {
  const n = xs.length;
  if (n < 2 || n !== ys.length) return null;
  const sx = xs.reduce((a, b) => a + b, 0);
  const sy = ys.reduce((a, b) => a + b, 0);
  const sxx = xs.reduce((a, b) => a + b * b, 0);
  const syy = ys.reduce((a, b) => a + b * b, 0);
  const sxy = xs.reduce((a, b, i) => a + b * ys[i], 0);
  const num = n * sxy - sx * sy;
  const den = Math.sqrt((n * sxx - sx * sx) * (n * syy - sy * sy));
  if (den === 0) return null;
  return num / den;
}

// ── 1. Productivity vs Mood Matrix ────────────────────────────
export interface DayProductivityMood {
  date: number;
  productiveMinutes: number; // coding + focus minutes
  moodAvg: number | null; // 1..5, null if no mood logged that day
}
export interface ProductivityMoodResult {
  correlation: number | null; // +1 long sessions↔better mood, -1 long sessions↔worse mood
  points: { productiveMinutes: number; moodAvg: number }[];
}
export function productivityMoodMatrix(days: DayProductivityMood[]): ProductivityMoodResult {
  const points = days
    .filter((d) => d.moodAvg !== null)
    .map((d) => ({ productiveMinutes: d.productiveMinutes, moodAvg: d.moodAvg as number }));
  return {
    correlation: pearson(
      points.map((p) => p.productiveMinutes),
      points.map((p) => p.moodAvg),
    ),
    points,
  };
}

// ── 2. Burn Rate (cost per focus hour) ────────────────────────
export interface BurnRateResult {
  perHour: number | null; // currency per focus hour
  totalSpend: number;
  focusHours: number;
}
export function burnRate(totalSpend: number, focusMinutes: number): BurnRateResult {
  const focusHours = focusMinutes / 60;
  return {
    perHour: focusHours > 0 ? totalSpend / focusHours : null,
    totalSpend,
    focusHours,
  };
}

// ── 3. Physical Fatigue vs Screen Time ────────────────────────
export interface FatigueThresholds {
  screenTimeHours: number; // e.g. 6
  steps: number; // e.g. 1000
}
export interface FatigueResult {
  triggered: boolean; // screen time high AND steps low → auto-create a physical-activity task
  screenTimeHours: number;
  steps: number;
}
export function evaluateFatigue(
  screenTimeMs: number,
  steps: number,
  thresholds: FatigueThresholds,
): FatigueResult {
  const screenTimeHours = screenTimeMs / (60 * 60 * 1000);
  return {
    triggered: screenTimeHours > thresholds.screenTimeHours && steps < thresholds.steps,
    screenTimeHours,
    steps,
  };
}

// ── 4. Task Velocity (creation → completion, by category) ─────
export interface VelocityTask {
  category?: string | null;
  createdAt: number;
  completedAt?: number | null;
}
export interface CategoryVelocity {
  category: string;
  count: number;
  avgCompletionMs: number;
}
export interface TaskVelocityResult {
  overallAvgMs: number | null;
  byCategory: CategoryVelocity[]; // sorted slowest-first (procrastination hotspots)
  slowestCategory: string | null;
}
export function taskVelocity(tasks: VelocityTask[]): TaskVelocityResult {
  const completed = tasks.filter(
    (t): t is VelocityTask & { completedAt: number } =>
      typeof t.completedAt === 'number' && t.completedAt >= t.createdAt,
  );
  if (completed.length === 0) {
    return { overallAvgMs: null, byCategory: [], slowestCategory: null };
  }

  const groups = new Map<string, number[]>();
  for (const t of completed) {
    const cat = (t.category || 'Uncategorized').trim() || 'Uncategorized';
    const arr = groups.get(cat) ?? [];
    arr.push(t.completedAt - t.createdAt);
    groups.set(cat, arr);
  }

  const byCategory: CategoryVelocity[] = [...groups.entries()]
    .map(([category, durations]) => ({
      category,
      count: durations.length,
      avgCompletionMs: durations.reduce((a, b) => a + b, 0) / durations.length,
    }))
    .sort((a, b) => b.avgCompletionMs - a.avgCompletionMs);

  const overallAvgMs =
    completed.reduce((a, t) => a + (t.completedAt - t.createdAt), 0) / completed.length;

  return { overallAvgMs, byCategory, slowestCategory: byCategory[0]?.category ?? null };
}
