import { useEffect, useRef } from 'react';
import { Icon } from './icons';

export interface MenuEntry {
  id: string;
  label: string;
  checked?: boolean;
  shortcut?: string;
  disabled?: boolean;
  separator?: boolean;
  onSelect?: () => void;
}

interface MenuProps {
  x: number;
  y: number;
  width?: number;
  entries: MenuEntry[];
  onClose: () => void;
}

export function Menu({ x, y, width = 188, entries, onClose }: MenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const height = Math.min(480, entries.length * 30 + 12);
  const left = Math.min(x, window.innerWidth - width - 8);
  const top = Math.min(y, window.innerHeight - height - 8);

  return (
    <div className="menu" style={{ left, top, width }} ref={ref} role="menu">
      {entries.map((entry) =>
        entry.separator ? (
          <div className="menu-sep" key={entry.id} />
        ) : (
          <button
            key={entry.id}
            className={`menu-item${entry.checked ? ' on' : ''}`}
            role="menuitem"
            disabled={entry.disabled}
            onClick={() => {
              entry.onSelect?.();
              onClose();
            }}
            style={entry.disabled ? { opacity: 0.45, cursor: 'default' } : undefined}
          >
            <span>{entry.label}</span>
            {entry.checked ? (
              <span className="tick">
                <Icon name="check" size={13} />
              </span>
            ) : entry.shortcut ? (
              <span className="kbd">{entry.shortcut}</span>
            ) : null}
          </button>
        ),
      )}
    </div>
  );
}
