# ADR-001: Static React + TypeScript client, no backend in M1

- Status: accepted
- Date: 2026-11-24

## Context

The specification proposes a modular monolith: React + Vite web, Fastify API, PostgreSQL, Redis,
a WebSocket gateway, workers, and a sandboxed script runner. It also states that the first
production feed, paid hosting, and any commercial service are owner decisions, and that a demo-only
deployment is preferable to a misleading live one.

The current deployment target is GitHub Pages, which serves static files only. There is no approved
backend host, no database, and no budget for one.

## Decision

Ship M0 and M1 as a static application:

- React 19 + strict TypeScript + Vite, no server rendering.
- Lightweight Charts behind an application-owned `ChartEngine` adapter, so the renderer can be
  replaced without touching domain code.
- Local-first persistence in `localStorage` with a versioned schema and a legacy import path.
- Provider access directly from the browser to keyless public endpoints.
- No alerts, no sync, no replay, no execution: those need the server and are explicitly absent.

## Consequences

Positive: deployable today, zero hosting cost, no secret handling, fast iteration, and the domain
types (`Instrument`, `Provenance`, `Bar`) already carry the fields a server would need.

Negative: no durable alerts, no cross-device sync, no rate-limit backstop of our own, and the
relay dependency is visible to users. All three are recorded in `blockers.md` rather than papered
over.

Reversal path: the provider adapter and domain contracts are transport-agnostic. Moving to an API
means replacing `data/providers.ts` calls with fetches to the same shapes.

## Rejected alternatives

- **Keep the previous plain-ES-module single-page code.** No type safety, no test runner, and the
  data-integrity defects were woven through the same file as the UI.
- **Next.js or a hosted BaaS.** Adds a vendor dependency and a build/runtime split that the current
  scope does not justify.
- **Wait for backend approval before building.** The specification is explicit that independent
  work continues while approvals are pending.
