import type { DataMode, Provenance } from '../domain/types';
import { modeLabel, providerLabels } from '../data/providers';

interface StatusBarProps {
  provenance: Provenance | null;
  mode: DataMode;
  ageMs: number | null;
  bars: number;
  liveState: 'connecting' | 'live' | 'down' | 'idle';
  savedLabel: string;
  lastError: string | null;
}

function ageLabel(ms: number | null): string {
  if (ms === null) return 'no data';
  if (ms < 1500) return 'just now';
  if (ms < 60_000) return `${Math.round(ms / 1000)}s ago`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`;
  return `${Math.round(ms / 3_600_000)}h ago`;
}

export function StatusBar({ provenance, mode, ageMs, bars, liveState, savedLabel, lastError }: StatusBarProps) {
  const provider = provenance ? providerLabels[provenance.providerId] ?? provenance.providerId : 'no provider';
  const dotClass = lastError ? 'bad' : mode === 'demo' ? 'warn' : mode === 'live' ? '' : 'warn';

  return (
    <footer className="statusbar">
      <span className="sb-item">
        <span className={`sb-dot ${dotClass}`} />
        <strong>{provider}</strong>
        <span>· {modeLabel(mode)}</span>
      </span>
      <span className="sb-item sb-hide-sm">data age {ageLabel(ageMs)}</span>
      <span className="sb-item sb-hide-sm num">{bars.toLocaleString('en-GB')} bars</span>
      {liveState === 'live' ? (
        <span className="sb-item">
          <span className="sb-dot" /> streaming
        </span>
      ) : null}
      {lastError ? <span className="sb-item">· {lastError}</span> : null}
      <span className="sb-spacer" />
      <span className="sb-item sb-hide-sm">Africa/Lagos</span>
      <span className="sb-item">{savedLabel}</span>
    </footer>
  );
}
