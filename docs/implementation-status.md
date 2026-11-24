# Implementation status

Last updated: 2026-11-24
Branch: `main`
Build: Vite 7.1.12, React 19.2.0, TypeScript 5.9.3, Lightweight Charts 5.3.0 (pinned, lockfile committed)

This file records what was actually built and verified. Anything not listed as verified below is
either planned or absent. `NOT RUN` means exactly that.

## Milestone state

| Milestone | State | Evidence |
| --- | --- | --- |
| M0 audit and data-integrity fixes | implemented | [source-audit.md](source-audit.md), 42 unit tests |
| M1 single-chart vertical slice | implemented | local run, screenshots, browser checks in [testing/evidence-index.md](testing/evidence-index.md) |
| M2 workspace depth | planned | not started |
| M3 accounts, sync, server alerts | blocked | requires a backend and hosting decision |
| M4 replay, paper, backtests | planned | not started |
| M5 advanced charts and research | planned | not started |
| M6 differentiators, collaboration | planned | not started |
| M7 broker connectivity | blocked | requires approvals and legal review |
| M8 cross-device, parity closure | planned | not started |

## Verified commands

```text
npm install                     PASS (node 24.18.1, npm 11.16.0)
npx tsc -p tsconfig.json        PASS (no errors)
npm test                        PASS 42 tests, 4 files
npm run build                   PASS, dist 441 kB js / 139 kB gzip, 13.9 kB css
```

Browser verification (headless Chrome, 1600x900 and 360x800): see evidence index. Console errors: 0.

## Feature records

### CH-01 Candlesticks and OHLC bars

- Implementation: `implemented`
- Verification: `passing` (visual + OHLC invariants in the fixture test, provider bar validation)
- Scope: candles and bars, per-instrument precision and tick size, correct up/down styling
- Limitations: no hollow candles, no style presets

### CH-02 Line, area

- Implementation: `implemented` (line, area). HLC area, baseline, step, markers, columns: `planned`
- Verification: `passing` (renders, switches without leaking a series)

### CH-17 Interval switching

- Implementation: `implemented` for 1m, 5m, 15m, 30m, 1H, 1D, 1W
- Verification: `passing`
- Limitations: 4H not offered (Yahoo has no native 4H; aggregation not implemented yet). No custom
  intervals, no tick/volume bars.

### CH-18 Scales

- Implementation: `partial`. Linear automatic and manual price scale work through the engine.
  Log, percentage and indexed scales: `planned`
- Verification: `not_run` for log/percentage

### CH-19 Independent price scales

- Implementation: `not_implemented`

### CH-20 Symbol comparison

- Implementation: `not_implemented`

### CH-22 Multi-pane indicators

- Implementation: `implemented` for one or more separate panes with stretch factors
- Verification: `passing` (RSI pane verified in a browser screenshot)
- Limitations: panes cannot be reordered or resized by drag yet

### CH-23 Multi-chart workspaces

- Implementation: `not_implemented` (M2)

### CH-29 Historical navigation

- Implementation: `partial`. Pan, zoom, wheel scaling and fit-to-screen work through the engine.
  Date jump and lazy history pagination: `planned`
- Verification: `passing` for pan/zoom, `not_run` for deep history

### CH-30 Export

- Implementation: `partial`. Workspace JSON export exists. Chart image export: `planned`

### CH-31 Screen-reader data view

- Implementation: `not_implemented`. The legend exposes values as text; a paginated OHLC table is
  still required (M1 gap, tracked).

### IND-01 Indicator catalogue

- Implementation: `partial`. Eight indicators with tests: SMA, EMA, Bollinger, VWAP (session),
  RSI, MACD, ATR, Stochastic
- Verification: `passing` for warm-up, bounds, seeding and convergence
- Limitations: no parameter UI beyond defaults (the dialog adds with default params), no
  multi-timeframe inputs, no indicator chaining

### DR-01 to DR-13 Drawing families

- Implementation: `partial`. Trend line, horizontal line, vertical line, rectangle, Fibonacci
  retracement, measure, text note
- Verification: `passing` for create, undo, delete, persistence across reload
- Limitations: no channels, pitchforks, Gann, patterns, position planning, groups, locking,
  cross-layout sync

### DR-13 Object management, undo/redo

- Implementation: `implemented` with a snapshot command history per instrument
- Verification: `passing`. Undo restores the prior drawing set; delete has its own control and
  never masquerades as undo (AUD-03 fixed)

### WSP-01 Workspace persistence

- Implementation: `implemented`, local only, schema version 2
- Verification: `passing` (round-trip, corrupt JSON, unknown instruments)
- Limitations: no cloud sync, no conflict resolution across devices (M3)

### WSP-02 Portability and migration

- Implementation: `implemented` for legacy `chartdesk.*` import and workspace JSON export
- Verification: `passing` (idempotent, backup written, secrets skipped, invalid records reported)

### WAT-01 Watchlist

- Implementation: `partial`. One list, batched quotes, click to load
- Limitations: no multiple lists, no reordering, no import/export

### ALT-01 Alerts

- Implementation: `not_implemented`. Deliberately absent rather than decorative: durable alerts
  require a server (M3)

### RPL-01 Replay

- Implementation: `not_implemented` (M4)

### SEC-01 Security baseline

- Implementation: `partial`. No secrets, no auth surface, dependency light, strict TypeScript,
  external payloads validated before use
- Verification: `not_run` for a formal threat model (M0 gap, tracked)

## Known defects and gaps

| ID | Issue | Impact | Next step |
| --- | --- | --- | --- |
| GAP-01 | No screen-reader data table | Accessibility gap against CH-31 | Add paginated OHLC/indicator table |
| GAP-02 | Indicator parameters not editable in the UI | Limits analysis | Parameter editor in the indicator dialog |
| GAP-03 | Non-crypto history is delayed 1-15 min | Displayed honestly, still a limitation | Licensed feed (blocked) |
| GAP-04 | Relay is rate limited to roughly 20 req/min | Slow cold start for the watchlist | Provider with CORS and a documented quota |
| GAP-05 | No e2e test runner in CI | Regressions caught manually | Playwright suite (M2) |

## Commands actually run for the reported results

```text
npx tsc -p tsconfig.json --noEmit      -> exit 0
npx vitest run                         -> 42 passed
npx vite build                         -> built in 1.6-2.0s
node cu-verify.js (puppeteer, headless) -> watchlist, symbol switch, indicator, drawing, undo,
                                           reload persistence all confirmed, 0 page errors
```
