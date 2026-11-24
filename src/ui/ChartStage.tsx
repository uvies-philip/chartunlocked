import type { Bar, DataMode, Instrument, Interval, Provenance } from '../domain/types';
import { modeLabel } from '../data/providers';

export interface IndicatorRow {
  key: string;
  label: string;
  color: string;
  value: number | null;
}

interface LegendProps {
  instrument: Instrument;
  interval: Interval;
  bar: Bar | null;
  previousClose: number | null;
  changePct: number | null;
  provenance: Provenance | null;
  mode: DataMode;
  indicatorRows: IndicatorRow[];
  digits: number;
}

const fmt = (value: number, digits: number) =>
  value.toLocaleString('en-GB', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export function Legend({ instrument, interval, bar, previousClose, changePct, provenance, mode, indicatorRows, digits }: LegendProps) {
  const price = bar ? bar.close : null;
  const change = bar && previousClose ? bar.close - previousClose : null;
  const pct = changePct ?? (change !== null && previousClose ? (change / previousClose) * 100 : null);
  const up = (change ?? pct ?? 0) >= 0;
  const showVolume = Boolean(bar && (bar.volume ?? 0) > 0);

  return (
    <div className="legend">
      <div className="legend-row">
        <span className="legend-title">{instrument.symbol}</span>
        <span className="legend-tag">{instrument.venueId}</span>
        <span className="legend-tag num">{interval.label}</span>
        <span className={`legend-tag${mode === 'demo' ? ' demo' : ''}`} title={provenance ? `${provenance.providerId} · ${provenance.datasetId}` : undefined}>
          {modeLabel(mode)}
        </span>
        {price !== null ? <span className={`legend-price num ${up ? 'up' : 'down'}`}>{fmt(price, digits)}</span> : null}
      </div>

      {bar ? (
        <div className="ohlc num">
          <span>
            O <b>{fmt(bar.open, digits)}</b>
          </span>
          <span>
            H <b>{fmt(bar.high, digits)}</b>
          </span>
          <span>
            L <b>{fmt(bar.low, digits)}</b>
          </span>
          <span>
            C <b>{fmt(bar.close, digits)}</b>
          </span>
          {change !== null && pct !== null ? (
            <span className={up ? 'up' : 'down'}>
              <b>
                {up ? '+' : ''}
                {fmt(change, digits)} ({pct >= 0 ? '+' : ''}
                {pct.toFixed(2)}%)
              </b>
            </span>
          ) : pct !== null ? (
            <span className={up ? 'up' : 'down'}>
              <b>
                {pct >= 0 ? '+' : ''}
                {pct.toFixed(2)}%
              </b>
            </span>
          ) : null}
          {showVolume ? (
            <span>
              Vol <b>{Math.round(bar.volume ?? 0).toLocaleString('en-GB')}</b>
            </span>
          ) : null}
        </div>
      ) : null}

      {indicatorRows.length ? (
        <div className="legend-ind num">
          {indicatorRows.map((row) => (
            <span className="legend-ind-item" key={row.key}>
              <span className="legend-dot" style={{ background: row.color }} />
              {row.label}
              <span className="v">{row.value === null ? '—' : fmt(row.value, 2)}</span>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

interface StageStateProps {
  kind: 'loading' | 'error' | 'empty';
  title: string;
  detail: string;
  onRetry?: () => void;
}

export function StageState({ kind, title, detail, onRetry }: StageStateProps) {
  return (
    <div className="stage-state" role="status" aria-live="polite">
      <div className="state-card">
        {kind === 'loading' ? <div className="spinner" /> : null}
        <h3>{title}</h3>
        <p>{detail}</p>
        {onRetry && kind === 'error' ? (
          <div className="state-actions">
            <button className="tb-btn on" onClick={onRetry}>
              Try again
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
