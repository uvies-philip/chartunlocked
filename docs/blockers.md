# Blockers

Explicit, with the decision needed and the safe fallback in place. A blocker is not a reason to
stop unrelated work; it is a reason not to pretend a feature exists.

## BLOCK-HOST-001 Backend hosting for durable alerts, sync and replay

```yaml
id: BLOCK-HOST-001
feature_ids: [ALT-01, WSP-01, RPL-01, BKT-01]
category: infrastructure_and_cost
needed_from: product_owner
required_decision: >
  Choose a host and budget for an API, a database and a scheduled worker. GitHub Pages cannot run
  server processes, and its terms do not cover a commercial SaaS.
work_completed: >
  Client architecture is ready for it: provenance-carrying domain types, a provider adapter
  boundary, and a rule-shaped data flow. No alert code is shipped, so nothing promises more than
  it delivers.
safe_fallback: In-app only. The UI states that alerts are not available in this build.
production_impact: No persistent alerts, no cross-device sync.
status: open
```

## BLOCK-DATA-001 Licensed market data

```yaml
id: BLOCK-DATA-001
feature_ids: [CH-01, WAT-01, ALT-01, TRD-01]
category: licensing_and_integration
needed_from: product_owner
required_decision: >
  Select a provider with documented display and redistribution rights, and approve the budget.
work_completed: Adapter interface, provenance model, rights registry, delayed and demo modes.
safe_fallback: Delayed non-crypto data through the relay, labelled. Demo fixtures for offline.
production_impact: Non-crypto data is delayed and its rights are unverified. Not shippable as a
  commercial service in this form.
status: open
```

## BLOCK-NGX-001 Nigerian Exchange data

```yaml
id: BLOCK-NGX-001
feature_ids: [NGR-02]
category: licensing_and_integration
needed_from: product_owner
required_decision: Contract an authorised NGX vendor or distribution licence.
work_completed: The instrument model supports venue, currency, calendar and entitlement fields.
safe_fallback: No NGX instruments are listed. USDNGN is offered as a reference FX rate only.
production_impact: No Nigerian equity coverage.
status: open
```

## BLOCK-BRAND-001 Brand and domain

```yaml
id: BLOCK-BRAND-001
feature_ids: [SEC-01]
category: legal
needed_from: product_owner
required_decision: >
  Confirm the ChartUnlocked name is clear for the intended market, and register a domain if a
  production deployment follows. The brand is a single constant in the source so it can change.
work_completed: Brand is configurable; no trademark symbol is displayed; no competitor assets used.
safe_fallback: GitHub Pages project URL.
status: open
```

## BLOCK-A11Y-001 Screen-reader data table

```yaml
id: BLOCK-A11Y-001
feature_ids: [CH-31]
category: accessibility
needed_from: implementation
required_decision: Design the table, its pagination and its announcement behaviour.
work_completed: Text legend, labelled controls, visible focus, keyboard shortcuts.
safe_fallback: The legend exposes the current values as text.
production_impact: WCAG 2.2 AA not yet met for chart data.
status: open
```
