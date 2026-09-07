# TestGenerator Architecture Baseline

This approved baseline governs Phase 2. Its invariants cannot be changed silently; later architectural changes return to the SDD flow.

## Invariants

- **TG-BASE-001:** `src/core` does not import `src/apps`.
- **TG-BASE-002:** A normal application is added through `AppProfile` plus `ApplicationAdapter`.
- **TG-BASE-003:** UI automation uses POM as its primary pattern.
- **TG-BASE-004:** The catalog preserves `caseId` as the primary traceability key.
- **TG-BASE-005:** Reporting consumes normalized results.
- **TG-BASE-006:** Failures are not classified automatically as `PRODUCT_DEFECT`.
- **TG-BASE-007:** Incidents default to preview mode with the file provider.
- **TG-BASE-008:** External providers are opt-in.
- **TG-BASE-009:** `AGENTS.md` defines permanent repository rules.
- **TG-BASE-010:** Skills implement specialized procedures and respect applicable specs.
- **TG-BASE-011:** Later architectural changes return to the SDD flow.
- **TG-BASE-012:** The MVP adds no plugin framework, dependency-injection framework, SaaS, mobile automation, or multi-framework abstraction.

## Technical baseline

- Active base: TypeScript 7.0.2.
- `strict`: `true`.
- `typecheck`: PASS.
- Package type: `commonjs`.
- `module`: `Node16`.
- `moduleResolution`: `Node16`.
- Aliases: `@core/*`, `@apps/*`.

## Preserved modules

The following modules are **PRESERVED / PENDING MIGRATION / NOT YET VALIDATED**:

- `integrations/**`
- `reporters/**`
- `scripts/**`

The active-base typecheck does not validate these modules. They must be migrated and verified incrementally before being reported as approved.
