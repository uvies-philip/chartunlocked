import { describe, expect, it } from 'vitest';
import { fixtureBars, stripRelay, unwrapRelay } from '../src/data/providers';
import { instrumentBySymbol, intervalById } from '../src/domain/instruments';

describe('unwrapRelay', () => {
  it('unwraps the envelope form when data is an object', () => {
    const payload = { code: 200, status: 'OK', data: { 'EURUSD=X': { fulldayPrice: 1.09 } }, meta: {} };
    expect(unwrapRelay(payload)).toEqual({ 'EURUSD=X': { fulldayPrice: 1.09 } });
  });

  it('unwraps the reader-page form, parsing the content string', () => {
    const payload = {
      title: '',
      description: '',
      url: 'https://query1.finance.yahoo.com/x',
      finalUrl: 'https://query1.finance.yahoo.com/x',
      content: '{"EURUSD=X":{"fulldayPrice":1.09}}',
      httpStatus: 200,
    };
    expect(unwrapRelay(payload)).toEqual({ 'EURUSD=X': { fulldayPrice: 1.09 } });
  });

  it('unwraps an envelope whose data is a reader page', () => {
    const payload = { code: 200, status: 'OK', data: { url: 'u', content: '[{"a":1}]', httpStatus: 200 }, meta: {} };
    expect(unwrapRelay(payload)).toEqual([{ a: 1 }]);
  });

  it('throws on an upstream error status', () => {
    expect(() => unwrapRelay({ url: 'u', content: 'nope', httpStatus: 429 })).toThrow('UPSTREAM_429');
  });

  it('passes through a payload that is already the provider body', () => {
    const payload = { 'GC=F': { fulldayPrice: 3621.1 } };
    expect(unwrapRelay(payload)).toBe(payload);
  });

  it('leaves a provider object with only a data field alone', () => {
    const payload = { data: 5 };
    expect(unwrapRelay(payload)).toBe(payload);
  });
});

describe('stripRelay', () => {
  it('leaves a raw JSON array of objects intact', () => {
    const payload = '[{"symbol":"BTCUSDT","lastPrice":"60000.00"}]';
    expect(JSON.parse(stripRelay(payload))).toHaveLength(1);
  });

  it('leaves a raw JSON object intact', () => {
    const payload = '{"close":1.09}';
    expect(JSON.parse(stripRelay(payload))).toEqual({ close: 1.09 });
  });

  it('strips a relay preamble before an object', () => {
    const payload = 'Title: x\n\nURL Source: y\n\nMarkdown Content:\n{"close":1.09}';
    expect(JSON.parse(stripRelay(payload))).toEqual({ close: 1.09 });
  });

  it('strips a relay preamble before an array', () => {
    const payload = 'Title: x\n\nMarkdown Content:\n[{"close":1.09}]';
    expect(JSON.parse(stripRelay(payload))).toHaveLength(1);
  });

  it('does not truncate an array at its first inner brace', () => {
    const payload = '[{"a":1},{"b":2}]';
    const parsed: unknown = JSON.parse(stripRelay(payload));
    expect(Array.isArray(parsed)).toBe(true);
    expect((parsed as unknown[]).length).toBe(2);
  });
});

describe('fixture bars', () => {
  it('is deterministic for the same instrument and interval', () => {
    const instrument = instrumentBySymbol('EURUSD')!;
    const interval = intervalById('15m');
    const a = fixtureBars(instrument, interval, 50);
    const b = fixtureBars(instrument, interval, 50);
    expect(a.map((x) => x.time)).toEqual(b.map((x) => x.time));
    expect(a.map((x) => x.close)).toEqual(b.map((x) => x.close));
  });

  it('produces valid OHLC ordering', () => {
    const instrument = instrumentBySymbol('BTCUSDT')!;
    for (const bar of fixtureBars(instrument, intervalById('5m'), 80)) {
      expect(bar.high).toBeGreaterThanOrEqual(Math.max(bar.open, bar.close));
      expect(bar.low).toBeLessThanOrEqual(Math.min(bar.open, bar.close));
    }
  });

  it('advances by exactly one interval', () => {
    const instrument = instrumentBySymbol('XAUUSD')!;
    const interval = intervalById('1h');
    const bars = fixtureBars(instrument, interval, 10);
    for (let i = 1; i < bars.length; i += 1) {
      expect((bars[i]!.time - bars[i - 1]!.time)).toBe(interval.seconds);
    }
  });
});
