import { describe, expect, it } from 'vitest';
import { INSTRUMENTS, instrumentById, instrumentBySymbol, searchInstruments, INTERVALS } from '../src/domain/instruments';

describe('instrument master', () => {
  it('uses unique stable ids', () => {
    const ids = new Set(INSTRUMENTS.map((i) => i.id));
    expect(ids.size).toBe(INSTRUMENTS.length);
  });

  it('keeps spot metals distinct from futures history mappings', () => {
    const gold = instrumentBySymbol('XAUUSD');
    expect(gold?.assetClass).toBe('metal');
    expect(gold?.providerSymbol).toBe('GC=F');
    expect(gold?.referenceId).toBe('OANDA:XAUUSD');
    expect(gold?.note).toMatch(/separately/i);
  });

  it('resolves every instrument by id and symbol', () => {
    for (const instrument of INSTRUMENTS) {
      expect(instrumentById(instrument.id)?.symbol).toBe(instrument.symbol);
      expect(instrumentBySymbol(instrument.symbol)?.id).toBe(instrument.id);
    }
  });

  it('has a positive tick size and digits that match it', () => {
    for (const instrument of INSTRUMENTS) {
      expect(instrument.tickSize).toBeGreaterThan(0);
      expect(instrument.digits).toBeGreaterThanOrEqual(0);
      expect(Number(instrument.tickSize.toFixed(instrument.digits))).toBeCloseTo(instrument.tickSize, 10);
    }
  });
});

describe('search', () => {
  it('ranks an exact symbol first', () => {
    const hits = searchInstruments('EURUSD');
    expect(hits[0]?.instrument.symbol).toBe('EURUSD');
  });

  it('resolves the gold alias', () => {
    expect(searchInstruments('gold')[0]?.instrument.symbol).toBe('XAUUSD');
  });

  it('returns nothing for an unknown query', () => {
    expect(searchInstruments('ZZZZZZ')).toHaveLength(0);
  });

  it('is case insensitive', () => {
    expect(searchInstruments('btc')[0]?.instrument.symbol).toBe('BTCUSDT');
  });
});

describe('intervals', () => {
  it('declares seconds consistent with the provider keys', () => {
    for (const interval of INTERVALS) {
      expect(interval.seconds).toBeGreaterThan(0);
      expect(interval.binance || interval.yahoo).toBeTruthy();
    }
  });
});
