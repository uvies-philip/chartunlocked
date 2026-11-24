import type { Instrument, Interval } from './types';

// Intervals offered in M1. Each adapter declares its own support; an instrument
// is never shown on an interval its provider cannot supply without a visible
// aggregation note.
export const INTERVALS: Interval[] = [
  { id: '1m', label: '1m', seconds: 60, binance: '1m', yahoo: '1m' },
  { id: '5m', label: '5m', seconds: 300, binance: '5m', yahoo: '5m' },
  { id: '15m', label: '15m', seconds: 900, binance: '15m', yahoo: '15m' },
  { id: '30m', label: '30m', seconds: 1800, binance: '30m', yahoo: '30m' },
  { id: '1h', label: '1H', seconds: 3600, binance: '1h', yahoo: '1h' },
  { id: '1d', label: '1D', seconds: 86400, binance: '1d', yahoo: '1d' },
  { id: '1w', label: '1W', seconds: 604800, binance: '1w', yahoo: '1wk' },
];

export function intervalById(id: string): Interval {
  return INTERVALS.find((i) => i.id === id) ?? INTERVALS[2]!;
}

/**
 * Instrument master. `id` is the stable identity; display symbols are never used
 * as keys, and spot metals are distinct from the futures contracts that happen
 * to share a name.
 */
export const INSTRUMENTS: Instrument[] = [
  // ------------------------------ forex ------------------------------
  { id: 'fx:eurusd', symbol: 'EURUSD', name: 'Euro / US Dollar', assetClass: 'fx', venueId: 'FX_IDC', quoteCurrency: 'USD', digits: 5, tickSize: 0.00001, mark: 'EU', provider: 'yahoo', providerSymbol: 'EURUSD=X', referenceId: 'FX_IDC:EURUSD', note: 'Interbank composite, delayed history' },
  { id: 'fx:gbpusd', symbol: 'GBPUSD', name: 'British Pound / US Dollar', assetClass: 'fx', venueId: 'FX_IDC', quoteCurrency: 'USD', digits: 5, tickSize: 0.00001, mark: 'GB', provider: 'yahoo', providerSymbol: 'GBPUSD=X', referenceId: 'FX_IDC:GBPUSD', note: 'Interbank composite, delayed history' },
  { id: 'fx:usdjpy', symbol: 'USDJPY', name: 'US Dollar / Japanese Yen', assetClass: 'fx', venueId: 'FX_IDC', quoteCurrency: 'JPY', digits: 3, tickSize: 0.001, mark: 'UJ', provider: 'yahoo', providerSymbol: 'JPY=X', referenceId: 'FX_IDC:USDJPY', note: 'Interbank composite, delayed history' },
  { id: 'fx:usdchf', symbol: 'USDCHF', name: 'US Dollar / Swiss Franc', assetClass: 'fx', venueId: 'FX_IDC', quoteCurrency: 'CHF', digits: 5, tickSize: 0.00001, mark: 'UC', provider: 'yahoo', providerSymbol: 'CHF=X', referenceId: 'FX_IDC:USDCHF' },
  { id: 'fx:audusd', symbol: 'AUDUSD', name: 'Australian Dollar / US Dollar', assetClass: 'fx', venueId: 'FX_IDC', quoteCurrency: 'USD', digits: 5, tickSize: 0.00001, mark: 'AU', provider: 'yahoo', providerSymbol: 'AUDUSD=X', referenceId: 'FX_IDC:AUDUSD' },
  { id: 'fx:usdcad', symbol: 'USDCAD', name: 'US Dollar / Canadian Dollar', assetClass: 'fx', venueId: 'FX_IDC', quoteCurrency: 'CAD', digits: 5, tickSize: 0.00001, mark: 'UC', provider: 'yahoo', providerSymbol: 'CAD=X', referenceId: 'FX_IDC:USDCAD' },
  { id: 'fx:eurgbp', symbol: 'EURGBP', name: 'Euro / British Pound', assetClass: 'fx', venueId: 'FX_IDC', quoteCurrency: 'GBP', digits: 5, tickSize: 0.00001, mark: 'EG', provider: 'yahoo', providerSymbol: 'EURGBP=X', referenceId: 'FX_IDC:EURGBP' },
  { id: 'fx:usdngn', symbol: 'USDNGN', name: 'US Dollar / Nigerian Naira', assetClass: 'fx', venueId: 'FX_IDC', quoteCurrency: 'NGN', digits: 2, tickSize: 0.01, mark: 'NG', provider: 'yahoo', providerSymbol: 'USDNGN=X', referenceId: 'FX_IDC:USDNGN', note: 'Reference rate, not an executable quote' },

  // ------------------------------ metals ------------------------------
  { id: 'metal:xauusd', symbol: 'XAUUSD', name: 'Gold spot / US Dollar', assetClass: 'metal', venueId: 'OANDA', quoteCurrency: 'USD', digits: 2, tickSize: 0.01, mark: 'Au', provider: 'yahoo', providerSymbol: 'GC=F', referenceId: 'OANDA:XAUUSD', note: 'History is the COMEX front month; the reference quote is spot. The two are shown separately and never merged.' },
  { id: 'metal:xagusd', symbol: 'XAGUSD', name: 'Silver spot / US Dollar', assetClass: 'metal', venueId: 'OANDA', quoteCurrency: 'USD', digits: 3, tickSize: 0.001, mark: 'Ag', provider: 'yahoo', providerSymbol: 'SI=F', referenceId: 'OANDA:XAGUSD', note: 'History is the COMEX front month; the reference quote is spot. The two are shown separately and never merged.' },

  // ------------------------------ indices -----------------------------
  { id: 'index:ndx', symbol: 'NAS100', name: 'Nasdaq 100', assetClass: 'index', venueId: 'NASDAQ', quoteCurrency: 'USD', digits: 1, tickSize: 0.1, mark: 'NQ', provider: 'yahoo', providerSymbol: '^NDX', referenceId: 'NASDAQ:NDX', note: 'Cash index, delayed' },
  { id: 'index:dji', symbol: 'US30', name: 'Dow Jones Industrial Average', assetClass: 'index', venueId: 'DJ', quoteCurrency: 'USD', digits: 1, tickSize: 0.1, mark: 'DJ', provider: 'yahoo', providerSymbol: '^DJI', referenceId: 'DJ:DJI', note: 'Cash index, delayed' },
  { id: 'index:spx', symbol: 'SPX500', name: 'S&P 500', assetClass: 'index', venueId: 'SP', quoteCurrency: 'USD', digits: 1, tickSize: 0.1, mark: 'SP', provider: 'yahoo', providerSymbol: '^GSPC', referenceId: 'SP:SPX', note: 'Cash index, delayed' },
  { id: 'index:dax', symbol: 'GER40', name: 'DAX 40', assetClass: 'index', venueId: 'XETRA', quoteCurrency: 'EUR', digits: 1, tickSize: 0.1, mark: 'DE', provider: 'yahoo', providerSymbol: '^GDAXI', referenceId: 'XETR:DAX', note: 'Cash index, delayed' },

  // ------------------------------ crypto ------------------------------
  { id: 'crypto:btcusdt', symbol: 'BTCUSDT', name: 'Bitcoin / TetherUS', assetClass: 'crypto', venueId: 'BINANCE', quoteCurrency: 'USDT', digits: 2, tickSize: 0.01, mark: 'BT', provider: 'binance', providerSymbol: 'BTCUSDT', referenceId: 'BINANCE:BTCUSDT', note: 'Spot pair, live trades' },
  { id: 'crypto:ethusdt', symbol: 'ETHUSDT', name: 'Ethereum / TetherUS', assetClass: 'crypto', venueId: 'BINANCE', quoteCurrency: 'USDT', digits: 2, tickSize: 0.01, mark: 'ET', provider: 'binance', providerSymbol: 'ETHUSDT', referenceId: 'BINANCE:ETHUSDT', note: 'Spot pair, live trades' },
  { id: 'crypto:solusdt', symbol: 'SOLUSDT', name: 'Solana / TetherUS', assetClass: 'crypto', venueId: 'BINANCE', quoteCurrency: 'USDT', digits: 3, tickSize: 0.001, mark: 'SO', provider: 'binance', providerSymbol: 'SOLUSDT', referenceId: 'BINANCE:SOLUSDT', note: 'Spot pair, live trades' },
  { id: 'crypto:bnbusdt', symbol: 'BNBUSDT', name: 'BNB / TetherUS', assetClass: 'crypto', venueId: 'BINANCE', quoteCurrency: 'USDT', digits: 2, tickSize: 0.01, mark: 'BN', provider: 'binance', providerSymbol: 'BNBUSDT', referenceId: 'BINANCE:BNBUSDT', note: 'Spot pair, live trades' },
  { id: 'crypto:xrpusdt', symbol: 'XRPUSDT', name: 'XRP / TetherUS', assetClass: 'crypto', venueId: 'BINANCE', quoteCurrency: 'USDT', digits: 4, tickSize: 0.0001, mark: 'XR', provider: 'binance', providerSymbol: 'XRPUSDT', referenceId: 'BINANCE:XRPUSDT', note: 'Spot pair, live trades' },
  { id: 'crypto:dogeusdt', symbol: 'DOGEUSDT', name: 'Dogecoin / TetherUS', assetClass: 'crypto', venueId: 'BINANCE', quoteCurrency: 'USDT', digits: 5, tickSize: 0.00001, mark: 'DO', provider: 'binance', providerSymbol: 'DOGEUSDT', referenceId: 'BINANCE:DOGEUSDT', note: 'Spot pair, live trades' },

  // ------------------------------ equities ----------------------------
  { id: 'eq:aapl', symbol: 'AAPL', name: 'Apple Inc', assetClass: 'equity', venueId: 'NASDAQ', quoteCurrency: 'USD', digits: 2, tickSize: 0.01, mark: 'AA', provider: 'yahoo', providerSymbol: 'AAPL', referenceId: 'NASDAQ:AAPL', note: 'Cash equity, delayed' },
  { id: 'eq:msft', symbol: 'MSFT', name: 'Microsoft Corp', assetClass: 'equity', venueId: 'NASDAQ', quoteCurrency: 'USD', digits: 2, tickSize: 0.01, mark: 'MS', provider: 'yahoo', providerSymbol: 'MSFT', referenceId: 'NASDAQ:MSFT', note: 'Cash equity, delayed' },
  { id: 'eq:nvda', symbol: 'NVDA', name: 'NVIDIA Corp', assetClass: 'equity', venueId: 'NASDAQ', quoteCurrency: 'USD', digits: 2, tickSize: 0.01, mark: 'NV', provider: 'yahoo', providerSymbol: 'NVDA', referenceId: 'NASDAQ:NVDA', note: 'Cash equity, delayed' },
  { id: 'eq:tsla', symbol: 'TSLA', name: 'Tesla Inc', assetClass: 'equity', venueId: 'NASDAQ', quoteCurrency: 'USD', digits: 2, tickSize: 0.01, mark: 'TS', provider: 'yahoo', providerSymbol: 'TSLA', referenceId: 'NASDAQ:TSLA', note: 'Cash equity, delayed' },
];

export function instrumentById(id: string): Instrument | undefined {
  return INSTRUMENTS.find((i) => i.id === id);
}

export function instrumentBySymbol(symbol: string): Instrument | undefined {
  const s = symbol.trim().toUpperCase();
  return INSTRUMENTS.find((i) => i.symbol === s);
}

export const DEFAULT_WATCHLIST = [
  'fx:eurusd',
  'fx:gbpusd',
  'fx:usdjpy',
  'metal:xauusd',
  'index:ndx',
  'crypto:btcusdt',
  'crypto:ethusdt',
  'eq:aapl',
];

const ALIASES: Record<string, string> = {
  GOLD: 'XAUUSD',
  XAU: 'XAUUSD',
  SILVER: 'XAGUSD',
  XAG: 'XAGUSD',
  NASDAQ: 'NAS100',
  NDX: 'NAS100',
  SPX: 'SPX500',
  DOW: 'US30',
  DAX: 'GER40',
  BTC: 'BTCUSDT',
  BITCOIN: 'BTCUSDT',
  ETH: 'ETHUSDT',
  ETHEREUM: 'ETHUSDT',
  SOL: 'SOLUSDT',
  NGN: 'USDNGN',
};

export interface SearchHit {
  instrument: Instrument;
  score: number;
}

/** Case-insensitive search over symbol, name, venue and a small alias table. */
export function searchInstruments(query: string, limit = 12): SearchHit[] {
  const q = query.trim().toUpperCase();
  if (!q) {
    return INSTRUMENTS.slice(0, limit).map((instrument) => ({ instrument, score: 0 }));
  }
  const alias = ALIASES[q];
  const target = alias ?? q;
  const hits: SearchHit[] = [];
  for (const instrument of INSTRUMENTS) {
    let score = -1;
    if (instrument.symbol === target) score = 100;
    else if (instrument.symbol.startsWith(target)) score = 80;
    else if (instrument.name.toUpperCase().includes(target)) score = 55;
    else if (instrument.venueId.toUpperCase().includes(target)) score = 30;
    else if (instrument.symbol.includes(target)) score = 20;
    if (score >= 0) hits.push({ instrument, score });
  }
  hits.sort((a, b) => b.score - a.score || a.instrument.symbol.localeCompare(b.instrument.symbol));
  return hits.slice(0, limit);
}
