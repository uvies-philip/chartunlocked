# Testing evidence index

Environment for every browser run: Windows 11, Chrome (headless), Puppeteer, production build
served by `vite preview` on 127.0.0.1:4173, path prefix `/chartunlocked/`.

## Automated unit tests

Command: `npx vitest run`
Result: 42 passed, 4 files, 0 failed (2026-11-24)

| File | Tests | Covers |
| --- | --- | --- |
| `tests/indicators.test.ts` | 11 | SMA window and warm-up, EMA seed and recurrence, population standard deviation, RSI bounds for rising, falling and noisy series, ATR convergence to a constant true range |
| `tests/instruments.test.ts` | 9 | Unique stable ids, spot-vs-futures identity for metals, id/symbol round trip, positive tick size with matching precision, search ranking, alias resolution, case insensitivity, interval declarations |
| `tests/persist.test.ts` | 8 | Defaults on a clean browser, round trip, unknown-instrument rejection, corrupt JSON recovery, legacy import counts, idempotency, secret non-import, backup retention, invalid legacy reporting |
| `tests/providers.test.ts` | 14 | Relay preamble stripping, array-of-objects integrity, relay envelope unwrapping (both forms), upstream error status, deterministic fixtures, OHLC validity, interval spacing |

## Type and build checks

| Check | Command | Result |
| --- | --- | --- |
| Types | `npx tsc -p tsconfig.json --noEmit` | exit 0 |
| Bundle | `npx vite build` | 441 kB js (139 kB gzip), 13.9 kB css (3.5 kB gzip) |

## Browser scenarios

Script: `cu-verify.js` (Puppeteer). Asserts and captures console errors.

| Check | Result |
| --- | --- |
| App loads, chart canvas present, title `ChartUnlocked` | pass |
| Watchlist populated for all eight instruments | pass, e.g. EURUSD 1.09540 +0.44, NAS100 26,746.1 +6.86, XAUUSD 3,631.70 -0.54 |
| Switch to EURUSD through `Ctrl+K` | pass, 5,637 bars, mode `Delayed`, provider `Yahoo Finance` |
| Add RSI through the indicator dialog | pass, legend shows `RSI 14 75.22` |
| Draw a horizontal line | pass, one drawing persisted for `fx:eurusd` |
| `Ctrl+Z` undo | pass, drawing count returns to 0 |
| Reload page | pass, EURUSD and layout restored |
| Console page errors | 0 |

## Screenshots

- `docs/screenshot.png`: default workspace, BTCUSDT 15m, dark theme
- Captured during verification but not committed: EURUSD with RSI pane, light theme

## Not run

- Playwright or any CI browser suite (manual Puppeteer scripts only)
- Load or performance profiling beyond the bundle budget
- Accessibility audit tooling (axe or similar)
- Cross-browser pass in Firefox and Safari
- Mobile device testing on hardware; only viewport emulation
