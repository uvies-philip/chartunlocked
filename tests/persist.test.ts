import { beforeEach, describe, expect, it, vi } from 'vitest';

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length(): number {
    return this.map.size;
  }
  clear(): void {
    this.map.clear();
  }
  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }
  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  setItem(key: string, value: string): void {
    this.map.set(key, String(value));
  }
}

const storage = new MemoryStorage();
vi.stubGlobal('localStorage', storage);

const { loadWorkspace, migrateLegacy, saveWorkspace, DEFAULT_WORKSPACE } = await import('../src/app/persist');

beforeEach(() => {
  storage.clear();
});

describe('workspace persistence', () => {
  it('returns defaults on a clean browser', () => {
    const { workspace, migration } = loadWorkspace();
    expect(migration).toBeNull();
    expect(workspace.version).toBe(2);
    expect(workspace.indicators).toEqual([]);
    expect(workspace.watchlist.length).toBeGreaterThan(0);
  });

  it('round-trips a saved workspace', () => {
    saveWorkspace({ ...structuredClone(DEFAULT_WORKSPACE), symbolId: 'fx:eurusd', interval: '5m' });
    const { workspace } = loadWorkspace();
    expect(workspace.symbolId).toBe('fx:eurusd');
    expect(workspace.interval).toBe('5m');
  });

  it('drops unknown instruments rather than failing the whole load', () => {
    storage.setItem('cu.workspace.v2', JSON.stringify({ ...structuredClone(DEFAULT_WORKSPACE), symbolId: 'nope:xyz', watchlist: ['fx:eurusd', 'nope:xyz'] }));
    const { workspace } = loadWorkspace();
    expect(workspace.symbolId).toBe(DEFAULT_WORKSPACE.symbolId);
    expect(workspace.watchlist).toEqual(['fx:eurusd']);
  });

  it('survives corrupt JSON', () => {
    storage.setItem('cu.workspace.v2', '{not json');
    const { workspace } = loadWorkspace();
    expect(workspace.symbolId).toBe(DEFAULT_WORKSPACE.symbolId);
  });
});

describe('legacy migration', () => {
  it('imports a watchlist, drawings and layout once', () => {
    storage.setItem('chartdesk.state.v1', JSON.stringify({ symbol: 'EURUSD', interval: '1h', theme: 'dark', chartType: 'candles' }));
    storage.setItem('chartdesk.watchlist.v1', JSON.stringify(['EURUSD', 'XAUUSD', 'NOTREAL']));
    storage.setItem(
      'chartdesk.drawings.v1',
      JSON.stringify({
        EURUSD: [{ id: 'a1', tool: 'trendline', points: [{ time: 1700000000, price: 1.09 }, { time: 1700003600, price: 1.1 }], color: '#fff' }],
      }),
    );

    const report = migrateLegacy();
    expect(report?.ran).toBe(true);
    expect(report?.importedWatchlist).toBe(2);
    expect(report?.importedDrawings).toBe(1);
    expect(report?.rejected.some((r) => r.includes('NOTREAL'))).toBe(true);

    const { workspace } = loadWorkspace();
    expect(workspace.symbolId).toBe('fx:eurusd');
    expect(workspace.drawings['fx:eurusd']?.[0]?.kind).toBe('trend');
    expect(workspace.watchlist).toContain('metal:xauusd');

    // Second run must not duplicate or throw.
    const again = migrateLegacy();
    expect(again?.ran).toBe(true);
  });

  it('never imports a stored provider secret', () => {
    storage.setItem('chartdesk.state.v1', JSON.stringify({ symbol: 'EURUSD' }));
    storage.setItem('chartdesk.tdkey', '"secret-key"');
    const report = migrateLegacy();
    expect(report?.skippedSecrets).toContain('chartdesk.tdkey');
    const dump = JSON.stringify(loadWorkspace().workspace);
    expect(dump).not.toContain('secret-key');
  });

  it('keeps a backup of the legacy payload', () => {
    storage.setItem('chartdesk.watchlist.v1', JSON.stringify(['EURUSD']));
    migrateLegacy();
    expect(storage.getItem('cu.legacy.backup.v1')).toContain('EURUSD');
  });

  it('reports invalid legacy JSON instead of crashing', () => {
    storage.setItem('chartdesk.drawings.v1', '{broken');
    const report = migrateLegacy();
    expect(report?.rejected.some((r) => r.includes('drawings'))).toBe(true);
  });
});
