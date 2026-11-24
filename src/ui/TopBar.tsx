import type { Instrument, Interval } from '../domain/types';
import type { ChartKind } from '../engine/chart';
import { Icon, BrandMark } from './icons';

interface TopBarProps {
  instrument: Instrument;
  interval: Interval;
  kind: ChartKind;
  indicatorCount: number;
  theme: 'dark' | 'light';
  rightOpen: boolean;
  savedLabel: string;
  onSearch: () => void;
  onIntervals: (anchor: HTMLElement) => void;
  onKinds: (anchor: HTMLElement) => void;
  onIndicators: () => void;
  onToggleTheme: () => void;
  onTogglePanel: () => void;
  onFit: () => void;
  onMenu: (anchor: HTMLElement) => void;
}

export function TopBar({
  instrument,
  interval,
  kind,
  indicatorCount,
  theme,
  rightOpen,
  savedLabel,
  onSearch,
  onIntervals,
  onKinds,
  onIndicators,
  onToggleTheme,
  onTogglePanel,
  onFit,
  onMenu,
}: TopBarProps) {
  return (
    <header className="topbar">
      <div className="brand" title="ChartUnlocked">
        <BrandMark />
        <span className="brand-name">
          Chart<span>Unlocked</span>
        </span>
      </div>

      <div className="tb-divider" />

      <button className="sym-btn" onClick={onSearch} title="Search instruments (Ctrl+K)" aria-label="Search instruments">
        <span className="sym-mark">{instrument.mark}</span>
        <span className="sym-text">
          <span className="sym-name">{instrument.symbol}</span>
          <span className="sym-desc">
            {instrument.venueId} · {instrument.name}
          </span>
        </span>
        <span className="caret">
          <Icon name="chevronDown" size={14} />
        </span>
      </button>

      <button className="tb-btn" onClick={(e) => onIntervals(e.currentTarget)} title="Interval" aria-haspopup="menu">
        <span className="tb-label num">{interval.label}</span>
        <span className="caret">
          <Icon name="chevronDown" size={12} />
        </span>
      </button>

      <button className="tb-btn" onClick={(e) => onKinds(e.currentTarget)} title="Chart type" aria-haspopup="menu">
        <Icon name="candle" size={15} />
        <span className="tb-label">{kind === 'candles' ? 'Candles' : kind === 'bars' ? 'Bars' : kind === 'line' ? 'Line' : 'Area'}</span>
        <span className="caret">
          <Icon name="chevronDown" size={12} />
        </span>
      </button>

      <button className="tb-btn" onClick={onIndicators} title="Indicators (I)">
        <Icon name="fx" size={15} />
        <span className="tb-label">Indicators{indicatorCount ? ` · ${indicatorCount}` : ''}</span>
      </button>

      <div className="tb-spacer" />

      <div className="tb-actions">
        <button className="tb-btn icon-only" onClick={onFit} title="Fit chart to screen" aria-label="Fit chart">
          <Icon name="fit" size={15} />
        </button>
        <button
          className={`tb-btn icon-only${rightOpen ? ' on' : ''}`}
          onClick={onTogglePanel}
          title="Side panel"
          aria-label="Toggle side panel"
          aria-pressed={rightOpen}
        >
          <Icon name="panel" size={15} />
        </button>
        <button className="tb-btn icon-only" onClick={onToggleTheme} title="Light / dark theme" aria-label="Toggle theme">
          <Icon name={theme === 'dark' ? 'moon' : 'sun'} size={15} />
        </button>
        <button className="tb-btn icon-only" onClick={(e) => onMenu(e.currentTarget)} title="More" aria-label="More actions" aria-haspopup="menu">
          <Icon name="dots" size={16} />
        </button>
        <span className="tb-divider" />
        <span className="tb-btn icon-only" title={`Saved state: ${savedLabel}`} aria-label={`Saved state: ${savedLabel}`} style={{ cursor: 'default' }}>
          <span className={`sb-dot${savedLabel === 'Saved' ? '' : ' warn'}`} />
        </span>
      </div>
    </header>
  );
}
