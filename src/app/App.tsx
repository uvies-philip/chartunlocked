import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChartEngine, type ChartKind } from '../engine/chart';
import { DrawingsLayer, type Drawing, type ToolKind } from '../engine/drawings';
import { INDICATOR_COLORS, INDICATOR_MAP, defaultParams, lastValue, type IndicatorInstance } from '../engine/indicators';
import { instrumentById, intervalById, INTERVALS } from '../domain/instruments';
import { fetchHistory, fetchQuote, fetchReference, fetchWatchQuotes, getLastProviderError, getLastSparkDebug, streamTrades, type WatchQuote } from '../data/providers';
import type { Bar, Provenance } from '../domain/types';
import { DEFAULT_WORKSPACE, loadWorkspace, migrateLegacy, saveWorkspace, type MigrationReport, type Workspace } from './persist';
import { TopBar } from '../ui/TopBar';
import { ToolRail } from '../ui/ToolRail';
import { Legend, StageState, type IndicatorRow } from '../ui/ChartStage';
import { SidePanel } from '../ui/SidePanel';
import { StatusBar } from '../ui/StatusBar';
import { Menu, type MenuEntry } from '../ui/Menu';
import { Palette, IndicatorDialog } from '../ui/Dialogs';

const KINDS: { id: ChartKind; label: string }[] = [
  { id: 'candles', label: 'Candlesticks' },
  { id: 'bars', label: 'OHLC bars' },
  { id: 'line', label: 'Line' },
  { id: 'area', label: 'Area' },
];

export default function App() {
  const initial = useRef<{ workspace: Workspace; migration: MigrationReport | null } | null>(null);
  if (initial.current === null) initial.current = loadWorkspace();

  const [ws, setWs] = useState<Workspace>(initial.current.workspace);
  const wsRef = useRef(ws);
  wsRef.current = ws;

  const [migration] = useState<MigrationReport | null>(initial.current.migration);
  const [bars, setBars] = useState<Bar[]>([]);
  const [provenance, setProvenance] = useState<Provenance | null>(null);
  const [previousClose, setPreviousClose] = useState<number | null>(null);
  const [dayChange, setDayChange] = useState<{ prev: number | null; pct: number | null }>({ prev: null, pct: null });
  const [quote, setQuote] = useState<number | null>(null);
  const [quoteAt, setQuoteAt] = useState<number | null>(null);
  const [reference, setReference] = useState<{ value: number; changePct: number | null } | null>(null);
  const [watchQuotes, setWatchQuotes] = useState<Record<string, WatchQuote>>({});
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [liveState, setLiveState] = useState<'idle' | 'connecting' | 'live' | 'down'>('idle');
  const [tool, setTool] = useState<ToolKind>('cursor');
  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<Bar | null>(null);
  const [savedLabel, setSavedLabel] = useState('Saved');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [indicatorOpen, setIndicatorOpen] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number; entries: MenuEntry[] } | null>(null);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [retryToken, setRetryToken] = useState(0);
  const [nowTick, setNowTick] = useState(() => Date.now());

  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<ChartEngine | null>(null);
  const layerRef = useRef<DrawingsLayer | null>(null);
  const barsRef = useRef<Bar[]>([]);
  barsRef.current = bars;
  const historyRef = useRef<{ undo: Drawing[][]; redo: Drawing[][] }>({ undo: [], redo: [] });

  const instrument = instrumentById(ws.symbolId) ?? instrumentById(DEFAULT_WORKSPACE.symbolId)!;
  const interval = intervalById(ws.interval);
  const digits = instrument.digits;
  const instrumentDrawings = ws.drawings[instrument.id] ?? [];

  /* ------------------------------- persistence ------------------------------ */
  useEffect(() => {
    setSavedLabel('Saving');
    const timer = window.setTimeout(() => {
      saveWorkspace(ws);
      setSavedLabel('Saved');
    }, 400);
    return () => window.clearTimeout(timer);
  }, [ws]);

  useEffect(() => {
    document.documentElement.dataset.theme = ws.theme;
  }, [ws.theme]);

  /* --------------------------------- history -------------------------------- */
  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setError(null);
    setDayChange({ prev: null, pct: null });
    const inst = instrumentById(ws.symbolId);
    if (!inst) {
      setStatus('error');
      setError('Unknown instrument');
      return;
    }
    fetchHistory(inst, intervalById(ws.interval))
      .then((result) => {
        if (cancelled) return;
        setBars(result.bars);
        setProvenance(result.provenance);
        setPreviousClose(result.previousClose);
        const last = result.bars[result.bars.length - 1];
        setQuote(last ? last.close : null);
        setQuoteAt(result.provenance.observedAt);
        setStatus('ready');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStatus('error');
        setError(err instanceof Error ? err.message : 'History unavailable');
      });
    return () => {
      cancelled = true;
    };
  }, [ws.symbolId, ws.interval, retryToken]);

  /* --------------------------------- engine --------------------------------- */
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const engine = new ChartEngine({
      container: host,
      theme: wsRef.current.theme,
      kind: wsRef.current.chartKind,
      digits,
      tickSize: instrument.tickSize,
      onCrosshair: (bar) => setHover(bar),
    });
    const layer = new DrawingsLayer(host, engine);
    layer.setDigits(digits);
    layer.onChange = (next) => {
      const current = wsRef.current;
      const previous = current.drawings[instrument.id] ?? [];
      historyRef.current.undo.push(previous);
      if (historyRef.current.undo.length > 50) historyRef.current.undo.shift();
      historyRef.current.redo = [];
      setHistoryVersion((v) => v + 1);
      setWs({ ...current, drawings: { ...current.drawings, [instrument.id]: next } });
    };
    layer.onSelect = (id) => setSelected(id);
    layer.onToolDone = () => {
      setTool('cursor');
      layer.setTool('cursor');
    };
    engineRef.current = engine;
    layerRef.current = layer;
    layer.setTool('cursor');

    // A new engine starts empty; push the current state into it immediately.
    engine.setData(barsRef.current, { digits, tickSize: instrument.tickSize, resetView: true });
    engine.refreshIndicators(wsRef.current.indicators);
    layer.setDrawings(wsRef.current.drawings[instrument.id] ?? []);

    const observer = new ResizeObserver(() => engine.resize());
    observer.observe(host);

    return () => {
      observer.disconnect();
      layer.destroy();
      engine.destroy();
      engineRef.current = null;
      layerRef.current = null;
    };
    // The engine is rebuilt on theme, kind or instrument change; data is re-pushed below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws.chartKind, ws.theme, instrument.id]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setData(bars, { digits, tickSize: instrument.tickSize, resetView: true });
    engine.refreshIndicators(ws.indicators);
    engine.setReferenceLine(null, '');
    layerRef.current?.setDigits(digits);
  }, [bars, digits, instrument.tickSize, ws.indicators]);

  useEffect(() => {
    layerRef.current?.setDrawings(instrumentDrawings);
  }, [instrumentDrawings, instrument.id]);

  useEffect(() => {
    layerRef.current?.setTool(tool);
  }, [tool]);

  /* ---------------------------------- ticks --------------------------------- */
  const applyPrice = useCallback(
    (price: number) => {
      const current = wsRef.current;
      const secs = intervalById(current.interval).seconds;
      setBars((prev) => {
        if (!prev.length) return prev;
        const last = prev[prev.length - 1] as Bar;
        const nowSec = Math.floor(Date.now() / 1000);
        if (secs < 86400 && nowSec >= last.time + secs) {
          const bucket = Math.floor(nowSec / secs) * secs;
          const next: Bar = {
            time: Math.max(last.time + secs, bucket),
            open: last.close,
            high: Math.max(last.close, price),
            low: Math.min(last.close, price),
            close: price,
            volume: 0,
          };
          engineRef.current?.updateBar(next);
          return [...prev, next];
        }
        if (nowSec - last.time > secs * 3) return prev; // never stretch a stale bar
        if (price === last.close) return prev;
        const next: Bar = {
          ...last,
          close: price,
          high: Math.max(last.high, price),
          low: Math.min(last.low, price),
        };
        engineRef.current?.updateBar(next);
        return [...prev.slice(0, -1), next];
      });
      setQuote(price);
      setQuoteAt(Date.now());
    },
    [],
  );

  useEffect(() => {
    const inst = instrumentById(ws.symbolId);
    if (!inst) return;
    setLiveState(inst.provider === 'binance' ? 'connecting' : 'idle');
    if (inst.provider === 'binance') {
      // Seed the day change once, then rely on the trade socket for prices.
      void fetchQuote(inst).then((q) => {
        if (q) setDayChange({ prev: q.previousClose, pct: q.changePct });
      });
      const stop = streamTrades(inst, (price) => applyPrice(price), setLiveState);
      return stop;
    }
    let cancelled = false;
    const poll = async () => {
      const q = await fetchQuote(inst);
      if (!cancelled && q) {
        setQuote(q.value);
        setQuoteAt(q.eventTime);
        setDayChange({ prev: q.previousClose, pct: q.changePct });
        applyPrice(q.value);
      }
    };
    const timer = window.setInterval(poll, 12_000);
    void poll();
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [ws.symbolId, applyPrice]);

  /* ------------------------------ watch quotes ------------------------------ */
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const list = wsRef.current.watchlist.map((id) => instrumentById(id)).filter((i): i is NonNullable<typeof i> => Boolean(i));
      await fetchWatchQuotes(list, (batch) => {
        if (!cancelled) setWatchQuotes((prev) => ({ ...prev, ...batch }));
      });
    };
    void load();
    const timer = window.setInterval(load, 45_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [ws.watchlist]);

  /* ---------------------------- reference quote ----------------------------- */
  useEffect(() => {
    let cancelled = false;
    const inst = instrumentById(ws.symbolId);
    if (!inst) return;
    const load = async () => {
      const ref = await fetchReference(inst);
      if (!cancelled) setReference(ref);
    };
    void load();
    const timer = window.setInterval(load, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [ws.symbolId]);

  /* --------------------------------- clock ---------------------------------- */
  useEffect(() => {
    const timer = window.setInterval(() => setNowTick(Date.now()), 4_000);
    return () => window.clearInterval(timer);
  }, []);

  /* ------------------------------- indicator rows --------------------------- */
  const indicatorRows = useMemo<IndicatorRow[]>(() => {
    const rows: IndicatorRow[] = [];
    for (const instance of ws.indicators) {
      if (!instance.visible) continue;
      const def = INDICATOR_MAP.get(instance.defId);
      if (!def) continue;
      try {
        const plots = def.calc(bars, instance.params);
        const first = plots[0];
        if (!first) continue;
        const params = Object.values(instance.params).join(' ');
        rows.push({
          key: `${instance.uid}-0`,
          label: `${def.name}${params ? ` ${params}` : ''}`,
          color: instance.color,
          value: lastValue(first.data),
        });
        const second = plots[1];
        if (second && def.pane === 'pane') {
          rows.push({ key: `${instance.uid}-1`, label: `${def.name} signal`, color: instance.color, value: lastValue(second.data) });
        }
      } catch {
        /* a bad indicator must not break the legend */
      }
    }
    return rows;
  }, [bars, ws.indicators]);

  /* -------------------------------- commands -------------------------------- */
  const openMenuAt = (anchor: HTMLElement, entries: MenuEntry[]) => {
    const rect = anchor.getBoundingClientRect();
    setMenu({ x: rect.left, y: rect.bottom + 6, entries });
  };

  const intervalMenu = (anchor: HTMLElement) =>
    openMenuAt(
      anchor,
      INTERVALS.map((item) => ({
        id: item.id,
        label: item.label,
        checked: item.id === ws.interval,
        onSelect: () => setWs((current) => ({ ...current, interval: item.id })),
      })),
    );

  const kindMenu = (anchor: HTMLElement) =>
    openMenuAt(
      anchor,
      KINDS.map((item) => ({
        id: item.id,
        label: item.label,
        checked: item.id === ws.chartKind,
        onSelect: () => setWs((current) => ({ ...current, chartKind: item.id })),
      })),
    );

  const moreMenu = (anchor: HTMLElement) =>
    openMenuAt(anchor, [
      { id: 'fit', label: 'Fit chart to screen', shortcut: 'F', onSelect: () => engineRef.current?.fitContent() },
      { id: 'panel', label: 'Toggle side panel', shortcut: 'P', onSelect: () => setWs((c) => ({ ...c, rightOpen: !c.rightOpen })) },
      { id: 'theme', label: 'Toggle theme', shortcut: 'T', onSelect: () => setWs((c) => ({ ...c, theme: c.theme === 'dark' ? 'light' : 'dark' })) },
      { id: 'sep0', label: '', separator: true },
      ...KINDS.map((item) => ({
        id: `kind-${item.id}`,
        label: item.label,
        checked: item.id === wsRef.current.chartKind,
        onSelect: () => setWs((c) => ({ ...c, chartKind: item.id })),
      })),
      { id: 'sep1', label: '', separator: true },
      { id: 'clear', label: 'Clear drawings on this instrument', onSelect: clearDrawings },
      { id: 'export', label: 'Export workspace JSON', onSelect: exportWorkspace },
      { id: 'sep2', label: '', separator: true },
      { id: 'about', label: 'Alerts, replay, trade: not in this build', disabled: true },
    ]);

  function clearDrawings() {
    const current = wsRef.current;
    const previous = current.drawings[instrument.id] ?? [];
    if (!previous.length) return;
    historyRef.current.undo.push(previous);
    historyRef.current.redo = [];
    setHistoryVersion((v) => v + 1);
    setWs({ ...current, drawings: { ...current.drawings, [instrument.id]: [] } });
  }

  function exportWorkspace() {
    const blob = new Blob([JSON.stringify(wsRef.current, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'chartunlocked-workspace.json';
    link.click();
    URL.revokeObjectURL(url);
  }

  const undo = useCallback(() => {
    const previous = historyRef.current.undo.pop();
    if (!previous) return;
    const current = wsRef.current.drawings[instrument.id] ?? [];
    historyRef.current.redo.push(current);
    setHistoryVersion((v) => v + 1);
    setWs({ ...wsRef.current, drawings: { ...wsRef.current.drawings, [instrument.id]: previous } });
    setSelected(null);
  }, [instrument.id]);

  const redo = useCallback(() => {
    const next = historyRef.current.redo.pop();
    if (!next) return;
    const current = wsRef.current.drawings[instrument.id] ?? [];
    historyRef.current.undo.push(current);
    setHistoryVersion((v) => v + 1);
    setWs({ ...wsRef.current, drawings: { ...wsRef.current.drawings, [instrument.id]: next } });
  }, [instrument.id]);

  const deleteSelected = useCallback(() => {
    const layer = layerRef.current;
    if (!layer) return;
    const next = layer.deleteSelected();
    if (!next) return;
    const previous = wsRef.current.drawings[instrument.id] ?? [];
    historyRef.current.undo.push(previous);
    historyRef.current.redo = [];
    setHistoryVersion((v) => v + 1);
    setWs({ ...wsRef.current, drawings: { ...wsRef.current.drawings, [instrument.id]: next } });
    setSelected(null);
  }, [instrument.id]);

  const addIndicator = (defId: string) => {
    const def = INDICATOR_MAP.get(defId);
    if (!def) return;
    const instance: IndicatorInstance = {
      uid: `${defId}_${Math.random().toString(36).slice(2, 8)}`,
      defId,
      params: defaultParams(def),
      color: INDICATOR_COLORS[ws.indicators.length % INDICATOR_COLORS.length] as string,
      visible: true,
    };
    setWs((current) => ({ ...current, indicators: [...current.indicators, instance] }));
  };

  const removeIndicator = (uid: string) =>
    setWs((current) => ({ ...current, indicators: current.indicators.filter((i) => i.uid !== uid) }));

  const toggleIndicator = (uid: string) =>
    setWs((current) => ({
      ...current,
      indicators: current.indicators.map((i) => (i.uid === uid ? { ...i, visible: !i.visible } : i)),
    }));

  /* ------------------------------- shortcuts -------------------------------- */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');
      const meta = event.ctrlKey || event.metaKey;
      if (meta && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen(true);
        return;
      }
      if (meta && event.key.toLowerCase() === 'z') {
        if (typing) return;
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (typing) return;
      if (event.key === 'Escape') {
        if (paletteOpen) setPaletteOpen(false);
        else if (indicatorOpen) setIndicatorOpen(false);
        else if (menu) setMenu(null);
        else {
          setTool('cursor');
          layerRef.current?.setTool('cursor');
          layerRef.current?.setSelected(null);
          setSelected(null);
        }
        return;
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selected) {
          event.preventDefault();
          deleteSelected();
        }
        return;
      }
      if (event.key.toLowerCase() === 'i' && !meta) setIndicatorOpen(true);
      if (event.key.toLowerCase() === 'f' && !meta) engineRef.current?.fitContent();
      if (event.key.toLowerCase() === 't' && !meta) setWs((c) => ({ ...c, theme: c.theme === 'dark' ? 'light' : 'dark' }));
      if (event.key.toLowerCase() === 'p' && !meta) setWs((c) => ({ ...c, rightOpen: !c.rightOpen }));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo, deleteSelected, paletteOpen, indicatorOpen, menu, selected]);

  /* --------------------------------- render --------------------------------- */
  const legendBar = hover ?? (bars.length ? (bars[bars.length - 1] as Bar) : null);
  const mode = provenance?.mode ?? 'demo';
  const ageMs = quoteAt ? Math.max(0, nowTick - quoteAt) : null;
  const migrationNote = migration?.ran
    ? `Imported ${migration.importedWatchlist} watchlist symbols and ${migration.importedDrawings} drawings from the previous version.${migration.skippedSecrets.length ? ' The old data key was not imported.' : ''}`
    : null;

  return (
    <div className={`app${ws.rightOpen ? '' : ' no-panel'}`}>
      <TopBar
        instrument={instrument}
        interval={interval}
        kind={ws.chartKind}
        indicatorCount={ws.indicators.filter((i) => i.visible).length}
        theme={ws.theme}
        rightOpen={ws.rightOpen}
        savedLabel={savedLabel}
        onSearch={() => setPaletteOpen(true)}
        onIntervals={intervalMenu}
        onKinds={kindMenu}
        onIndicators={() => setIndicatorOpen(true)}
        onToggleTheme={() => setWs((c) => ({ ...c, theme: c.theme === 'dark' ? 'light' : 'dark' }))}
        onTogglePanel={() => setWs((c) => ({ ...c, rightOpen: !c.rightOpen }))}
        onFit={() => engineRef.current?.fitContent()}
        onMenu={moreMenu}
      />

      <ToolRail
        tool={tool}
        onTool={(next) => {
          setTool(next);
          layerRef.current?.setTool(next);
        }}
        onUndo={undo}
        onRedo={redo}
        canUndo={historyRef.current.undo.length > 0 && historyVersion >= 0}
        canRedo={historyRef.current.redo.length > 0 && historyVersion >= 0}
        onDelete={deleteSelected}
        canDelete={Boolean(selected)}
        onClear={clearDrawings}
      />

      <main className="stage">
        <div className="chart-host" ref={hostRef} />
        <Legend
          instrument={instrument}
          interval={interval}
          bar={legendBar}
          previousClose={dayChange.prev ?? previousClose}
          changePct={dayChange.pct}
          provenance={provenance}
          mode={mode}
          indicatorRows={indicatorRows}
          digits={digits}
        />
        {status === 'loading' ? (
          <StageState kind="loading" title={`Loading ${instrument.symbol}`} detail="Fetching candles and the provider's latest price." />
        ) : null}
        {status === 'error' ? (
          <StageState
            kind="error"
            title="Chart unavailable"
            detail={error ?? 'The provider did not return usable data.'}
            onRetry={() => setRetryToken((t) => t + 1)}
          />
        ) : null}
      </main>

      <SidePanel
        panel={ws.panel}
        onPanel={(panel) => setWs((c) => ({ ...c, panel }))}
        watchlist={ws.watchlist}
        quotes={watchQuotes}
        activeId={instrument.id}
        onSelect={(id) => setWs((c) => ({ ...c, symbolId: id }))}
        instrument={instrument}
        provenance={provenance}
        reference={reference}
        quote={quote}
        digits={digits}
        bars={bars.length}
        savedLabel={savedLabel}
        migrationNote={migrationNote}
      />

      <StatusBar
        provenance={provenance}
        mode={mode}
        ageMs={ageMs}
        bars={bars.length}
        liveState={liveState}
        savedLabel={savedLabel}
        lastError={null}
      />

      {menu ? <Menu x={menu.x} y={menu.y} entries={menu.entries} onClose={() => setMenu(null)} /> : null}

      <Palette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onPick={(id) => {
          setWs((c) => ({ ...c, symbolId: id }));
          setPaletteOpen(false);
        }}
        onCommand={(id) => {
          setPaletteOpen(false);
          if (id === 'fit') engineRef.current?.fitContent();
          if (id === 'theme') setWs((c) => ({ ...c, theme: c.theme === 'dark' ? 'light' : 'dark' }));
          if (id === 'indicators') setIndicatorOpen(true);
          if (id === 'panel') setWs((c) => ({ ...c, rightOpen: !c.rightOpen }));
        }}
      />

      <IndicatorDialog
        open={indicatorOpen}
        onClose={() => setIndicatorOpen(false)}
        instances={ws.indicators}
        onAdd={addIndicator}
        onRemove={removeIndicator}
        onToggle={toggleIndicator}
      />
    </div>
  );
}

// Small debug surface for support and automated checks. Read-only helpers.
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).ChartUnlocked = {
    fetchHistory,
    fetchQuote,
    fetchWatchQuotes,
    fetchReference,
    getLastProviderError,
    getLastSparkDebug,
  };
}

// Re-exported for tests that want the migration entry point.
export { migrateLegacy };
