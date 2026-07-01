import { describe, it, expect } from 'vitest'
import { resetCycleStart, shouldAutoFail, shouldRenewFixed, next7Days, dayBucket, SIX_HOURS_MS } from './lifecycle'

const utc = (y: number, mo: number, d: number, h = 0) => Date.UTC(y, mo - 1, d, h, 0, 0, 0)

describe('resetCycleStart', () => {
  it('today 5AM when after 5AM', () => {
    expect(resetCycleStart(utc(2026, 7, 1, 9))).toBe(utc(2026, 7, 1, 5))
  })
  it('yesterday 5AM when before 5AM', () => {
    expect(resetCycleStart(utc(2026, 7, 1, 3))).toBe(utc(2026, 6, 30, 5))
  })
})

describe('shouldAutoFail (server mirror)', () => {
  const now = utc(2026, 7, 1, 12)
  it('fails custom >6h past end', () => {
    expect(shouldAutoFail({ type: 'custom', endTime: BigInt(now - SIX_HOURS_MS - 1) }, now)).toBe(true)
  })
  it('never fails fixed', () => {
    expect(shouldAutoFail({ type: 'fixed', endTime: BigInt(now - SIX_HOURS_MS - 1) }, now)).toBe(false)
  })
  it('skips completed/cancelled/no-end', () => {
    expect(shouldAutoFail({ type: 'custom', endTime: BigInt(0), isCompleted: true }, now)).toBe(false)
    expect(shouldAutoFail({ type: 'custom', endTime: BigInt(0), isCancelled: true }, now)).toBe(false)
    expect(shouldAutoFail({ type: 'custom', endTime: null }, now)).toBe(false)
  })
})

describe('shouldRenewFixed (server mirror)', () => {
  const now = utc(2026, 7, 1, 9)
  it('renews completed fixed touched before the cycle', () => {
    expect(shouldRenewFixed({ type: 'fixed', isCompleted: true, updatedAt: BigInt(utc(2026, 6, 30, 22)) }, now)).toBe(true)
  })
  it('does not renew if touched after cycle start', () => {
    expect(shouldRenewFixed({ type: 'fixed', isCompleted: true, updatedAt: BigInt(utc(2026, 7, 1, 6)) }, now)).toBe(false)
  })
  it('does not renew incomplete or non-fixed', () => {
    expect(shouldRenewFixed({ type: 'fixed', isCompleted: false, updatedAt: BigInt(0) }, now)).toBe(false)
    expect(shouldRenewFixed({ type: 'custom', isCompleted: true, updatedAt: BigInt(0) }, now)).toBe(false)
  })
})

describe('next7Days', () => {
  it('returns 7 consecutive midnight buckets from today', () => {
    const now = utc(2026, 7, 1, 14)
    const days = next7Days(now)
    expect(days).toHaveLength(7)
    expect(days[0]).toBe(dayBucket(now))
    expect(days[6] - days[0]).toBe(6 * 24 * 60 * 60 * 1000)
  })
})
