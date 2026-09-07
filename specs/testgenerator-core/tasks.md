# TestGenerator Core Architecture Tasks

Architecture baseline approved. Implementation may start with `TG-TASK-001`. All tasks remain `TODO` until individually implemented and verified.

## TG-TASK-001 — Define minimal core contracts

- **Objective:** Define only shared primitives required by profiles, catalogs, normalized results, reporting, and incidents.
- **Estimated files:** `src/core/config/`, `src/core/cases/`, `src/core/reporting/`, `src/core/incidents/` contract files.
- **Requirements:** TG-REQ-001, TG-REQ-005, TG-REQ-007, TG-REQ-008.
- **Dependencies:** Human-approved proposal and reproducible TypeScript baseline.
- **Validation:** Targeted strict typecheck of contract files.
- **Status:** DONE

## TG-TASK-002 — Define and validate AppProfile

- **Objective:** Implement the declarative profile fields, optional values, capabilities, and safe defaults without application behavior.
- **Estimated files:** `src/core/config/app-profile.ts`, validation unit tests.
- **Requirements:** TG-REQ-002, TG-REQ-009.
- **Dependencies:** TG-TASK-001.
- **Validation:** Unit tests for valid, invalid, minimal, optional, default, and capability configurations; targeted typecheck.
- **Status:** DONE

## TG-TASK-003 — Add the minimal profile registry and resolver

- **Objective:** Resolve `APP_PROFILE` through a static map to a profile and adapter, failing explicitly for absent or unknown IDs.
- **Estimated files:** Composition entrypoint, static registry, resolver unit tests.
- **Requirements:** TG-REQ-002, TG-REQ-003.
- **Dependencies:** TG-TASK-002.
- **Validation:** Resolver unit tests for known, absent, and unknown profiles; search for reflection or dynamic discovery.
- **Status:** DONE

## TG-TASK-004 — Enforce the core/apps boundary

- **Objective:** Add a deterministic alias-aware check that prevents imports from `src/core` to `src/apps`.
- **Estimated files:** Boundary validation script, fixtures, `package.json` command.
- **Requirements:** TG-REQ-001, TG-REQ-003, TG-REQ-012.
- **Dependencies:** TG-TASK-003.
- **Validation:** Boundary check passes valid imports and rejects controlled relative and aliased violations.
- **Status:** DONE

## TG-TASK-005 — Implement catalog contract and validation

- **Objective:** Define the Playwright-independent case schema and validate fields, types, unique IDs, and spec traceability.
- **Estimated files:** `src/core/cases/`, catalog validator, catalog fixtures and unit tests.
- **Requirements:** TG-REQ-005, TG-REQ-012.
- **Dependencies:** TG-TASK-001, TG-TASK-004.
- **Validation:** Unit tests accept a complete catalog and reject missing fields, invalid types, duplicate IDs, and unknown spec case IDs.
- **Status:** DONE

## TG-TASK-006 — Implement minimal incident contracts

- **Objective:** Define classifier, incident model, minimum classifications, and the preview-only file provider without external adapters.
- **Estimated files:** `src/core/incidents/`, incident fixtures and unit tests.
- **Requirements:** TG-REQ-008, TG-REQ-009.
- **Dependencies:** TG-TASK-001, TG-TASK-004.
- **Validation:** Classifier/model unit tests and local preview proving no external request.
- **Status:** DONE

## TG-TASK-007 — Implement normalized results and reporting contracts

- **Objective:** Map Playwright results at the boundary and produce HTML, executive JSON, and executive Markdown without leaking Playwright internals into core models.
- **Estimated files:** `src/core/reporting/`, Playwright result adapter, reporting fixtures and unit tests.
- **Requirements:** TG-REQ-005, TG-REQ-007, TG-REQ-009.
- **Dependencies:** TG-TASK-001, TG-TASK-005, TG-TASK-006.
- **Validation:** Mapping unit tests and local generation of all three outputs from normalized fixtures.
- **Status:** DONE

## TG-TASK-008 — Establish unit and static quality gates

- **Objective:** Expose the smallest repeatable commands for strict typecheck, unit tests, boundaries, sanitize, catalog validation, and POM anti-pattern searches.
- **Estimated files:** `package.json`, validation scripts, unit test configuration and fixtures.
- **Requirements:** TG-REQ-004, TG-REQ-005, TG-REQ-009, TG-REQ-012.
- **Dependencies:** TG-TASK-002 through TG-TASK-007.
- **Validation:** Each static and unit control in `verification.md` produces an evidence-backed result; no remote execution is required.
- **Status:** DONE

## TG-TASK-009 — Prepare the first application adapter structure

- **Objective:** Create the required application, catalog, and test directories and compose profile, Pages, fixtures, services, and data without implementing application-specific scenarios or changing core.
- **Estimated files:** `src/apps/<application-id>/{config,pages,fixtures,services,data}/`, `cases/<application-id>/`, `tests/e2e/<application-id>/`.
- **Requirements:** TG-REQ-003, TG-REQ-004, TG-REQ-006.
- **Dependencies:** TG-TASK-003, TG-TASK-004, TG-TASK-008.
- **Validation:** Structure and typecheck gates pass, resolver lists the adapter, and no `src/core` file changes as part of adapter creation.
- **Status:** DONE

## TG-TASK-010 — Close governance and architecture verification

- **Objective:** Confirm implementation alignment with AGENTS, the skill, approved requirements, design boundaries, and the verification matrix.
- **Estimated files:** Verification record; governance artifacts only if an approved correction is required.
- **Requirements:** TG-REQ-010, TG-REQ-011, TG-REQ-012.
- **Dependencies:** TG-TASK-001 through TG-TASK-009.
- **Validation:** All applicable controls are PASS, FAIL, or BLOCKED with evidence, and every divergence has an explicit disposition.
- **Status:** DONE
