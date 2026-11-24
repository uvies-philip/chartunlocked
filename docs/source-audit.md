# Source audit: existing implementation vs the specification

Audited: local checkout of the previous application (plain ES modules, no build step), at the
point it was renamed from ChartDesk to ChartLoft. Findings are from reading the source and running
the app, not from a pinned upstream commit.

## AUD-01 Cross-feed history shifting

**Finding: confirmed.** `alignToTv()` added `tvClose - lastBarClose` to every historical OHLC value
so the chart's history matched a quote from a different provider.

**Why it matters.** It makes history look more accurate than it is. Historical traded prices are a
record, not a display preference. Shifting them silently rewrites the past and would corrupt any
alert or backtest built on those bars.

**Action taken.** Removed entirely. The new application has no history-adjustment path. The
TradingView scanner is still used, but only as a labelled reference value in the instrument panel
(`fetchReference`), never written into bars. See ADR-002.

## AUD-02 Alert polling with hidden-tab early returns

**Finding: consistent with the source.** Alert evaluation ran in a browser interval that returned
early when the tab was hidden.

**Action taken.** No alert implementation is shipped at all. A tab-timer alert is a false promise;
durable alerts belong to a server evaluator (M3, blocked on hosting). Nothing in the UI suggests
alerts exist.

## AUD-03 Undo that deletes

**Finding: confirmed.** A control labelled as undo removed the selected drawing.

**Action taken.** Real command history: each mutation pushes the previous drawing set, redo is
invalidated on a new branch, and deletion has its own trash control. Covered by a browser check
(create, undo, verify empty) and by design of `historyRef` in `App.tsx`.

## AUD-04 Yahoo-through-relay history and a stored optional API key

**Finding: confirmed.** Non-crypto history came from Yahoo through `r.jina.ai`, and an optional
Twelve Data key could be stored in `localStorage`.

**Action taken.** The relay path remains for M1, but it is now an explicitly labelled delayed
adapter with declared provenance, not a hidden fallback. The Twelve Data key concept is removed
from the new code; the legacy migration explicitly skips `chartdesk.tdkey` and reports it, and a
test asserts the key never enters the new workspace.

## AUD-05 Spot metals mapped to futures identifiers

**Finding: confirmed.** The instrument catalogue mapped spot gold to a futures history ticker
without distinguishing the two.

**Action taken.** The instrument master keeps them distinct and states it in the UI: `XAUUSD` is a
spot instrument whose history is the COMEX front month (`GC=F`), with the spot reference shown
separately. `note` text is rendered in the instrument panel. No constant offset is applied.

## AUD-06 Mobile CSS hiding desktop actions

**Finding: confirmed.** Actions were removed at narrow widths with no alternate access.

**Action taken.** The new shell keeps symbol search, interval, chart type, indicators, theme and
panel toggle reachable at 360 px. The side panel becomes an overlay drawer rather than disappearing.
The tool rail collapses below 640 px, which is a real gap: drawing tools are not reachable there yet.

## Regression investigations requested by the specification

| Item | State | Note |
| --- | --- | --- |
| Threshold vs crossing semantics | `not_run` | No alert engine exists yet |
| Calendar aggregation | `not_run` | No monthly/calendar bars yet |
| Stale-price detection | `passing` | Incoming ticks never stretch a bar older than 3 intervals |
| Replay leakage | `not_run` | No replay yet |

## Legacy storage inventory

Recognised and handled by `src/app/persist.ts`:

```text
chartdesk.state.v1       layout, symbol, interval, theme, chart type
chartdesk.watchlist.v1   array of display symbols
chartdesk.drawings.v1    map of symbol -> drawing objects (two shapes accepted)
chartdesk.layouts.v1     not imported; reported as unsupported
chartdesk.tdkey          deliberately skipped, never imported, reported to the user
```

The migration writes a backup under `cu.legacy.backup.v1`, imports once, validates every record,
reports rejects, and never deletes the source keys.
