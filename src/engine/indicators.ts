import type { Bar } from '../domain/types';

// Deterministic indicator maths. Every function returns an array the same length
// as the input, with `null` for warm-up values instead of zeros, so a line never
// pretends to know more history than it has.

export type Series = (number | null)[];

export interface Plot {
  key: string;
  kind: 'line' | 'hist';
  data: Series;
  color?: string;
}

export interface IndicatorInstance {
  uid: string;
  defId: string;
  params: Record<string, number>;
  color: string;
  visible: boolean;
}

export interface IndicatorDef {
  id: string;
  name: string;
  full: string;
  pane: 'overlay' | 'pane';
  params: { key: string; label: string; def: number; min: number; max: number }[];
  calc: (bars: Bar[], params: Record<string, number>) => Plot[];
}

const empty = (n: number): Series => new Array<number | null>(n).fill(null);

const closes = (bars: Bar[]) => bars.map((b) => b.close);

export function sma(values: number[], length: number): Series {
  const out = empty(values.length);
  if (length <= 0) return out;
  let sum = 0;
  for (let i = 0; i < values.length; i += 1) {
    sum += values[i] as number;
    if (i >= length) sum -= values[i - length] as number;
    if (i >= length - 1) out[i] = sum / length;
  }
  return out;
}

export function ema(values: number[], length: number): Series {
  const out = empty(values.length);
  if (length <= 0 || values.length < length) return out;
  const seed = values.slice(0, length).reduce((a, b) => a + b, 0) / length;
  out[length - 1] = seed;
  const k = 2 / (length + 1);
  let prev = seed;
  for (let i = length; i < values.length; i += 1) {
    prev = (values[i] as number) * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

export function stdev(values: number[], length: number): Series {
  const out = empty(values.length);
  if (length <= 1) return out;
  for (let i = length - 1; i < values.length; i += 1) {
    let mean = 0;
    for (let j = i - length + 1; j <= i; j += 1) mean += values[j] as number;
    mean /= length;
    let acc = 0;
    for (let j = i - length + 1; j <= i; j += 1) {
      const d = (values[j] as number) - mean;
      acc += d * d;
    }
    out[i] = Math.sqrt(acc / length);
  }
  return out;
}

/** Wilder-smoothed average, used by RSI and ATR. */
function wilder(values: number[], length: number): Series {
  const out = empty(values.length);
  if (length <= 0 || values.length < length) return out;
  let sum = 0;
  for (let i = 0; i < length; i += 1) sum += values[i] as number;
  let prev = sum / length;
  out[length - 1] = prev;
  for (let i = length; i < values.length; i += 1) {
    prev = (prev * (length - 1) + (values[i] as number)) / length;
    out[i] = prev;
  }
  return out;
}

export function rsi(values: number[], length: number): Series {
  const out = empty(values.length);
  if (values.length < length + 1) return out;
  const gains: number[] = [];
  const losses: number[] = [];
  for (let i = 1; i < values.length; i += 1) {
    const change = (values[i] as number) - (values[i - 1] as number);
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? -change : 0);
  }
  const avgGain = wilder(gains, length);
  const avgLoss = wilder(losses, length);
  for (let i = 0; i < gains.length; i += 1) {
    const g = avgGain[i];
    const l = avgLoss[i];
    if (g === null || g === undefined || l === null || l === undefined) continue;
    out[i + 1] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
  }
  return out;
}

export function trueRange(bars: Bar[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < bars.length; i += 1) {
    const bar = bars[i] as Bar;
    const prev = bars[i - 1];
    if (!prev) {
      out.push(bar.high - bar.low);
      continue;
    }
    out.push(Math.max(bar.high - bar.low, Math.abs(bar.high - prev.close), Math.abs(bar.low - prev.close)));
  }
  return out;
}

export function atr(bars: Bar[], length: number): Series {
  return wilder(trueRange(bars), length);
}

function vwapSession(bars: Bar[]): Series {
  const out = empty(bars.length);
  let day = -1;
  let pv = 0;
  let vol = 0;
  for (let i = 0; i < bars.length; i += 1) {
    const bar = bars[i] as Bar;
    const d = Math.floor(bar.time / 86400);
    if (d !== day) {
      day = d;
      pv = 0;
      vol = 0;
    }
    const volume = bar.volume ?? 0;
    if (volume <= 0) continue;
    const typical = (bar.high + bar.low + bar.close) / 3;
    pv += typical * volume;
    vol += volume;
    out[i] = vol > 0 ? pv / vol : null;
  }
  return out;
}

/* --------------------------------- defs --------------------------------- */

export const INDICATOR_DEFS: IndicatorDef[] = [
  {
    id: 'sma',
    name: 'SMA',
    full: 'Simple Moving Average',
    pane: 'overlay',
    params: [{ key: 'length', label: 'Length', def: 20, min: 1, max: 500 }],
    calc: (bars, params) => [{ key: 'sma', kind: 'line', data: sma(closes(bars), params.length ?? 20) }],
  },
  {
    id: 'ema',
    name: 'EMA',
    full: 'Exponential Moving Average',
    pane: 'overlay',
    params: [{ key: 'length', label: 'Length', def: 50, min: 1, max: 500 }],
    calc: (bars, params) => [{ key: 'ema', kind: 'line', data: ema(closes(bars), params.length ?? 50) }],
  },
  {
    id: 'bb',
    name: 'Bollinger',
    full: 'Bollinger Bands',
    pane: 'overlay',
    params: [
      { key: 'length', label: 'Length', def: 20, min: 2, max: 500 },
      { key: 'mult', label: 'Std dev', def: 2, min: 1, max: 5 },
    ],
    calc: (bars, params) => {
      const c = closes(bars);
      const length = params.length ?? 20;
      const mult = params.mult ?? 2;
      const mid = sma(c, length);
      const sd = stdev(c, length);
      const upper = mid.map((m, i) => {
        const s = sd[i];
        return m === null || s === null || s === undefined ? null : m + s * mult;
      });
      const lower = mid.map((m, i) => {
        const s = sd[i];
        return m === null || s === null || s === undefined ? null : m - s * mult;
      });
      return [
        { key: 'upper', kind: 'line', data: upper },
        { key: 'mid', kind: 'line', data: mid },
        { key: 'lower', kind: 'line', data: lower },
      ];
    },
  },
  {
    id: 'vwap',
    name: 'VWAP',
    full: 'Volume Weighted Average Price (session)',
    pane: 'overlay',
    params: [],
    calc: (bars) => [{ key: 'vwap', kind: 'line', data: vwapSession(bars) }],
  },
  {
    id: 'rsi',
    name: 'RSI',
    full: 'Relative Strength Index',
    pane: 'pane',
    params: [{ key: 'length', label: 'Length', def: 14, min: 2, max: 200 }],
    calc: (bars, params) => [{ key: 'rsi', kind: 'line', data: rsi(closes(bars), params.length ?? 14) }],
  },
  {
    id: 'macd',
    name: 'MACD',
    full: 'Moving Average Convergence Divergence',
    pane: 'pane',
    params: [
      { key: 'fast', label: 'Fast', def: 12, min: 1, max: 200 },
      { key: 'slow', label: 'Slow', def: 26, min: 2, max: 400 },
      { key: 'signal', label: 'Signal', def: 9, min: 1, max: 100 },
    ],
    calc: (bars, params) => {
      const c = closes(bars);
      const fast = ema(c, params.fast ?? 12);
      const slow = ema(c, params.slow ?? 26);
      const macd = c.map((_, i) => {
        const f = fast[i];
        const s = slow[i];
        return f === null || f === undefined || s === null || s === undefined ? null : f - s;
      });
      const compact = macd.filter((v): v is number => v !== null);
      const signalCompact = ema(compact, params.signal ?? 9);
      const signal: Series = macd.map(() => null);
      let cursor = 0;
      for (let i = 0; i < macd.length; i += 1) {
        if (macd[i] === null) continue;
        signal[i] = signalCompact[cursor] ?? null;
        cursor += 1;
      }
      const hist = macd.map((m, i) => {
        const s = signal[i];
        return m === null || s === null || s === undefined ? null : m - s;
      });
      return [
        { key: 'macd', kind: 'line', data: macd },
        { key: 'signal', kind: 'line', data: signal },
        { key: 'hist', kind: 'hist', data: hist },
      ];
    },
  },
  {
    id: 'atr',
    name: 'ATR',
    full: 'Average True Range',
    pane: 'pane',
    params: [{ key: 'length', label: 'Length', def: 14, min: 1, max: 200 }],
    calc: (bars, params) => [{ key: 'atr', kind: 'line', data: atr(bars, params.length ?? 14) }],
  },
  {
    id: 'stoch',
    name: 'Stoch',
    full: 'Stochastic Oscillator',
    pane: 'pane',
    params: [
      { key: 'length', label: 'Length', def: 14, min: 2, max: 200 },
      { key: 'smooth', label: 'Smooth', def: 3, min: 1, max: 50 },
    ],
    calc: (bars, params) => {
      const length = params.length ?? 14;
      const k: Series = empty(bars.length);
      for (let i = length - 1; i < bars.length; i += 1) {
        let high = -Infinity;
        let low = Infinity;
        for (let j = i - length + 1; j <= i; j += 1) {
          const bar = bars[j] as Bar;
          high = Math.max(high, bar.high);
          low = Math.min(low, bar.low);
        }
        const close = (bars[i] as Bar).close;
        k[i] = high === low ? 50 : ((close - low) / (high - low)) * 100;
      }
      const compact = k.filter((v): v is number => v !== null);
      const dCompact = sma(compact, params.smooth ?? 3);
      const d: Series = k.map(() => null);
      let cursor = 0;
      for (let i = 0; i < k.length; i += 1) {
        if (k[i] === null) continue;
        d[i] = dCompact[cursor] ?? null;
        cursor += 1;
      }
      return [
        { key: 'k', kind: 'line', data: k },
        { key: 'd', kind: 'line', data: d },
      ];
    },
  },
];

export const INDICATOR_MAP = new Map(INDICATOR_DEFS.map((d) => [d.id, d]));

export function defaultParams(def: IndicatorDef): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of def.params) out[p.key] = p.def;
  return out;
}

export const INDICATOR_COLORS = ['#7aa2ff', '#f6c66b', '#a78bfa', '#46d7a4', '#ff9f6b', '#65c7e8'];

/** Last defined value of a series, for the legend. */
export function lastValue(series: Series): number | null {
  for (let i = series.length - 1; i >= 0; i -= 1) {
    const v = series[i];
    if (v !== null && v !== undefined && Number.isFinite(v)) return v;
  }
  return null;
}
