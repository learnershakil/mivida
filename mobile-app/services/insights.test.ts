import {
  pearson,
  productivityMoodMatrix,
  burnRate,
  evaluateFatigue,
  taskVelocity,
} from './insights';

describe('pearson', () => {
  it('is +1 for a perfect positive line', () => {
    expect(pearson([1, 2, 3], [2, 4, 6])).toBeCloseTo(1);
  });
  it('is -1 for a perfect negative line', () => {
    expect(pearson([1, 2, 3], [6, 4, 2])).toBeCloseTo(-1);
  });
  it('is null for <2 points or zero variance', () => {
    expect(pearson([1], [1])).toBeNull();
    expect(pearson([2, 2, 2], [1, 2, 3])).toBeNull();
  });
});

describe('productivityMoodMatrix', () => {
  it('correlates productive minutes with mood, ignoring days without mood', () => {
    const r = productivityMoodMatrix([
      { date: 1, productiveMinutes: 60, moodAvg: 2 },
      { date: 2, productiveMinutes: 120, moodAvg: 4 },
      { date: 3, productiveMinutes: 30, moodAvg: null }, // dropped
    ]);
    expect(r.points).toHaveLength(2);
    expect(r.correlation).toBeCloseTo(1);
  });
});

describe('burnRate', () => {
  it('computes cost per focus hour (₹850 / 4h = ₹212.5/h)', () => {
    const r = burnRate(850, 240);
    expect(r.focusHours).toBe(4);
    expect(r.perHour).toBeCloseTo(212.5);
  });
  it('is null per-hour when there are no focus hours', () => {
    expect(burnRate(500, 0).perHour).toBeNull();
  });
});

describe('evaluateFatigue', () => {
  const thr = { screenTimeHours: 6, steps: 1000 };
  it('triggers when screen time high AND steps low', () => {
    expect(evaluateFatigue(7 * 3600_000, 500, thr).triggered).toBe(true);
  });
  it('does not trigger when steps are sufficient', () => {
    expect(evaluateFatigue(7 * 3600_000, 2000, thr).triggered).toBe(false);
  });
  it('does not trigger when screen time is low', () => {
    expect(evaluateFatigue(3 * 3600_000, 200, thr).triggered).toBe(false);
  });
});

describe('taskVelocity', () => {
  it('averages completion time by category, slowest first', () => {
    const r = taskVelocity([
      { category: 'Work', createdAt: 0, completedAt: 1000 },
      { category: 'Work', createdAt: 0, completedAt: 3000 }, // avg 2000
      { category: 'Health', createdAt: 0, completedAt: 500 }, // avg 500
      { category: 'Health', createdAt: 0, completedAt: null }, // incomplete → ignored
    ]);
    expect(r.byCategory[0]).toEqual({ category: 'Work', count: 2, avgCompletionMs: 2000 });
    expect(r.slowestCategory).toBe('Work');
    expect(r.overallAvgMs).toBeCloseTo((1000 + 3000 + 500) / 3);
  });
  it('handles no completed tasks', () => {
    expect(taskVelocity([{ category: 'X', createdAt: 0 }]).slowestCategory).toBeNull();
  });
  it('buckets missing categories as Uncategorized', () => {
    const r = taskVelocity([{ createdAt: 0, completedAt: 100 }]);
    expect(r.byCategory[0].category).toBe('Uncategorized');
  });
});
