import {
  AreaSeries,
  BarSeries,
  CandlestickSeries,
  ColorType,
  createChart,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts';
import type { Bar } from '../domain/types';
import type { IndicatorInstance, Plot } from './indicators';
import { INDICATOR_MAP } from './indicators';

export type ChartKind = 'candles' | 'bars' | 'line' | 'area';

export interface ChartTheme {
  background: string;
  text: string;
  grid: string;
  border: string;
  up: string;
  down: string;
  accent: string;
  volumeUp: string;
  volumeDown: string;
}

export const THEMES: Record<'dark' | 'light', ChartTheme> = {
  dark: {
    background: '#0b1118',
    text: '#91a2b9',
    grid: 'rgba(148,163,184,0.055)',
    border: 'rgba(148,163,184,0.12)',
    up: '#46d7a4',
    down: '#ff7d8f',
    accent: '#7aa2ff',
    volumeUp: 'rgba(70,215,164,0.22)',
    volumeDown: 'rgba(255,125,143,0.22)',
  },
  light: {
    background: '#ffffff',
    text: '#67788d',
    grid: 'rgba(15,30,50,0.05)',
    border: 'rgba(15,30,50,0.10)',
    up: '#0d8f66',
    down: '#d23b52',
    accent: '#2f5fd0',
    volumeUp: 'rgba(13,143,102,0.18)',
    volumeDown: 'rgba(210,59,82,0.18)',
  },
};

interface EngineOptions {
  container: HTMLElement;
  theme: 'dark' | 'light';
  kind: ChartKind;
  digits: number;
  tickSize: number;
  onCrosshair: (bar: Bar | null) => void;
}

export class ChartEngine {
  private chart: IChartApi;
  private container: HTMLElement;
  private theme: ChartTheme;
  private kind: ChartKind;
  private digits: number;
  private tickSize: number;
  private price: ISeriesApi<'Candlestick' | 'Bar' | 'Line' | 'Area'> | null = null;
  private volume: ISeriesApi<'Histogram'> | null = null;
  private overlays: ISeriesApi<'Line'>[] = [];
  private panes: ISeriesApi<'Line' | 'Histogram'>[] = [];
  private bars: Bar[] = [];
  private onCrosshair: (bar: Bar | null) => void;
  private hasVolume = false;
  private disposed = false;
  private priceLine: IPriceLine | null = null;
  private rangeHandlers = new Set<() => void>();

  constructor(options: EngineOptions) {
    this.container = options.container;
    this.theme = THEMES[options.theme];
    this.kind = options.kind;
    this.digits = options.digits;
    this.tickSize = options.tickSize;
    this.onCrosshair = options.onCrosshair;

    this.chart = createChart(options.container, {
      layout: {
        background: { type: ColorType.Solid, color: this.theme.background },
        textColor: this.theme.text,
        fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif",
        fontSize: 11,
        attributionLogo: true,
      },
      grid: { vertLines: { color: this.theme.grid }, horzLines: { color: this.theme.grid } },
      rightPriceScale: {
        borderColor: this.theme.border,
        scaleMargins: { top: 0.08, bottom: 0.08 },
        entireTextOnly: true,
      },
      timeScale: {
        borderColor: this.theme.border,
        rightOffset: 5,
        barSpacing: 8,
        minBarSpacing: 2,
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: this.theme.border, width: 1, style: LineStyle.Dashed, labelBackgroundColor: this.theme.border },
        horzLine: { color: this.theme.border, width: 1, style: LineStyle.Dashed, labelBackgroundColor: this.theme.border },
      },
      handleScale: { axisPressedMouseMove: { time: true, price: false } },
      handleScroll: { pressedMouseMove: true, mouseWheel: true, horzTouchDrag: true, vertTouchDrag: false },
      localization: { locale: 'en-GB' },
      autoSize: true,
    });

    this.chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.point) {
        this.onCrosshair(null);
        return;
      }
      const time = param.time as number;
      const bar = this.bars.find((b) => b.time === time) ?? null;
      this.onCrosshair(bar);
    });

    this.chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      for (const handler of this.rangeHandlers) handler();
    });

    this.buildPriceSeries();
    this.buildVolume();
  }

  private buildPriceSeries(): void {
    if (this.price) {
      try {
        this.chart.removeSeries(this.price);
      } catch {
        /* ignore */
      }
      this.price = null;
    }
    const common = {
      priceFormat: { type: 'price' as const, precision: this.digits, minMove: this.tickSize },
      priceLineVisible: false,
      lastValueVisible: true,
    };
    if (this.kind === 'candles') {
      this.price = this.chart.addSeries(CandlestickSeries, {
        ...common,
        upColor: this.theme.up,
        downColor: this.theme.down,
        borderUpColor: this.theme.up,
        borderDownColor: this.theme.down,
        wickUpColor: this.theme.up,
        wickDownColor: this.theme.down,
      }, 0);
    } else if (this.kind === 'bars') {
      this.price = this.chart.addSeries(BarSeries, { ...common, upColor: this.theme.up, downColor: this.theme.down }, 0);
    } else if (this.kind === 'line') {
      this.price = this.chart.addSeries(LineSeries, { ...common, color: this.theme.accent, lineWidth: 2 }, 0);
    } else {
      this.price = this.chart.addSeries(AreaSeries, {
        ...common,
        lineColor: this.theme.accent,
        topColor: 'rgba(122,162,255,0.22)',
        bottomColor: 'rgba(122,162,255,0.01)',
        lineWidth: 2,
      }, 0);
    }
    if (this.bars.length) this.applyBars();
  }

  private buildVolume(): void {
    if (this.volume) {
      try {
        this.chart.removeSeries(this.volume);
      } catch {
        /* ignore */
      }
      this.volume = null;
    }
    this.volume = this.chart.addSeries(HistogramSeries, {
      priceScaleId: 'volume',
      priceFormat: { type: 'volume' },
      priceLineVisible: false,
      lastValueVisible: false,
    }, 0);
    this.chart.priceScale('volume', 0).applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
  }

  private applyBars(): void {
    if (!this.price) return;
    const bars = this.bars;
    if (this.kind === 'line' || this.kind === 'area') {
      this.price.setData(bars.map((b) => ({ time: b.time as UTCTimestamp, value: b.close })));
    } else {
      this.price.setData(
        bars.map((b) => ({
          time: b.time as UTCTimestamp,
          open: b.open,
          high: b.high,
          low: b.low,
          close: b.close,
        })),
      );
    }
    if (this.volume) {
      this.volume.setData(
        bars.map((b) => ({
          time: b.time as UTCTimestamp,
          value: b.volume ?? 0,
          color: b.close >= b.open ? this.theme.volumeUp : this.theme.volumeDown,
        })),
      );
      this.volume.applyOptions({ visible: this.hasVolume });
      this.chart.priceScale('volume', 0).applyOptions({
        scaleMargins: { top: this.hasVolume ? 0.86 : 0.94, bottom: 0 },
      });
      // Keep candles out of the volume band instead of drawing over it.
      this.chart.priceScale('right', 0).applyOptions({
        scaleMargins: { top: 0.08, bottom: this.hasVolume ? 0.22 : 0.08 },
      });
    }
  }

  setData(bars: Bar[], meta: { digits: number; tickSize: number; resetView?: boolean }): void {
    const digitsChanged = meta.digits !== this.digits;
    this.bars = bars;
    this.digits = meta.digits;
    this.tickSize = meta.tickSize;
    this.hasVolume = bars.some((b) => (b.volume ?? 0) > 0);
    if (digitsChanged) {
      this.buildPriceSeries();
      this.buildVolume();
    }
    this.applyBars();
    if (meta.resetView !== false) this.resetView();
    this.refreshIndicators();
  }

  updateBar(bar: Bar): void {
    const last = this.bars[this.bars.length - 1];
    if (last && bar.time === last.time) {
      this.bars[this.bars.length - 1] = bar;
    } else if (!last || bar.time > last.time) {
      this.bars = [...this.bars, bar];
    } else {
      return;
    }
    if (!this.price) return;
    if (this.kind === 'line' || this.kind === 'area') {
      this.price.update({ time: bar.time as UTCTimestamp, value: bar.close });
    } else {
      this.price.update({
        time: bar.time as UTCTimestamp,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
      });
    }
    if (this.volume && this.hasVolume) {
      this.volume.update({
        time: bar.time as UTCTimestamp,
        value: bar.volume ?? 0,
        color: bar.close >= bar.open ? this.theme.volumeUp : this.theme.volumeDown,
      });
    }
    this.refreshIndicators();
  }

  setKind(kind: ChartKind): void {
    if (kind === this.kind) return;
    this.kind = kind;
    this.buildPriceSeries();
    this.applyBars();
  }

  setTheme(theme: 'dark' | 'light'): void {
    this.theme = THEMES[theme];
    this.chart.applyOptions({
      layout: { background: { type: ColorType.Solid, color: this.theme.background }, textColor: this.theme.text },
      grid: { vertLines: { color: this.theme.grid }, horzLines: { color: this.theme.grid } },
      rightPriceScale: { borderColor: this.theme.border },
      timeScale: { borderColor: this.theme.border },
    });
    this.buildPriceSeries();
    this.buildVolume();
    this.applyBars();
    this.refreshIndicators();
  }

  refreshIndicators(instances: IndicatorInstance[] = this.instances): void {
    this.instances = instances;
    for (const series of [...this.overlays, ...this.panes]) {
      try {
        this.chart.removeSeries(series);
      } catch {
        /* ignore */
      }
    }
    this.overlays = [];
    this.panes = [];
    if (!this.bars.length) return;

    const paneCount = instances.filter((i) => i.visible && INDICATOR_MAP.get(i.defId)?.pane === 'pane').length;
    try {
      while (this.chart.panes().length - 1 < paneCount) this.chart.addPane();
      while (this.chart.panes().length - 1 > paneCount) this.chart.removePane(this.chart.panes().length - 1);
    } catch {
      /* older builds may not expose panes */
    }

    let paneIndex = 1;
    for (const instance of instances) {
      if (!instance.visible) continue;
      const def = INDICATOR_MAP.get(instance.defId);
      if (!def) continue;
      let plots: Plot[];
      try {
        plots = def.calc(this.bars, instance.params);
      } catch {
        continue;
      }
      const pane = def.pane === 'pane' ? paneIndex : 0;
      if (def.pane === 'pane') paneIndex += 1;
      for (const plot of plots) {
        const data = plot.data
          .map((value, index) => (value === null ? null : { time: this.bars[index]!.time as UTCTimestamp, value }))
          .filter((point): point is { time: UTCTimestamp; value: number } => point !== null);
        if (!data.length) continue;
        try {
          if (plot.kind === 'hist') {
            const series = this.chart.addSeries(HistogramSeries, {
              color: instance.color,
              priceLineVisible: false,
              lastValueVisible: false,
              priceFormat: { type: 'price', precision: this.digits, minMove: this.tickSize },
            }, pane);
            series.setData(data);
            this.panes.push(series);
          } else {
            const series = this.chart.addSeries(LineSeries, {
              color: plot.color ?? instance.color,
              lineWidth: 1,
              priceLineVisible: false,
              lastValueVisible: false,
              crosshairMarkerVisible: false,
              priceFormat: { type: 'price', precision: def.pane === 'pane' ? 2 : this.digits, minMove: def.pane === 'pane' ? 0.01 : this.tickSize },
            }, pane);
            series.setData(data);
            if (pane === 0) this.overlays.push(series);
            else this.panes.push(series);
          }
        } catch {
          /* skip a plot that the build rejects */
        }
      }
    }

    try {
      const panes = this.chart.panes();
      panes.forEach((pane, index) => pane.setStretchFactor(index === 0 ? (paneCount ? 3 : 1) : 1));
    } catch {
      /* ignore */
    }
  }

  private instances: IndicatorInstance[] = [];

  resetView(): void {
    const count = this.bars.length;
    if (!count) return;
    const width = this.container.clientWidth || 900;
    const target = Math.max(70, Math.min(240, Math.round(width / 8)));
    const from = Math.max(0, count - target);
    try {
      this.chart.timeScale().setVisibleLogicalRange({ from, to: count + 4 });
    } catch {
      this.chart.timeScale().fitContent();
    }
  }

  fitContent(): void {
    this.chart.timeScale().fitContent();
  }

  /** Horizontal line for the separately sourced reference quote. */
  setReferenceLine(price: number | null, label: string): void {
    if (this.priceLine && this.price) {
      try {
        this.price.removePriceLine(this.priceLine);
      } catch {
        /* ignore */
      }
      this.priceLine = null;
    }
    if (price === null || !this.price) return;
    try {
      this.priceLine = this.price.createPriceLine({
        price,
        color: this.theme.accent,
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        axisLabelVisible: true,
        title: label,
      });
    } catch {
      this.priceLine = null;
    }
  }

  onRangeChange(handler: () => void): () => void {
    this.rangeHandlers.add(handler);
    return () => this.rangeHandlers.delete(handler);
  }

  priceToCoordinate(price: number): number | null {
    try {
      return this.price?.priceToCoordinate(price) ?? null;
    } catch {
      return null;
    }
  }

  timeToCoordinate(time: number): number | null {
    try {
      return this.chart.timeScale().timeToCoordinate(time as Time) ?? null;
    } catch {
      return null;
    }
  }

  coordinateToPrice(y: number): number | null {
    try {
      return this.price?.coordinateToPrice(y) ?? null;
    } catch {
      return null;
    }
  }

  coordinateToTime(x: number): number | null {
    try {
      const logical = this.chart.timeScale().coordinateToLogical(x);
      if (logical === null) return null;
      const index = Math.round(logical);
      const bar = this.bars[Math.min(this.bars.length - 1, Math.max(0, index))];
      return bar ? bar.time : null;
    } catch {
      return null;
    }
  }

  getBarCount(): number {
    return this.bars.length;
  }

  getChart(): IChartApi {
    return this.chart;
  }

  resize(): void {
    if (this.disposed) return;
    this.chart.applyOptions({
      width: this.container.clientWidth,
      height: this.container.clientHeight,
    });
  }

  destroy(): void {
    this.disposed = true;
    this.rangeHandlers.clear();
    try {
      this.chart.remove();
    } catch {
      /* ignore */
    }
  }
}
