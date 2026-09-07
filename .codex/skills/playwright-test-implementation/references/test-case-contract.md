# Test case contract

The catalog under `cases/<application-id>/` is the source of functional traceability. Locate the requested `caseId` and retain its title, description, preconditions, data rules, steps, expected result, priority, type, tags, and automation status.

Implement only the requested case by default. Preserve meaningful assertions and independence from other cases. If the catalog is missing, contradictory, or materially ambiguous, stop and request direction instead of inventing behavior.

The spec should identify the case, use `test.step()` for business flow, and keep selectors and reusable interactions in Page Objects.
