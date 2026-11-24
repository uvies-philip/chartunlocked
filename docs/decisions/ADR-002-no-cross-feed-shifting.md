# ADR-002: Never shift history to match another feed

- Status: accepted
- Date: 2026-11-24
- Supersedes: the `alignToTv()` behaviour in the previous implementation

## Context

The previous application fetched prices from TradingView's public scanner and bars from Yahoo.
Users compared the chart against TradingView and found the last price differed, so the code added
the difference between the two feeds to every historical OHLC value. The chart then matched to the
last decimal, at the cost of being wrong.

## Decision

1. A bar supplied by a provider is displayed exactly as supplied. No offset, scaling, interpolation
   or patching from any other source.
2. Live updates to the forming bar come only from the same provider that produced the bar
   (Binance trades for Binance klines, Yahoo's own last price for Yahoo bars).
3. A second source may be shown as a **labelled reference** with its own identity and value. It is
   never merged, and the difference is displayed rather than hidden.
4. A stale bar is never stretched. If the bar is older than three intervals, incoming ticks are
   dropped and a new bar opens on the boundary.

## Rationale

A price has no meaning without its instrument, provider, price kind and time. Two feeds that differ
by a basis, a delay, or a venue are telling the truth about different things. Averaging or offsetting
them destroys the ability to reason about either, and would silently corrupt any alert or backtest
built on those bars.

## Consequences

The chart can disagree with a reference quote by the provider's delay or contract basis, and it says
so. Gold is the clearest case: history is the COMEX front month, the reference is spot, and the
instrument panel states both plus the difference.

Costs: users sometimes see a price that differs from another site by a few pips. The alternative
was a chart that agreed with everyone and was a fabrication.

## Enforcement

- No adjustment function exists in the codebase.
- `fetchReference` returns a value that is only rendered in the instrument panel.
- `applyPrice` refuses a tick whose bar is stale, rather than extending it.
- `docs/source-audit.md` records the removal, and `providers-and-rights.yml` records the rule.
