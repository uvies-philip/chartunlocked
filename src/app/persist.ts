import type { Drawing } from '../engine/drawings';
import type { IndicatorInstance } from '../engine/indicators';
import type { ChartKind } from '../engine/chart';
import { instrumentBySymbol, instrumentById } from '../domain/instruments';

export interface Workspace {
  version: 2;
  symbolId: string;
  interval: string;
  chartKind: ChartKind;
  theme: 'dark' | 'light';
  indicators: IndicatorInstance[];
  watchlist: string[];
  drawings: Record<string, Drawing[]>;
  panel: 'watch' | 'instrument' | 'sources';
  rightOpen: boolean;
}

export interface MigrationReport {
  ran: boolean;
  importedWatchlist: number;
  importedDrawings: number;
  importedLayout: boolean;
  rejected: string[];
  skippedSecrets: string[];
  backupKey: string | null;
}

const KEY = 'cu.workspace.v2';
const LEGACY_BACKUP = 'cu.legacy.backup.v1';

export const DEFAULT_WORKSPACE: Workspace = {
  version: 2,
  symbolId: 'crypto:btcusdt',
  interval: '15m',
  chartKind: 'candles',
  theme: 'dark',
  indicators: [],
  watchlist: ['fx:eurusd', 'fx:gbpusd', 'fx:usdjpy', 'metal:xauusd', 'index:ndx', 'crypto:btcusdt', 'crypto:ethusdt', 'eq:aapl'],
  drawings: {},
  panel: 'watch',
  rightOpen: true,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function loadWorkspace(): { workspace: Workspace; migration: MigrationReport | null } {
  const migration = migrateLegacy();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { workspace: structuredClone(DEFAULT_WORKSPACE), migration };
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return { workspace: structuredClone(DEFAULT_WORKSPACE), migration };
    const watchlist = Array.isArray(parsed.watchlist)
      ? parsed.watchlist.filter((id): id is string => typeof id === 'string' && Boolean(instrumentById(id)))
      : DEFAULT_WORKSPACE.watchlist;
    const indicators = Array.isArray(parsed.indicators)
      ? (parsed.indicators as IndicatorInstance[]).filter((i) => i && typeof i.defId === 'string')
      : [];
    return {
      workspace: {
        version: 2,
        symbolId: typeof parsed.symbolId === 'string' && instrumentById(parsed.symbolId) ? parsed.symbolId : DEFAULT_WORKSPACE.symbolId,
        interval: typeof parsed.interval === 'string' ? parsed.interval : DEFAULT_WORKSPACE.interval,
        chartKind: (['candles', 'bars', 'line', 'area'] as const).includes(parsed.chartKind as ChartKind) ? (parsed.chartKind as ChartKind) : 'candles',
        theme: parsed.theme === 'light' ? 'light' : 'dark',
        indicators,
        watchlist: watchlist.length ? watchlist : DEFAULT_WORKSPACE.watchlist,
        drawings: isRecord(parsed.drawings) ? (parsed.drawings as Record<string, Drawing[]>) : {},
        panel: parsed.panel === 'instrument' || parsed.panel === 'sources' ? parsed.panel : 'watch',
        rightOpen: parsed.rightOpen !== false,
      },
      migration,
    };
  } catch {
    return { workspace: structuredClone(DEFAULT_WORKSPACE), migration };
  }
}

export function saveWorkspace(workspace: Workspace): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(workspace));
  } catch {
    /* storage may be full or blocked; the UI reports unsaved state */
  }
}

/**
 * One-shot, idempotent import of the previous ChartDesk namespace. Never imports
 * the optional Twelve Data key and never deletes the old data.
 */
export function migrateLegacy(): MigrationReport | null {
  const legacyState = localStorage.getItem('chartdesk.state.v1');
  const legacyWatch = localStorage.getItem('chartdesk.watchlist.v1');
  const legacyDraw = localStorage.getItem('chartdesk.drawings.v1');
  if (!legacyState && !legacyWatch && !legacyDraw) return null;

  const report: MigrationReport = {
    ran: true,
    importedWatchlist: 0,
    importedDrawings: 0,
    importedLayout: false,
    rejected: [],
    skippedSecrets: [],
    backupKey: LEGACY_BACKUP,
  };

  try {
    if (localStorage.getItem(LEGACY_BACKUP) === null) {
      localStorage.setItem(
        LEGACY_BACKUP,
        JSON.stringify({ state: legacyState, watchlist: legacyWatch, drawings: legacyDraw, at: Date.now() }),
      );
    }
  } catch {
    report.backupKey = null;
  }

  if (localStorage.getItem('chartdesk.tdkey')) report.skippedSecrets.push('chartdesk.tdkey');

  let layoutImported = false;
  if (legacyState) {
    try {
      const state = JSON.parse(legacyState) as Record<string, unknown>;
      if (!localStorage.getItem(KEY)) {
        const symbol = typeof state.symbol === 'string' ? instrumentBySymbol(state.symbol) : undefined;
        const next = structuredClone(DEFAULT_WORKSPACE);
        if (symbol) next.symbolId = symbol.id;
        if (typeof state.interval === 'string') next.interval = state.interval;
        if (state.theme === 'light' || state.theme === 'dark') next.theme = state.theme;
        if (['candles', 'bars', 'line', 'area'].includes(String(state.chartType))) {
          next.chartKind = state.chartType === 'ha' ? 'candles' : (state.chartType as ChartKind);
        }
        saveWorkspace(next);
        layoutImported = true;
      }
    } catch {
      report.rejected.push('chartdesk.state.v1: invalid JSON');
    }
  }
  report.importedLayout = layoutImported;

  const watchIds: string[] = [];
  if (legacyWatch) {
    try {
      const list = JSON.parse(legacyWatch) as unknown;
      if (Array.isArray(list)) {
        for (const symbol of list) {
          const instrument = typeof symbol === 'string' ? instrumentBySymbol(symbol) : undefined;
          if (instrument) watchIds.push(instrument.id);
          else report.rejected.push(`watchlist symbol ${String(symbol)}`);
        }
      }
    } catch {
      report.rejected.push('chartdesk.watchlist.v1: invalid JSON');
    }
  }
  report.importedWatchlist = watchIds.length;

  const drawings: Record<string, Drawing[]> = {};
  if (legacyDraw) {
    try {
      const parsed = JSON.parse(legacyDraw) as Record<string, unknown[]>;
      for (const [symbol, list] of Object.entries(parsed)) {
        const instrument = instrumentBySymbol(symbol);
        if (!instrument || !Array.isArray(list)) {
          report.rejected.push(`drawings for ${symbol}`);
          continue;
        }
        const converted: Drawing[] = [];
        for (const item of list) {
          const shape = item as { tool?: string; kind?: string; points?: { time: number; price: number }[]; a?: { time: number; price: number }; b?: { time: number; price: number }; color?: string; label?: string; id?: string };
          const points = shape.points;
          const a = shape.a ?? points?.[0];
          const b = shape.b ?? points?.[1] ?? a;
          if (!a || !b) {
            report.rejected.push(`drawing in ${symbol}`);
            continue;
          }
          const tool = String(shape.kind ?? shape.tool ?? '');
          const map: Record<string, Drawing['kind']> = {
            trend: 'trend', trendline: 'trend', hline: 'hline', vline: 'vline',
            rect: 'rect', fib: 'fib', measure: 'measure', text: 'text',
          };
          const kind = map[tool];
          if (!kind) {
            report.rejected.push(`tool ${tool} in ${symbol}`);
            continue;
          }
          converted.push({
            id: shape.id ?? `legacy_${Math.random().toString(36).slice(2, 9)}`,
            kind,
            a: { time: Number(a.time), price: Number(a.price) },
            b: { time: Number(b.time), price: Number(b.price) },
            color: shape.color ?? '#7aa2ff',
            ...(shape.label ? { label: shape.label } : {}),
          });
        }
        if (converted.length) drawings[instrument.id] = converted;
      }
    } catch {
      report.rejected.push('chartdesk.drawings.v1: invalid JSON');
    }
  }
  report.importedDrawings = Object.values(drawings).reduce((a, b) => a + b.length, 0);

  if (Object.keys(drawings).length) {
    const current = loadWorkspaceRaw() ?? structuredClone(DEFAULT_WORKSPACE);
    current.drawings = { ...drawings, ...current.drawings };
    if (watchIds.length) current.watchlist = [...new Set([...current.watchlist, ...watchIds])];
    saveWorkspace(current);
  } else if (watchIds.length) {
    const current = loadWorkspaceRaw() ?? structuredClone(DEFAULT_WORKSPACE);
    current.watchlist = [...new Set([...current.watchlist, ...watchIds])];
    saveWorkspace(current);
  }

  return report;
}

function loadWorkspaceRaw(): Workspace | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Workspace;
    return parsed && parsed.version === 2 ? parsed : null;
  } catch {
    return null;
  }
}

export function clearWorkspace(): void {
  localStorage.removeItem(KEY);
}
