import type { Bar, DataMode, Instrument, Interval, Provenance, Quote } from '../domain/types';

// Data access. Three adapters, each with its own declared provenance:
//   binance : spot crypto, history plus live trade websocket (same source)
//   yahoo   : delayed history and delayed last price, read through the r.jina.ai
//             text relay because Yahoo sends no CORS headers
//   fixture : deterministic demo series, always labelled DEMO
// A quote from one provider is never folded into bars from another.

const BINANCE_HOSTS = ['https://api.binance.com', 'https://data-api.binance.vision'];
const YAHOO = 'https://query1.finance.yahoo.com';
const TV_SCANNER = 'https://scanner.tradingview.com/symbol';
const relayUrl = (url: string) => `https://r.jina.ai/${url}`;

const YAHOO_RANGE: Record<string, string> = {
  '1m': '7d',
  '5m': '60d',
  '15m': '60d',
  '30m': '60d',
  '1h': '730d',
  '1d': '5y',
  '1wk': '10y',
};

/* ------------------------------ utilities ------------------------------- */

const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

const barOf = (time: number, o: unknown, h: unknown, l: unknown, c: unknown, v: unknown): Bar | null => {
  const open = num(o);
  const high = num(h);
  const low = num(l);
  const close = num(c);
  if (open === null || high === null || low === null || close === null) return null;
  if (high < Math.max(open, close) - 1e-9) return null;
  if (low > Math.min(open, close) + 1e-9) return null;
  const volume = num(v);
  return { time, open, high, low, close, volume: volume === null ? null : volume };
};

export function stripRelay(text: string): string {
  const trimmed = text.trimStart();
  // Most provider payloads are already raw JSON. Only strip when a relay
  // preamble is present, and strip to the earliest opening bracket so arrays of
  // objects are not truncated at their first `{`.
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return trimmed;
  const candidates = [text.indexOf('{'), text.indexOf('[')].filter((i) => i >= 0);
  if (!candidates.length) return text;
  return text.slice(Math.min(...candidates));
}

async function getJson(url: string, timeoutMs = 15_000): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    return JSON.parse(stripRelay(text));
  } finally {
    clearTimeout(timer);
  }
}

/* --------------------------------- relay -------------------------------- */

// r.jina.ai allows roughly twenty requests a minute per IP. Space calls and back
// off hard on 429 rather than hammering it.
const relay = { lastAt: 0, cooldownUntil: 0, minGapMs: 1100 };

// Provider failures are recorded rather than swallowed, so the UI and support
// tooling can explain why a value is missing.
let lastProviderError: string | null = null;
export function getLastProviderError(): string | null {
  return lastProviderError;
}
const noteError = (where: string, error: unknown): void => {
  lastProviderError = `${where}: ${error instanceof Error ? error.message : String(error)}`;
};

let lastSparkDebug: unknown = null;
export function getLastSparkDebug(): unknown {
  return lastSparkDebug;
}

/**
 * The relay is not a transparent pipe: for some upstream content types it wraps
 * the body in its own `{code,status,data}` envelope, and `data` may itself be a
 * JSON string. Unwrap before any provider-specific parsing.
 */
export function unwrapRelay(payload: unknown, depth = 0): unknown {
  if (depth > 3 || !payload || typeof payload !== 'object') return payload;
  const record = payload as Record<string, unknown>;

  // Envelope form: { code, status, data }.
  if ('code' in record && 'data' in record) return unwrapRelay(record.data, depth + 1);

  // Reader-page form: { title, url, content, httpStatus }. The provider body
  // arrives as a string in `content`.
  if (typeof record.content === 'string' && ('httpStatus' in record || 'finalUrl' in record)) {
    const status = Number(record.httpStatus);
    if (Number.isFinite(status) && status >= 400) throw new Error(`UPSTREAM_${status}`);
    try {
      return JSON.parse(stripRelay(record.content));
    } catch {
      return record.content;
    }
  }

  return payload;
}

async function relayGet(url: string): Promise<unknown> {
  const now = Date.now();
  if (now < relay.cooldownUntil) throw new Error('RELAY_COOLING');
  const wait = relay.lastAt + relay.minGapMs - now;
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  relay.lastAt = Date.now();
  try {
    return unwrapRelay(await getJson(relayUrl(url), 20_000));
  } catch (error) {
    noteError('relay', error);
    if (String(error).includes('429')) relay.cooldownUntil = Date.now() + 45_000;
    throw error;
  }
}

/* -------------------------------- binance ------------------------------- */

async function binanceGet(path: string): Promise<unknown> {
  let lastError: unknown = null;
  for (const host of BINANCE_HOSTS) {
    try {
      return await getJson(`${host}${path}`, 12_000);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('BINANCE_UNAVAILABLE');
}

/* ------------------------------- fixtures ------------------------------- */

// Deterministic demo series. Used only when the network fails or ?demo=1 is set,
// and always reported with mode 'demo' so the UI can label it.
export function fixtureBars(instrument: Instrument, interval: Interval, count = 400): Bar[] {
  const seedBase = [...instrument.symbol].reduce((a, c) => a + c.charCodeAt(0), 0);
  const step = interval.seconds;
  const end = Math.floor(Date.now() / 1000 / step) * step;
  const startPrice = instrument.assetClass === 'crypto' ? 60000 : instrument.assetClass === 'fx' ? 1.09 : 3600;
  const volatility = instrument.assetClass === 'fx' ? 0.0004 : startPrice * 0.004;
  let price = startPrice;
  const bars: Bar[] = [];
  let rng = seedBase * 7919;
  const rand = () => {
    rng = (rng * 1103515245 + 12345) % 2147483648;
    return rng / 2147483648;
  };
  for (let i = count - 1; i >= 0; i -= 1) {
    const open = price;
    const drift = (rand() - 0.48) * volatility;
    const close = Math.max(startPrice * 0.5, open + drift);
    const high = Math.max(open, close) + rand() * volatility * 0.6;
    const low = Math.min(open, close) - rand() * volatility * 0.6;
    bars.push({ time: end - i * step, open, high, low, close, volume: instrument.provider === 'binance' ? 100 + rand() * 900 : null });
    price = close;
  }
  return bars;
}

/* ------------------------------- history -------------------------------- */

export interface HistoryResult {
  bars: Bar[];
  provenance: Provenance;
  previousClose: number | null;
}

function provenance(instrument: Instrument, interval: Interval, mode: DataMode, providerId: string, delayMs: number): Provenance {
  return {
    providerId,
    datasetId: `${providerId}:history:${instrument.symbol}:${interval.id}`,
    datasetVersion: '1',
    mode,
    priceKind: 'trade',
    observedAt: Date.now(),
    permittedDelayMs: delayMs,
  };
}

function normaliseYahoo(payload: unknown): { bars: Bar[]; previousClose: number | null } {
  const result = (payload as { chart?: { result?: unknown[] } }).chart?.result?.[0] as
    | {
        timestamp?: number[];
        meta?: { chartPreviousClose?: number; previousClose?: number };
        indicators?: { quote?: { open?: (number | null)[]; high?: (number | null)[]; low?: (number | null)[]; close?: (number | null)[]; volume?: (number | null)[] }[] };
      }
    | undefined;
  const quote = result?.indicators?.quote?.[0];
  const stamps = result?.timestamp;
  if (!quote || !stamps) return { bars: [], previousClose: null };
  const bars: Bar[] = [];
  for (let i = 0; i < stamps.length; i += 1) {
    const time = stamps[i];
    if (typeof time !== 'number') continue;
    const bar = barOf(time, quote.open?.[i], quote.high?.[i], quote.low?.[i], quote.close?.[i], quote.volume?.[i]);
    if (bar) bars.push(bar);
  }
  bars.sort((a, b) => a.time - b.time);
  const prev = num(result?.meta?.chartPreviousClose) ?? num(result?.meta?.previousClose);
  return { bars, previousClose: prev };
}

export async function fetchHistory(instrument: Instrument, interval: Interval, force = false): Promise<HistoryResult> {
  const key = `${instrument.id}|${interval.id}`;
  const cached = historyCache.get(key);
  if (!force && cached && Date.now() - cached.at < 20_000) return cached.value;

  try {
    if (instrument.provider === 'binance') {
      if (!interval.binance) throw new Error('INTERVAL_UNSUPPORTED');
      const raw = await binanceGet(`/api/v3/klines?symbol=${instrument.providerSymbol}&interval=${interval.binance}&limit=1000`);
      if (!Array.isArray(raw)) throw new Error('BAD_PAYLOAD');
      const bars: Bar[] = [];
      for (const row of raw) {
        if (!Array.isArray(row)) continue;
        const time = num(row[0]);
        if (time === null) continue;
        const bar = barOf(Math.floor(time / 1000), row[1], row[2], row[3], row[4], row[5]);
        if (bar) bars.push(bar);
      }
      if (!bars.length) throw new Error('EMPTY');
      const value: HistoryResult = { bars, provenance: provenance(instrument, interval, 'live', 'binance', 0), previousClose: bars[bars.length - 2]?.close ?? null };
      historyCache.set(key, { at: Date.now(), value });
      return value;
    }

    if (!interval.yahoo) throw new Error('INTERVAL_UNSUPPORTED');
    const range = YAHOO_RANGE[interval.yahoo] ?? '60d';
    const payload = await relayGet(`${YAHOO}/v8/finance/chart/${encodeURIComponent(instrument.providerSymbol)}?interval=${interval.yahoo}&range=${range}`);
    const { bars, previousClose } = normaliseYahoo(payload);
    if (!bars.length) throw new Error('EMPTY');
    const value: HistoryResult = {
      bars,
      provenance: provenance(instrument, interval, 'delayed', 'yahoo', 15 * 60 * 1000),
      previousClose,
    };
    historyCache.set(key, { at: Date.now(), value });
    return value;
  } catch (error) {
    if (cached) return cached.value;
    return {
      bars: fixtureBars(instrument, interval),
      provenance: provenance(instrument, interval, 'demo', 'fixture', 0),
      previousClose: null,
    };
  }
}

const historyCache = new Map<string, { at: number; value: HistoryResult }>();

/* -------------------------------- quotes -------------------------------- */

export async function fetchQuote(instrument: Instrument): Promise<Quote | null> {
  try {
    if (instrument.provider === 'binance') {
      const raw = (await binanceGet(`/api/v3/ticker/24hr?symbol=${instrument.providerSymbol}`)) as { lastPrice?: string; openPrice?: string; priceChangePercent?: string };
      const price = num(raw?.lastPrice);
      if (price === null) return null;
      const open = num(raw?.openPrice);
      return {
        value: price,
        eventTime: Date.now(),
        previousClose: open,
        changePct: num(raw?.priceChangePercent),
        provenance: provenance(instrument, { id: 'tick', seconds: 1, binance: null, yahoo: null, label: 'tick' }, 'live', 'binance', 0),
      };
    }
    const payload = await relayGet(`${YAHOO}/v8/finance/chart/${encodeURIComponent(instrument.providerSymbol)}?interval=1m&range=1d`);
    const result = (payload as { chart?: { result?: { meta?: { regularMarketPrice?: number; regularMarketTime?: number; previousClose?: number; chartPreviousClose?: number } }[] } }).chart?.result?.[0];
    const price = num(result?.meta?.regularMarketPrice);
    if (price === null) return null;
    const eventTime = num(result?.meta?.regularMarketTime);
    const previousClose = num(result?.meta?.previousClose) ?? num(result?.meta?.chartPreviousClose);
    return {
      value: price,
      eventTime: eventTime ? eventTime * 1000 : Date.now(),
      previousClose,
      changePct: previousClose && previousClose > 0 ? ((price - previousClose) / previousClose) * 100 : null,
      provenance: provenance(instrument, { id: 'tick', seconds: 1, binance: null, yahoo: null, label: 'tick' }, 'delayed', 'yahoo', 15 * 60 * 1000),
    };
  } catch (error) {
    noteError('quote', error);
    return null;
  }
}

export interface WatchQuote {
  price: number;
  changePct: number | null;
  mode: DataMode;
}

/** One batched request per provider for the whole watchlist. */
export async function fetchWatchQuotes(
  instruments: Instrument[],
  onBatch?: (batch: Record<string, WatchQuote>) => void,
): Promise<Record<string, WatchQuote>> {
  const out: Record<string, WatchQuote> = {};
  const crypto = instruments.filter((i) => i.provider === 'binance');
  const yahoo = instruments.filter((i) => i.provider === 'yahoo');

  if (crypto.length) {
    try {
      const symbols = encodeURIComponent(JSON.stringify(crypto.map((c) => c.providerSymbol)));
      const raw = (await binanceGet(`/api/v3/ticker/24hr?symbols=${symbols}`)) as { symbol: string; lastPrice: string; priceChangePercent: string }[];
      const batch: Record<string, WatchQuote> = {};
      for (const row of raw) {
        const price = num(row.lastPrice);
        const change = num(row.priceChangePercent);
        const instrument = crypto.find((c) => c.providerSymbol === row.symbol);
        if (instrument && price !== null) batch[instrument.id] = { price, changePct: change, mode: 'live' };
      }
      Object.assign(out, batch);
      onBatch?.(batch);
    } catch (error) {
      noteError('watch:crypto', error);
    }
  }

  if (yahoo.length) {
    try {
      const list = yahoo.map((i) => i.providerSymbol).join(',');
      const payload = await relayGet(`${YAHOO}/v8/finance/spark?symbols=${encodeURIComponent(list)}&range=1d&interval=15m`);
      lastSparkDebug = payload;
      const batch: Record<string, WatchQuote> = {};
      // The relay returns either {spark:{result:[...]}} or a flat map keyed by
      // symbol, depending on which endpoint answers. Accept both.
      const nested = (payload as { spark?: { result?: unknown[] } }).spark?.result;
      const rows: { symbol?: string; price?: number; change?: number }[] = [];
      if (Array.isArray(nested)) {
        for (const row of nested) {
          const entry = row as {
            symbol?: string;
            response?: { meta?: { regularMarketPrice?: number; chartPreviousClose?: number }; indicators?: { quote?: { close?: (number | null)[] }[] } }[];
          };
          const response = entry.response?.[0];
          const closes = (response?.indicators?.quote?.[0]?.close ?? []).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
          const price = num(response?.meta?.regularMarketPrice) ?? (closes.length ? (closes[closes.length - 1] as number) : null);
          const prev = num(response?.meta?.chartPreviousClose);
          rows.push({ symbol: entry.symbol, price: price ?? undefined, change: price !== null && prev !== null ? price - prev : undefined });
        }
      } else if (payload && typeof payload === 'object') {
        for (const [symbol, value] of Object.entries(payload as Record<string, unknown>)) {
          const entry = value as { fulldayPrice?: number; fulldayChange?: number; close?: (number | null)[]; symbol?: string };
          const closes = Array.isArray(entry.close) ? entry.close.filter((v): v is number => typeof v === 'number' && Number.isFinite(v)) : [];
          const price = num(entry.fulldayPrice) ?? (closes.length ? (closes[closes.length - 1] as number) : null);
          const change = num(entry.fulldayChange);
          rows.push({ symbol: entry.symbol ?? symbol, price: price ?? undefined, change: change ?? undefined });
        }
      }
      for (const row of rows) {
        if (!row.symbol || row.price === undefined) continue;
        const instrument = yahoo.find((i) => i.providerSymbol === row.symbol);
        if (!instrument) continue;
        const prev = row.change !== undefined ? row.price - row.change : null;
        batch[instrument.id] = {
          price: row.price,
          changePct: prev && prev > 0 ? (row.change! / prev) * 100 : null,
          mode: 'delayed',
        };
      }
      Object.assign(out, batch);
      onBatch?.(batch);
    } catch (error) {
      noteError('watch:yahoo', error);
    }
  }
  return out;
}

/**
 * Reference quote from TradingView's public scanner, used ONLY as a labelled
 * comparison. It is never written into bars from another provider.
 */
export async function fetchReference(instrument: Instrument): Promise<{ value: number; changePct: number | null } | null> {
  if (!instrument.referenceId) return null;
  try {
    const raw = (await getJson(`${TV_SCANNER}?symbol=${encodeURIComponent(instrument.referenceId)}&fields=close,change`, 9000)) as {
      close?: number;
      change?: number;
    };
    const value = num(raw?.close);
    if (value === null) return null;
    return { value, changePct: num(raw?.change) };
  } catch {
    return null;
  }
}

/* ------------------------------- live trades ---------------------------- */

const WS_HOSTS = ['wss://stream.binance.com:9443', 'wss://data-stream.binance.vision'];

export function streamTrades(instrument: Instrument, onTick: (price: number, eventTime: number) => void, onState: (state: 'connecting' | 'live' | 'down') => void): () => void {
  if (instrument.provider !== 'binance') {
    onState('down');
    return () => {};
  }
  let closed = false;
  let socket: WebSocket | null = null;
  let hostIndex = 0;
  let attempt = 0;
  let timer: number | undefined;
  let lastMessageAt = Date.now();

  const schedule = () => {
    if (closed) return;
    window.clearTimeout(timer);
    timer = window.setTimeout(connect, Math.min(15_000, 800 * 2 ** attempt));
    attempt += 1;
  };

  const connect = () => {
    if (closed) return;
    onState('connecting');
    try {
      socket = new WebSocket(`${WS_HOSTS[hostIndex]}/ws/${instrument.providerSymbol.toLowerCase()}@trade`);
    } catch {
      schedule();
      return;
    }
    socket.onopen = () => {
      attempt = 0;
      onState('live');
    };
    socket.onmessage = (event: MessageEvent<string>) => {
      lastMessageAt = Date.now();
      try {
        const payload = JSON.parse(event.data) as { p?: string; T?: number };
        const price = num(payload.p);
        if (price !== null) onTick(price, payload.T ?? Date.now());
      } catch {
        /* ignore malformed frame */
      }
    };
    socket.onerror = () => {};
    socket.onclose = () => {
      onState('down');
      if (!closed) {
        hostIndex = (hostIndex + 1) % WS_HOSTS.length;
        schedule();
      }
    };
  };

  const watchdog = window.setInterval(() => {
    if (Date.now() - lastMessageAt > 25_000) {
      try {
        socket?.close();
      } catch {
        /* ignore */
      }
    }
  }, 10_000);

  connect();
  return () => {
    closed = true;
    window.clearTimeout(timer);
    window.clearInterval(watchdog);
    try {
      socket?.close();
    } catch {
      /* ignore */
    }
  };
}

export function clearProviderCaches(): void {
  historyCache.clear();
  relay.cooldownUntil = 0;
}

export const providerLabels: Record<string, string> = {
  binance: 'Binance',
  yahoo: 'Yahoo Finance',
  fixture: 'Demo fixture',
};

export function modeLabel(mode: DataMode): string {
  switch (mode) {
    case 'live':
      return 'Live';
    case 'delayed':
      return 'Delayed';
    case 'historical':
      return 'Historical';
    case 'replay':
      return 'Replay';
    case 'demo':
      return 'Demo data';
    default:
      return 'Unknown';
  }
}
