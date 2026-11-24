// Shared domain contracts. Values that come from outside the app are validated
// before they reach these types; see data/providers.ts.

export type DataMode = 'live' | 'delayed' | 'historical' | 'replay' | 'demo';

export type PriceKind = 'trade' | 'bid' | 'ask' | 'mid' | 'index' | 'settlement';

export type AssetClass =
  | 'fx'
  | 'metal'
  | 'index'
  | 'crypto'
  | 'equity';

export interface Provenance {
  /** Stable provider key, e.g. `binance` or `yahoo`. Never a display name. */
  providerId: string;
  /** Dataset identity, e.g. `binance:klines:15m`. */
  datasetId: string;
  datasetVersion: string;
  mode: DataMode;
  priceKind: PriceKind;
  /** Millisecond epoch of the last successful observation. */
  observedAt: number;
  /** Provider-permitted delay, in milliseconds. Zero when unknown. */
  permittedDelayMs: number;
}

export interface Bar {
  time: number; // UTC seconds, bar open
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
}

export interface Quote {
  value: number;
  eventTime: number; // ms epoch
  provenance: Provenance;
  /** Previous session close as the provider defines it, for daily change. */
  previousClose: number | null;
  changePct: number | null;
}

export interface Instrument {
  id: string;
  symbol: string;
  name: string;
  assetClass: AssetClass;
  venueId: string;
  quoteCurrency: string;
  /** Digits used for display and tick size. */
  digits: number;
  tickSize: number;
  /** Short glyph for the symbol tile. */
  mark: string;
  /** Which adapter supplies history and quotes. */
  provider: 'binance' | 'yahoo';
  /** Provider-native symbol. */
  providerSymbol: string;
  /** TradingView identifier, used only as a labelled reference quote. */
  referenceId: string | null;
  /** Honest note about the series, shown in the instrument panel. */
  note?: string;
}

export interface Interval {
  id: string;
  label: string;
  seconds: number;
  binance: string | null;
  yahoo: string | null;
}

export interface Capability {
  available: boolean;
  reason:
    | 'OK'
    | 'NOT_IMPLEMENTED'
    | 'DATA_UNAVAILABLE'
    | 'LICENSE_REQUIRED'
    | 'PERMISSION_DENIED'
    | 'TEMPORARILY_DEGRADED';
  detail: string;
}
