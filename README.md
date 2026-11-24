# ChartUnlocked

A chart-first workspace for analysing markets, developing ideas and reviewing decisions.
Built as a static, keyless, browser-only application: no account, no backend, no API key.

**Status: Milestone M1 (single-chart vertical slice) implemented and deployed. This is not
TradingView parity.** See [docs/implementation-status.md](docs/implementation-status.md) for the
honest per-feature ledger and [docs/feature-parity.yml](docs/feature-parity.yml) for machine-readable state.

## What works today

- Candlestick, OHLC bar, line and area charts on a stable chart engine adapter
- Seven intervals from 1m to 1W, per-instrument digits and tick size
- Eight validated indicators: SMA, EMA, Bollinger Bands, VWAP, RSI, MACD, ATR, Stochastic
- Seven drawing tools: trend line, horizontal line, vertical line, rectangle, Fibonacci
  retracement, measure, text note. Real undo and redo, delete on its own control
- Symbol search with `Ctrl/Cmd+K`, eight-instrument watchlist with batched quotes
- Local workspace persistence with a one-shot, idempotent import of the previous `chartdesk.*` storage
- Provenance panel: provider, mode, price kind, bar count, and the reference quote difference
- Dark and light themes, responsive layout down to 360 px, keyboard shortcuts, visible focus

## What is deliberately not here yet

Alerts, replay, multi-chart layouts, screening, scripting, backtesting, paper trading, broker
connections, collaboration, AI and MCP. They are roadmap items in the specification, not hidden
or mocked features. Nothing in the interface pretends otherwise.

## Data sources

| Purpose | Provider | Mode | Notes |
| --- | --- | --- | --- |
| Crypto candles and ticks | Binance public REST + trade socket | Live | Same provider for history and ticks, so the forming bar is updated from its own feed |
| FX, metals, indices, equities | Yahoo Finance via the `r.jina.ai` relay | Delayed (typically 1-15 min) | Yahoo sends no CORS headers; the relay mirrors the JSON |
| Reference quote | TradingView public scanner | Reference only | Shown in the instrument panel for comparison, never merged into candles |
| Offline fallback | Deterministic fixture | Demo | Clearly labelled "Demo data" in the legend |

Two rules are enforced in code, because breaking them is how charting tools become dishonest:

1. **No cross-feed history shifting.** A quote from one provider is never written into bars from
   another. Gold history is the COMEX front month and the reference quote is spot, so they are
   displayed side by side, separately labelled, and never averaged or offset.
2. **No invented bars.** If a bar is stale relative to the interval, incoming ticks do not stretch
   it. A new bar opens on the interval boundary instead.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests
npm run build      # type-check and bundle to dist/
npm run preview    # serve the production build
```

Requires Node 20+. No environment variables and no secrets.

## Deploying

GitHub Pages serves the built site from `/chartunlocked/`. Pushing to `main` runs the workflow in
`.github/workflows/deploy.yml`, which builds and publishes `dist/`.

## Licence

MIT for this application. Lightweight Charts is Apache-2.0 and its notice is retained in the bundle
and in [NOTICE](NOTICE). Chart data remains subject to each provider's terms; see
[docs/providers-and-rights.yml](docs/providers-and-rights.yml) before offering this as a public service.
