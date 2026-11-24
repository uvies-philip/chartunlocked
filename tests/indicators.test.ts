import { describe, expect, it } from 'vitest';
import { atr, ema, lastValue, rsi, sma, stdev } from '../src/engine/indicators';
import type { Bar } from '../src/domain/types';

const series = (values: number[]) => values;

describe('sma', () => {
  it('leaves warm-up as null and averages the window', () => {
    expect(sma(series([1, 2, 3, 4, 5]), 3)).toEqual([null, null, 2, 3, 4]);
  });

  it('returns all null when the window is longer than the data', () => {
    expect(sma([1, 2], 5)).toEqual([null, null]);
  });

  it('rejects a non-positive length instead of dividing by zero', () => {
    expect(sma([1, 2, 3], 0)).toEqual([null, null, null]);
  });
});

describe('ema', () => {
  it('seeds with the simple average then applies the smoothing constant', () => {
    const out = ema([1, 2, 3, 4, 5], 3);
    expect(out[0]).toBeNull();
    expect(out[1]).toBeNull();
    expect(out[2]).toBeCloseTo(2, 10);
    expect(out[3]).toBeCloseTo(3, 10);
    expect(out[4]).toBeCloseTo(4, 10);
  });

  it('never emits NaN', () => {
    const out = ema([5, 5, 5, 5, 5], 2);
    expect(out.every((v) => v === null || Number.isFinite(v))).toBe(true);
  });
});

describe('stdev', () => {
  it('matches a hand-computed population deviation', () => {
    const out = stdev([2, 4, 4, 4, 5, 5, 7, 9], 8);
    expect(out[7]).toBeCloseTo(2, 10);
  });
});

describe('rsi', () => {
  it('is 100 for a monotonically rising series once warmed up', () => {
    const values = Array.from({ length: 20 }, (_, i) => 100 + i);
    const out = rsi(values, 14);
    const last = out[out.length - 1];
    expect(last).toBeCloseTo(100, 6);
  });

  it('is 0 for a monotonically falling series', () => {
    const values = Array.from({ length: 20 }, (_, i) => 100 - i);
    const out = rsi(values, 14);
    expect(out[out.length - 1]).toBeCloseTo(0, 6);
  });

  it('stays inside 0..100 for noisy data', () => {
    const values = [10, 11, 10.5, 12, 11.2, 13, 12.4, 12.9, 11.8, 12.2, 13.5, 12.8, 13.1, 12.6, 13.9, 14.2, 13.4, 14.8];
    const out = rsi(values, 14);
    for (const value of out) {
      if (value === null) continue;
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    }
  });
});

function flatBars(count: number, range: number): Bar[] {
  return Array.from({ length: count }, (_, i) => ({
    time: 1_700_000_000 + i * 900,
    open: 100,
    high: 100 + range,
    low: 100 - range,
    close: 100,
    volume: 10,
  }));
}

describe('atr', () => {
  it('converges to the constant true range', () => {
    const bars = flatBars(40, 1);
    const out = atr(bars, 14);
    const value = out[out.length - 1];
    expect(value).toBeCloseTo(2, 6);
  });

  it('is positive and defined after warm-up', () => {
    const out = atr(flatBars(30, 0.5), 14);
    expect(out[13]).toBeCloseTo(1, 6);
    expect(lastValue(out)).not.toBeNull();
  });
});
