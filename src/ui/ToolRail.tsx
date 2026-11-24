import type { ToolKind } from '../engine/drawings';
import { TOOLS } from '../engine/drawings';
import { Icon, type IconName } from './icons';

const ICONS: Record<ToolKind, IconName> = {
  cursor: 'cursor',
  trend: 'trend',
  hline: 'hline',
  vline: 'vline',
  rect: 'rect',
  fib: 'fib',
  measure: 'measure',
  text: 'text',
};

interface ToolRailProps {
  tool: ToolKind;
  onTool: (tool: ToolKind) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onDelete: () => void;
  canDelete: boolean;
  onClear: () => void;
}

export function ToolRail({ tool, onTool, onUndo, onRedo, canUndo, canRedo, onDelete, canDelete, onClear }: ToolRailProps) {
  return (
    <nav className="toolrail" aria-label="Drawing tools">
      {TOOLS.map((item) => (
        <div key={item.id} style={{ display: 'contents' }}>
          {item.id === 'trend' ? <div className="rail-sep" /> : null}
          <button
            className={`rail-btn${tool === item.id ? ' on' : ''}`}
            onClick={() => onTool(item.id)}
            title={`${item.label} — ${item.hint}`}
            aria-label={item.label}
            aria-pressed={tool === item.id}
          >
            <Icon name={ICONS[item.id]} size={17} />
          </button>
        </div>
      ))}
      <div className="rail-sep" />
      <button className="rail-btn" onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)" aria-label="Undo">
        <Icon name="undo" size={17} />
      </button>
      <button className="rail-btn" onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)" aria-label="Redo">
        <Icon name="redo" size={17} />
      </button>
      <button className="rail-btn" onClick={onDelete} disabled={!canDelete} title="Delete selected (Del)" aria-label="Delete selected">
        <Icon name="trash" size={17} />
      </button>
      <div className="rail-sep" />
      <button className="rail-btn" onClick={onClear} title="Clear drawings on this instrument" aria-label="Clear drawings">
        <Icon name="close" size={16} />
      </button>
    </nav>
  );
}
