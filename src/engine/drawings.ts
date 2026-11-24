import type { ChartEngine } from './chart';

export type ToolKind =
  | 'cursor'
  | 'trend'
  | 'hline'
  | 'vline'
  | 'rect'
  | 'fib'
  | 'measure'
  | 'text';

export interface Anchor {
  time: number;
  price: number;
}

export interface Drawing {
  id: string;
  kind: Exclude<ToolKind, 'cursor'>;
  a: Anchor;
  b: Anchor;
  color: string;
  label?: string;
}

export const TOOLS: { id: ToolKind; label: string; hint: string; points: 1 | 2 }[] = [
  { id: 'cursor', label: 'Cursor', hint: 'Select and move objects', points: 1 },
  { id: 'trend', label: 'Trend line', hint: 'Click start, then end', points: 2 },
  { id: 'hline', label: 'Horizontal line', hint: 'Click a price level', points: 1 },
  { id: 'vline', label: 'Vertical line', hint: 'Click a time', points: 1 },
  { id: 'rect', label: 'Rectangle', hint: 'Drag between two corners', points: 2 },
  { id: 'fib', label: 'Fib retracement', hint: 'Drag from swing high to low', points: 2 },
  { id: 'measure', label: 'Measure', hint: 'Drag to measure price and time', points: 2 },
  { id: 'text', label: 'Text note', hint: 'Click to place a note', points: 1 },
];

const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

const uid = () => `d_${Math.random().toString(36).slice(2, 9)}`;

export class DrawingsLayer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private engine: ChartEngine;
  private host: HTMLElement;
  private drawings: Drawing[] = [];
  private tool: ToolKind = 'cursor';
  private draft: Drawing | null = null;
  private selectedId: string | null = null;
  private dragging: { id: string; which: 'a' | 'b' | 'all'; startTime: number; startPrice: number; origin: Drawing } | null = null;
  private digits = 2;
  private color = '#7aa2ff';
  private detachRange: (() => void) | null = null;
  private resizeObserver: ResizeObserver | null = null;

  onChange: (drawings: Drawing[]) => void = () => {};
  onSelect: (id: string | null) => void = () => {};
  onToolDone: () => void = () => {};

  constructor(host: HTMLElement, engine: ChartEngine) {
    this.host = host;
    this.engine = engine;
    this.canvas = document.createElement('canvas');
    this.canvas.style.position = 'absolute';
    this.canvas.style.inset = '0';
    this.canvas.style.zIndex = '4';
    this.canvas.style.pointerEvents = 'none';
    host.appendChild(this.canvas);
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2d unavailable');
    this.ctx = ctx;

    this.detachRange = engine.onRangeChange(() => this.render());
    this.resizeObserver = new ResizeObserver(() => {
      this.resize();
      this.render();
    });
    this.resizeObserver.observe(host);

    this.canvas.addEventListener('pointerdown', this.onDown);
    this.canvas.addEventListener('pointermove', this.onMove);
    this.canvas.addEventListener('pointerup', this.onUp);
    this.canvas.addEventListener('pointerleave', this.onUp);
    this.resize();
  }

  setDigits(digits: number): void {
    this.digits = digits;
    this.render();
  }

  setColor(color: string): void {
    this.color = color;
  }

  setTool(tool: ToolKind): void {
    this.tool = tool;
    this.draft = null;
    this.canvas.style.pointerEvents = tool === 'cursor' ? 'none' : 'auto';
    this.canvas.style.cursor = tool === 'cursor' ? 'default' : 'crosshair';
    if (tool === 'cursor') this.canvas.style.pointerEvents = 'auto';
    this.render();
  }

  getTool(): ToolKind {
    return this.tool;
  }

  setDrawings(drawings: Drawing[]): void {
    this.drawings = drawings;
    this.render();
  }

  getDrawings(): Drawing[] {
    return this.drawings;
  }

  setSelected(id: string | null): void {
    this.selectedId = id;
    this.render();
  }

  getSelected(): string | null {
    return this.selectedId;
  }

  deleteSelected(): Drawing[] | null {
    if (!this.selectedId) return null;
    const next = this.drawings.filter((d) => d.id !== this.selectedId);
    this.selectedId = null;
    this.drawings = next;
    this.render();
    return next;
  }

  private resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const width = this.host.clientWidth;
    const height = this.host.clientHeight;
    this.canvas.width = Math.floor(width * dpr);
    this.canvas.height = Math.floor(height * dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private point(event: PointerEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  private toAnchor(x: number, y: number): Anchor | null {
    const price = this.engine.coordinateToPrice(y);
    const time = this.engine.coordinateToTime(x);
    if (price === null || time === null) return null;
    return { time, price };
  }

  private onDown = (event: PointerEvent) => {
    const { x, y } = this.point(event);
    if (this.tool === 'cursor') {
      const hit = this.hitTest(x, y);
      this.selectedId = hit?.id ?? null;
      this.onSelect(this.selectedId);
      if (hit) {
        const anchor = this.toAnchor(x, y);
        if (anchor) {
          this.dragging = { id: hit.id, which: 'all', startTime: anchor.time, startPrice: anchor.price, origin: structuredClone(hit) };
          this.canvas.setPointerCapture(event.pointerId);
        }
      }
      this.render();
      return;
    }

    const anchor = this.toAnchor(x, y);
    if (!anchor) return;

    if (this.tool === 'hline' || this.tool === 'vline' || this.tool === 'text') {
      const label = this.tool === 'text' ? window.prompt('Note text', 'Note') ?? '' : undefined;
      if (this.tool === 'text' && !label) return;
      const drawing: Drawing = {
        id: uid(),
        kind: this.tool,
        a: anchor,
        b: anchor,
        color: this.color,
        ...(label ? { label } : {}),
      };
      this.drawings = [...this.drawings, drawing];
      this.onChange(this.drawings);
      this.onToolDone();
      this.render();
      return;
    }

    this.draft = { id: uid(), kind: this.tool as Drawing['kind'], a: anchor, b: anchor, color: this.color };
    this.canvas.setPointerCapture(event.pointerId);
    this.render();
  };

  private onMove = (event: PointerEvent) => {
    const { x, y } = this.point(event);
    if (this.dragging) {
      const anchor = this.toAnchor(x, y);
      if (!anchor) return;
      const dt = anchor.time - this.dragging.startTime;
      const dp = anchor.price - this.dragging.startPrice;
      const origin = this.dragging.origin;
      this.drawings = this.drawings.map((d) =>
        d.id === this.dragging?.id
          ? { ...d, a: { time: origin.a.time + dt, price: origin.a.price + dp }, b: { time: origin.b.time + dt, price: origin.b.price + dp } }
          : d,
      );
      this.render();
      return;
    }
    if (this.draft) {
      const anchor = this.toAnchor(x, y);
      if (!anchor) return;
      this.draft = { ...this.draft, b: anchor };
      this.render();
    }
  };

  private onUp = () => {
    if (this.dragging) {
      this.dragging = null;
      this.onChange(this.drawings);
      return;
    }
    if (this.draft) {
      const draft = this.draft;
      this.draft = null;
      this.drawings = [...this.drawings, draft];
      this.onChange(this.drawings);
      this.onToolDone();
      this.render();
    }
  };

  private px(anchor: Anchor): { x: number; y: number } | null {
    const x = this.engine.timeToCoordinate(anchor.time);
    const y = this.engine.priceToCoordinate(anchor.price);
    if (x === null || y === null) return null;
    return { x, y };
  }

  private hitTest(x: number, y: number): Drawing | null {
    for (let i = this.drawings.length - 1; i >= 0; i -= 1) {
      const d = this.drawings[i] as Drawing;
      const a = this.px(d.a);
      const b = this.px(d.b);
      if (!a || !b) continue;
      if (d.kind === 'hline' && Math.abs(y - a.y) < 6) return d;
      if (d.kind === 'vline' && Math.abs(x - a.x) < 6) return d;
      if (d.kind === 'text' && Math.abs(x - a.x) < 80 && Math.abs(y - a.y) < 14) return d;
      if (d.kind === 'rect' || d.kind === 'measure') {
        if (x >= Math.min(a.x, b.x) - 4 && x <= Math.max(a.x, b.x) + 4 && y >= Math.min(a.y, b.y) - 4 && y <= Math.max(a.y, b.y) + 4) return d;
      }
      if (d.kind === 'trend' || d.kind === 'fib') {
        if (this.distanceToSegment(x, y, a, b) < 7) return d;
      }
    }
    return null;
  }

  private distanceToSegment(x: number, y: number, a: { x: number; y: number }, b: { x: number; y: number }): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSq = dx * dx + dy * dy;
    if (lengthSq === 0) return Math.hypot(x - a.x, y - a.y);
    let t = ((x - a.x) * dx + (y - a.y) * dy) / lengthSq;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(x - (a.x + t * dx), y - (a.y + t * dy));
  }

  private fmt(price: number): string {
    return price.toLocaleString('en-GB', { minimumFractionDigits: this.digits, maximumFractionDigits: this.digits });
  }

  render(): void {
    const { ctx } = this;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);
    const all = this.draft ? [...this.drawings, this.draft] : this.drawings;
    for (const d of all) this.drawShape(d);
  }

  private drawShape(d: Drawing): void {
    const { ctx } = this;
    const a = this.px(d.a);
    const b = this.px(d.b);
    if (!a || !b) return;
    const selected = d.id === this.selectedId;
    const accent = d.color;
    ctx.save();
    ctx.strokeStyle = accent;
    ctx.fillStyle = accent;
    ctx.lineWidth = selected ? 2 : 1.25;
    ctx.font = "11px 'JetBrains Mono', monospace";

    if (d.kind === 'hline') {
      ctx.beginPath();
      ctx.moveTo(0, a.y);
      ctx.lineTo(this.canvas.clientWidth, a.y);
      ctx.stroke();
      ctx.fillText(this.fmt(d.a.price), 6, a.y - 5);
    } else if (d.kind === 'vline') {
      ctx.beginPath();
      ctx.moveTo(a.x, 0);
      ctx.lineTo(a.x, this.canvas.clientHeight);
      ctx.stroke();
    } else if (d.kind === 'trend') {
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(a.x, a.y, 3, 0, Math.PI * 2);
      ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
      ctx.fill();
      if (selected) this.handles(a, b);
    } else if (d.kind === 'rect') {
      const x = Math.min(a.x, b.x);
      const y = Math.min(a.y, b.y);
      const rw = Math.abs(b.x - a.x);
      const rh = Math.abs(b.y - a.y);
      ctx.fillStyle = `${accent}22`;
      ctx.fillRect(x, y, rw, rh);
      ctx.strokeRect(x, y, rw, rh);
      if (selected) this.handles(a, b);
    } else if (d.kind === 'fib') {
      const high = Math.max(d.a.price, d.b.price);
      const low = Math.min(d.a.price, d.b.price);
      const x1 = Math.min(a.x, b.x);
      const x2 = Math.max(a.x, b.x);
      for (const level of FIB_LEVELS) {
        const price = high - (high - low) * level;
        const y = this.engine.priceToCoordinate(price);
        if (y === null) continue;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.moveTo(x1, y);
        ctx.lineTo(x2, y);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillText(`${(level * 100).toFixed(1)}%  ${this.fmt(price)}`, x2 + 6, y + 4);
      }
      if (selected) this.handles(a, b);
    } else if (d.kind === 'measure') {
      const change = d.b.price - d.a.price;
      const pct = d.a.price === 0 ? 0 : (change / d.a.price) * 100;
      const up = change >= 0;
      ctx.strokeStyle = up ? '#46d7a4' : '#ff7d8f';
      ctx.fillStyle = up ? 'rgba(70,215,164,0.14)' : 'rgba(255,125,143,0.14)';
      const x = Math.min(a.x, b.x);
      const y = Math.min(a.y, b.y);
      ctx.fillRect(x, y, Math.abs(b.x - a.x), Math.abs(b.y - a.y));
      ctx.strokeRect(x, y, Math.abs(b.x - a.x), Math.abs(b.y - a.y));
      const text = `${change >= 0 ? '+' : ''}${this.fmt(change)}  (${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%)`;
      ctx.fillStyle = up ? '#46d7a4' : '#ff7d8f';
      ctx.fillText(text, x + 4, y - 6);
    } else if (d.kind === 'text') {
      ctx.beginPath();
      ctx.arc(a.x, a.y, 3, 0, Math.PI * 2);
      ctx.fill();
      const label = d.label ?? 'Note';
      ctx.fillStyle = 'rgba(10,16,24,0.82)';
      const width = ctx.measureText(label).width + 12;
      ctx.fillRect(a.x + 6, a.y - 9, width, 18);
      ctx.strokeStyle = accent;
      ctx.strokeRect(a.x + 6, a.y - 9, width, 18);
      ctx.fillStyle = '#edf3fa';
      ctx.fillText(label, a.x + 12, a.y + 4);
    }
    ctx.restore();
  }

  private handles(a: { x: number; y: number }, b: { x: number; y: number }): void {
    const { ctx } = this;
    ctx.save();
    ctx.fillStyle = '#0b1118';
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 1.5;
    for (const point of [a, b]) {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  destroy(): void {
    this.detachRange?.();
    this.resizeObserver?.disconnect();
    this.canvas.remove();
  }
}

export function loadDrawings(raw: unknown): Drawing[] {
  if (!Array.isArray(raw)) return [];
  const out: Drawing[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const d = item as Record<string, unknown>;
    const a = d.a as Record<string, unknown> | undefined;
    const b = d.b as Record<string, unknown> | undefined;
    if (!a || !b) continue;
    const timeA = Number(a.time);
    const priceA = Number(a.price);
    const timeB = Number(b.time);
    const priceB = Number(b.price);
    if (![timeA, priceA, timeB, priceB].every(Number.isFinite)) continue;
    const kind = d.kind;
    if (!['trend', 'hline', 'vline', 'rect', 'fib', 'measure', 'text'].includes(String(kind))) continue;
    out.push({
      id: typeof d.id === 'string' ? d.id : uid(),
      kind: kind as Drawing['kind'],
      a: { time: timeA, price: priceA },
      b: { time: timeB, price: priceB },
      color: typeof d.color === 'string' ? d.color : '#7aa2ff',
      ...(typeof d.label === 'string' ? { label: d.label } : {}),
    });
  }
  return out;
}
