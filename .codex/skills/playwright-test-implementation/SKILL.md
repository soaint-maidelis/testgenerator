---
name: playwright-test-implementation
description: Implement one catalog case for a configured application while preserving the TestGenerator architecture and reusing existing automation components.
---

# Playwright test implementation

Implement a catalog case within its resolved `applicationProfile`, respecting repository governance and reusing existing components before creating new ones.

**ONE CASE AT A TIME** is the default. Do not implement multiple cases unless the user explicitly requests them.

## Workflow

1. Read `AGENTS.md`.
2. Consult applicable active specs under `specs/`.
3. Resolve the requested `applicationProfile` through the framework's current application registry and resolver.
4. Locate `caseId` in the catalog or candidate preview. Stop if a candidate remains `REQUIRES_QA_REVIEW`; generation requires an explicit `APPROVED` record.
5. Inspect `src/apps/<application-id>/pages/`, `fixtures/`, `services/`, and `tests/e2e/<application-id>/`.
6. Read the resolved profile's `capabilities`; do not assume API, authentication, multiple roles, file operations, or incident integration.
7. Reuse existing components before creating or extending one.
8. Implement only the requested case and keep reusable UI interaction in Page Objects.
9. Run typecheck, catalog, boundaries, sanitize, POM anti-pattern checks, and any related unit test before the narrow Playwright case.
10. Record a concise generation summary including reused/created components and changed files, then stop.

Read [architecture.md](references/architecture.md) before deciding component ownership. Read [test-case-contract.md](references/test-case-contract.md) when interpreting or implementing a catalog case. Read [customization.md](references/customization.md) when the requested application structure is missing or incomplete.
