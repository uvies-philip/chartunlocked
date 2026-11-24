# Acceptance map

Every scenario is mapped to a real check or marked `not_run`. A missing check is never counted as a
pass.

| Test ID | Scenario | State | Where |
| --- | --- | --- | --- |
| AT-DATA-01 | History from source A while source B has a different last price | passing | Bars are never adjusted; the reference appears only in the instrument panel with the difference. Browser check: EURUSD bars unchanged while the reference differs. |
| AT-DATA-02 | Spot gold and gold futures kept distinct | passing | `tests/instruments.test.ts` asserts `XAUUSD` is a metal whose history is `GC=F` with a spot reference and a separating note. |
| AT-DATA-03 | Duplicate and out-of-order events | partial | `applyPrice` ignores a tick older than the active bar and never double-counts volume. No sequence numbers yet. |
| AT-DATA-04 | Calendar periods, not fixed 30 days | not_run | No monthly bars yet |
| AT-DATA-05 | Realtime sequence gap then reconnect | not_run | Trade socket reconnects, but no gap detection yet |
| AT-DATA-06 | Upstream stops updating while socket stays open | partial | Status bar shows data age; a 25 s silent-socket watchdog forces a reconnect |
| AT-DATA-07 | Failover changes source | partial | The relay has a cooldown and the UI shows the provider, but the series is not re-identified on failover |
| AT-DATA-09 | Volume-dependent tools without valid volume | passing | Volume is `null` for FX; the volume series is hidden and VWAP skips zero-volume bars |
| AT-CHART-01 | Pan, zoom, resize with correct alignment | passing | Browser check at 1600x900 and 360x800; `ResizeObserver` drives the engine |
| AT-CHART-02 | Switch symbols rapidly | partial | Loads are guarded by a cancellation flag; a slow response cannot overwrite a newer one |
| AT-CHART-04 | Active candle updated repeatedly | passing | `refreshIndicators` recomputes from the full bar array, so no accumulated delta |
| AT-DRAW-01 | Create, move, restyle, delete, undo, redo | passing | Create, undo and delete verified in the browser; move and restyle verified manually |
| AT-DRAW-02 | Chart type switch preserves drawings | partial | Anchors are time/price, so they survive; no synthetic-bar charts yet |
| AT-SYNC-01 | Edit offline, refresh, reconnect | passing | Workspace in `localStorage`; reload restores symbol, interval, indicators and drawings |
| AT-SYNC-03 | Import legacy storage | passing | `tests/persist.test.ts`: idempotent, backup written, secrets skipped, rejects reported |
| AT-SYNC-04 | Cross-origin migration | partial | JSON export exists; import UI is not built |
| AT-A11Y-01 | Keyboard and screen-reader navigation | not_run | Keyboard works; no screen-reader table yet |
| AT-MOBILE-01 | Core analysis at 360 px | partial | Chart, symbol, interval, indicators and theme reachable; drawing tools hidden below 640 px |
| AT-ALERT-01..08 | Alerts | blocked | No alert engine (M3) |
| AT-REPLAY-01..04 | Replay | blocked | Not built (M4) |
| AT-BACKTEST-01..04 | Backtests | blocked | Not built (M4) |
| AT-BROKER-01..04 | Broker orders | blocked | Not built (M7) |
| AT-ACCESS-01..02 | Cross-tenant access | not_run | No multi-user surface exists |
| AT-AI-01..04 | AI scope | not_run | No AI surface |
| AT-PAY-01..02 | Payments | not_run | No billing |

## Verification method

Browser scenarios were executed with headless Chrome through Puppeteer against the production
build, at 1600x900 and 360x800 with deviceScaleFactor 2. Scripts capture console errors and assert
on DOM state. Screenshots are referenced in `testing/evidence-index.md`.
