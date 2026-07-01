import {
  resetCycleStart,
  shouldAutoFail,
  isWithinCompletedWindow,
  isWithinRecentWindow,
  shouldRenewFixed,
  isTimeOnlyType,
  SIX_HOURS_MS,
  SIXTEEN_HOURS_MS,
  FORTY_EIGHT_HOURS_MS,
  LifecycleTask,
} from './taskLifecycle';

// Fixed reference instants (local time). Tests avoid Date.now(); all times are explicit.
const at = (y: number, m: number, d: number, h: number, min = 0) =>
  new Date(y, m - 1, d, h, min, 0, 0).getTime();

describe('resetCycleStart (5AM cycle)', () => {
  it('returns today 5AM when now is after 5AM', () => {
    const now = at(2026, 7, 1, 9, 0); // 9:00
    expect(resetCycleStart(now)).toBe(at(2026, 7, 1, 5, 0));
  });
  it('returns yesterday 5AM when now is before 5AM', () => {
    const now = at(2026, 7, 1, 3, 0); // 3:00
    expect(resetCycleStart(now)).toBe(at(2026, 6, 30, 5, 0));
  });
  it('is inclusive at exactly 5AM', () => {
    const now = at(2026, 7, 1, 5, 0);
    expect(resetCycleStart(now)).toBe(now);
  });
});

describe('shouldAutoFail (6h custom fail)', () => {
  const now = at(2026, 7, 1, 12, 0);
  const base: LifecycleTask = { type: 'custom', endTime: now - SIX_HOURS_MS - 1 };

  it('fails a custom task >6h past end', () => {
    expect(shouldAutoFail(base, now)).toBe(true);
  });
  it('does NOT fail exactly at 6h (boundary)', () => {
    expect(shouldAutoFail({ type: 'custom', endTime: now - SIX_HOURS_MS }, now)).toBe(false);
  });
  it('does NOT fail before 6h', () => {
    expect(shouldAutoFail({ type: 'custom', endTime: now - 60_000 }, now)).toBe(false);
  });
  it('never fails FIXED tasks (AUDIT §4 fix)', () => {
    expect(shouldAutoFail({ ...base, type: 'fixed' }, now)).toBe(false);
  });
  it('never fails ALERT tasks', () => {
    expect(shouldAutoFail({ ...base, type: 'alert' }, now)).toBe(false);
  });
  it('does not fail an already-completed task', () => {
    expect(shouldAutoFail({ ...base, isCompleted: true }, now)).toBe(false);
  });
  it('does not fail an already-cancelled task', () => {
    expect(shouldAutoFail({ ...base, isCancelled: true }, now)).toBe(false);
  });
  it('does not fail a task with no end time', () => {
    expect(shouldAutoFail({ type: 'custom' }, now)).toBe(false);
  });
});

describe('isWithinCompletedWindow (16h "Completed Today")', () => {
  const now = at(2026, 7, 1, 20, 0);
  it('shows a task completed within 16h', () => {
    expect(isWithinCompletedWindow(now - SIXTEEN_HOURS_MS + 1, now)).toBe(true);
  });
  it('is inclusive exactly at 16h', () => {
    expect(isWithinCompletedWindow(now - SIXTEEN_HOURS_MS, now)).toBe(true);
  });
  it('hides a task completed >16h ago', () => {
    expect(isWithinCompletedWindow(now - SIXTEEN_HOURS_MS - 1, now)).toBe(false);
  });
  it('hides when completedAt is undefined', () => {
    expect(isWithinCompletedWindow(undefined, now)).toBe(false);
  });
});

describe('isWithinRecentWindow (48h terminal preview)', () => {
  const now = at(2026, 7, 1, 20, 0);
  it('shows within 48h', () => {
    expect(isWithinRecentWindow(now - FORTY_EIGHT_HOURS_MS + 1, now)).toBe(true);
  });
  it('hides beyond 48h', () => {
    expect(isWithinRecentWindow(now - FORTY_EIGHT_HOURS_MS - 1, now)).toBe(false);
  });
  it('shows when timestamp is undefined', () => {
    expect(isWithinRecentWindow(undefined, now)).toBe(true);
  });
});

describe('shouldRenewFixed (5AM renewal)', () => {
  const now = at(2026, 7, 1, 9, 0); // after 5AM → cycle start = today 5AM
  it('renews a completed fixed task last touched before the cycle', () => {
    const task: LifecycleTask = { type: 'fixed', isCompleted: true, updatedAt: at(2026, 6, 30, 22, 0) };
    expect(shouldRenewFixed(task, now)).toBe(true);
  });
  it('does not renew if last touched after the cycle start', () => {
    const task: LifecycleTask = { type: 'fixed', isCompleted: true, updatedAt: at(2026, 7, 1, 6, 0) };
    expect(shouldRenewFixed(task, now)).toBe(false);
  });
  it('does not renew an incomplete fixed task', () => {
    const task: LifecycleTask = { type: 'fixed', isCompleted: false, updatedAt: at(2026, 6, 30, 22, 0) };
    expect(shouldRenewFixed(task, now)).toBe(false);
  });
  it('does not renew non-fixed tasks', () => {
    const task: LifecycleTask = { type: 'custom', isCompleted: true, updatedAt: at(2026, 6, 30, 22, 0) };
    expect(shouldRenewFixed(task, now)).toBe(false);
  });
  it('falls back to createdAt when updatedAt is missing', () => {
    const task: LifecycleTask = { type: 'fixed', isCompleted: true, createdAt: at(2026, 6, 30, 22, 0) };
    expect(shouldRenewFixed(task, now)).toBe(true);
  });
});

describe('isTimeOnlyType', () => {
  it('fixed is time-only', () => expect(isTimeOnlyType('fixed')).toBe(true));
  it('custom is not time-only', () => expect(isTimeOnlyType('custom')).toBe(false));
  it('alert is not time-only', () => expect(isTimeOnlyType('alert')).toBe(false));
});
