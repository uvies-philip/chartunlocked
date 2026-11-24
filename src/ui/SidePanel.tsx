import type { Instrument, Provenance } from '../domain/types';
import type { WatchQuote } from '../data/providers';
import { modeLabel, providerLabels } from '../data/providers';
import { instrumentById } from '../domain/instruments';

interface SidePanelProps {
  panel: 'watch' | 'instrument' | 'sources';
  onPanel: (panel: 'watch' | 'instrument' | 'sources') => void;
  watchlist: string[];
  quotes: Record<string, WatchQuote>;
  activeId: string;
  onSelect: (id: string) => void;
  instrument: Instrument;
  provenance: Provenance | null;
  reference: { value: number; changePct: number | null } | null;
  quote: number | null;
  digits: number;
  bars: number;
  savedLabel: string;
  migrationNote: string | null;
}

const fmt = (value: number | null | undefined, digits: number) =>
  value === null || value === undefined || !Number.isFinite(value)
    ? '—'
    : value.toLocaleString('en-GB', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export function SidePanel({
  panel,
  onPanel,
  watchlist,
  quotes,
  activeId,
  onSelect,
  instrument,
  provenance,
  reference,
  quote,
  digits,
  bars,
  savedLabel,
  migrationNote,
}: SidePanelProps) {
  return (
    <aside className="sidepanel" aria-label="Side panel">
      <div className="panel-tabs" role="tablist">
        {(['watch', 'instrument', 'sources'] as const).map((id) => (
          <button
            key={id}
            className={`panel-tab${panel === id ? ' on' : ''}`}
            role="tab"
            aria-selected={panel === id}
            onClick={() => onPanel(id)}
          >
            {id === 'watch' ? 'Watchlist' : id === 'instrument' ? 'Instrument' : 'Sources'}
          </button>
        ))}
      </div>

      <div className="panel-body">
        {panel === 'watch' ? (
          <>
            <div className="wl-head">
              <span>Symbol</span>
              <span>Last</span>
              <span>Chg %</span>
            </div>
            {watchlist.map((id) => {
              const item = instrumentById(id);
              if (!item) return null;
              const q = quotes[id];
              const change = q?.changePct ?? null;
              return (
                <button
                  key={id}
                  className={`wl-row${id === activeId ? ' on' : ''}`}
                  onClick={() => onSelect(id)}
                  aria-current={id === activeId}
                >
                  <span className="wl-sym">
                    <span className="wl-dot">{item.mark}</span>
                    <span className="wl-name">{item.symbol}</span>
                  </span>
                  <span className="wl-price num">{fmt(q?.price, item.digits)}</span>
                  <span className={`wl-chg num ${change === null ? '' : change >= 0 ? 'up' : 'down'}`}>
                    {change === null ? '—' : `${change >= 0 ? '+' : ''}${change.toFixed(2)}`}
                  </span>
                </button>
              );
            })}
            <div className="panel-section">
              <p className="note">
                {migrationNote ??
                  'Prices update from the same provider that supplies the candles. Nothing is blended across feeds.'}
              </p>
            </div>
          </>
        ) : null}

        {panel === 'instrument' ? (
          <>
            <div className="panel-section">
              <h4>Identity</h4>
              <dl className="kv">
                <dt>Name</dt>
                <dd>{instrument.name}</dd>
                <dt>Symbol</dt>
                <dd className="num">{instrument.symbol}</dd>
                <dt>Asset class</dt>
                <dd>{instrument.assetClass}</dd>
                <dt>Venue</dt>
                <dd>{instrument.venueId}</dd>
                <dt>Currency</dt>
                <dd>{instrument.quoteCurrency}</dd>
                <dt>Tick size</dt>
                <dd className="num">{instrument.tickSize}</dd>
              </dl>
              <p className="mono-id">{instrument.id}</p>
            </div>

            <div className="panel-section">
              <h4>Data</h4>
              <dl className="kv">
                <dt>Provider</dt>
                <dd>{provenance ? providerLabels[provenance.providerId] ?? provenance.providerId : '—'}</dd>
                <dt>Mode</dt>
                <dd>{provenance ? modeLabel(provenance.mode) : '—'}</dd>
                <dt>Price kind</dt>
                <dd>{provenance ? provenance.priceKind : '—'}</dd>
                <dt>Bars</dt>
                <dd className="num">{bars.toLocaleString('en-GB')}</dd>
                <dt>Provider last</dt>
                <dd className="num">{fmt(quote, digits)}</dd>
                <dt>Reference last</dt>
                <dd className="num">{reference ? fmt(reference.value, digits) : '—'}</dd>
                <dt>Difference</dt>
                <dd className="num">
                  {reference && quote !== null ? `${(quote - reference.value >= 0 ? '+' : '')}${fmt(quote - reference.value, digits)}` : '—'}
                </dd>
                <dt>Saved</dt>
                <dd>{savedLabel}</dd>
              </dl>
              <p className="note">
                The reference quote comes from TradingView's public scanner and is shown only for comparison. Candles stay exactly as the
                provider published them, so the two can legitimately differ by the feed delay or contract.
              </p>
              {instrument.note ? <p className="note">{instrument.note}</p> : null}
            </div>
          </>
        ) : null}

        {panel === 'sources' ? (
          <div className="panel-section">
            <h4>Where the data comes from</h4>
            <dl className="kv">
              <dt>Crypto candles</dt>
              <dd>Binance public REST</dd>
              <dt>Crypto ticks</dt>
              <dd>Binance trade socket</dd>
              <dt>FX, metals, indices, stocks</dt>
              <dd>Yahoo Finance via the r.jina.ai relay</dd>
              <dt>Reference quote</dt>
              <dd>TradingView scanner (comparison only)</dd>
            </dl>
            <p className="note">
              No API key is required. Non-crypto history is delayed by the provider, typically 1 to 15 minutes, and the relay allows roughly
              twenty requests a minute, so the app spaces its calls and caches each series.
            </p>
            <p className="note">
              Gold history is the COMEX front month while the reference is spot. They are shown side by side and never merged, so no synthetic
              price is presented as a traded candle.
            </p>
            <p className="note">
              This build does not redistribute licensed data. Add a provider with documented redistribution rights before offering this as a
              public service.
            </p>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
