# Next session

## State

- Branch: `main`
- Build: 0.1.0, Vite 7.1.12, React 19.2.0, TypeScript 5.9.3, Lightweight Charts 5.3.0
- Checks: `npx tsc -p tsconfig.json --noEmit` exit 0, `npx vitest run` 42 passed, `npx vite build` clean
- Deployed: GitHub Pages, `/chartunlocked/`

## Working now

Chart with four chart types and seven intervals, eight indicators, seven drawing tools with
undo/redo, symbol search, watchlist with batched quotes, local persistence with legacy import,
provenance panel, dark and light themes, responsive down to 360 px.

## Smallest useful next step

Implement `CH-31`: a paginated, screen-reader-accessible OHLC and indicator table for the visible
range, opened from the more menu. It closes the only accessibility blocker that is fully in our
control and it needs no new data or backend.

## Following steps in order

1. Indicator parameter editor (GAP-02), reusing the existing `params` schema.
2. Playwright suite in CI so the browser checks stop being manual (GAP-05).
3. Drawing tools at mobile widths (the rail hides below 640 px).
4. Multiple watchlists and reordering (WAT-01 remainder).
5. Only then evaluate M2 scale types and multi-chart layouts.

## Don't repeat

- Do not patch bars with quotes from another provider. See ADR-002.
- Do not add a feature to the interface before its data path is real.
- The relay can return three shapes: raw JSON, `{code,status,data}` and a reader page with
  `content` plus `httpStatus`. Always unwrap before parsing; there is a test for each shape.
- Relay budget is roughly 20 requests a minute, so batch the watchlist and keep the minimum gap.

## Open blockers

`BLOCK-HOST-001` (backend for alerts, sync, replay), `BLOCK-DATA-001` (licensed data),
`BLOCK-NGX-001` (Nigerian equities), `BLOCK-A11Y-001` (data table), `BLOCK-BRAND-001` (name and
domain). None of them block the next step above.
