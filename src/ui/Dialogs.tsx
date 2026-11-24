import { useEffect, useMemo, useRef, useState } from 'react';
import { searchInstruments } from '../domain/instruments';
import { INDICATOR_DEFS, type IndicatorInstance } from '../engine/indicators';
import { Icon } from './icons';

interface PaletteProps {
  open: boolean;
  onClose: () => void;
  onPick: (instrumentId: string) => void;
  onCommand: (id: string) => void;
}

const COMMANDS = [
  { id: 'fit', label: 'Fit chart to screen', hint: 'F' },
  { id: 'theme', label: 'Toggle light / dark theme', hint: 'T' },
  { id: 'indicators', label: 'Add indicator', hint: 'I' },
  { id: 'panel', label: 'Toggle side panel', hint: 'P' },
  { id: 'replay', label: 'Replay (not available in this build)', hint: '' },
];

export function Palette({ open, onClose, onPick, onCommand }: PaletteProps) {
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const q = query.trim();
    const instruments = searchInstruments(q, 8).map((hit) => ({
      kind: 'instrument' as const,
      id: hit.instrument.id,
      title: hit.instrument.symbol,
      detail: `${hit.instrument.venueId} · ${hit.instrument.name}`,
      right: hit.instrument.assetClass,
    }));
    const commands = q
      ? COMMANDS.filter((c) => c.label.toLowerCase().includes(q.toLowerCase())).map((c) => ({
          kind: 'command' as const,
          id: c.id,
          title: c.label,
          detail: '',
          right: c.hint,
        }))
      : [];
    return [...instruments, ...commands];
  }, [query]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setCursor(0);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    setCursor(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        setCursor((c) => Math.min(results.length - 1, c + 1));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setCursor((c) => Math.max(0, c - 1));
      } else if (event.key === 'Enter') {
        const item = results[cursor];
        if (!item) return;
        event.preventDefault();
        if (item.kind === 'instrument') onPick(item.id);
        else if (item.id !== 'replay') onCommand(item.id);
        else onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, results, cursor, onPick, onCommand, onClose]);

  if (!open) return null;

  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="palette" role="dialog" aria-label="Search">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search symbol or run a command"
          aria-label="Search symbol or command"
          spellCheck={false}
        />
        <div className="palette-list">
          {results.length === 0 ? (
            <div className="palette-empty">No instrument or command matches “{query}”.</div>
          ) : (
            results.map((item, index) => (
              <button
                key={`${item.kind}:${item.id}`}
                className={`palette-item${index === cursor ? ' on' : ''}`}
                onMouseEnter={() => setCursor(index)}
                onClick={() => {
                  if (item.kind === 'instrument') onPick(item.id);
                  else if (item.id !== 'replay') onCommand(item.id);
                  else onClose();
                }}
              >
                <span className="pl-sym">{item.title}</span>
                <span className="pl-desc">{item.detail}</span>
                <span className="pl-right">{item.right}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

interface IndicatorDialogProps {
  open: boolean;
  onClose: () => void;
  instances: IndicatorInstance[];
  onAdd: (defId: string) => void;
  onRemove: (uid: string) => void;
  onToggle: (uid: string) => void;
}

export function IndicatorDialog({ open, onClose, instances, onAdd, onRemove, onToggle }: IndicatorDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label="Indicators">
        <div className="modal-head">
          <h3>Indicators</h3>
          <button className="tb-btn icon-only" onClick={onClose} aria-label="Close">
            <Icon name="close" size={15} />
          </button>
        </div>
        <div className="modal-body">
          <div className="menu-label">On this chart</div>
          {instances.length === 0 ? (
            <div className="modal-row" style={{ color: 'var(--cu-text-muted)', fontSize: 12 }}>
              None yet. Add one below.
            </div>
          ) : (
            instances.map((instance) => {
              const def = INDICATOR_DEFS.find((d) => d.id === instance.defId);
              return (
                <div className="modal-row" key={instance.uid}>
                  <span className="legend-dot" style={{ background: instance.color, width: 8, height: 8, borderRadius: 2 }} />
                  <span>
                    {def?.name ?? instance.defId}
                    {Object.entries(instance.params).map(([k, v]) => ` ${k}:${v}`).join('')}
                  </span>
                  <span className="mr-right" style={{ display: 'flex', gap: 6 }}>
                    <button className="tb-btn" onClick={() => onToggle(instance.uid)}>
                      {instance.visible ? 'Hide' : 'Show'}
                    </button>
                    <button className="tb-btn" onClick={() => onRemove(instance.uid)} aria-label="Remove indicator">
                      <Icon name="trash" size={14} />
                    </button>
                  </span>
                </div>
              );
            })
          )}
          <div className="menu-label" style={{ marginTop: 6 }}>Add indicator</div>
          {INDICATOR_DEFS.map((def) => (
            <button className="modal-row" key={def.id} onClick={() => onAdd(def.id)}>
              <span>{def.name}</span>
              <span className="mr-desc">{def.full}</span>
              <span className="mr-right">{def.pane === 'pane' ? 'separate pane' : 'overlay'}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
