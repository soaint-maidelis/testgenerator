# TestGenerator Core Architecture Requirements

## TG-REQ-001 — Core and application separation

- **Description:** Application-independent behavior must live in core, while application behavior must live in an application adapter.
- **Priority:** MUST
- **Acceptance criteria:** A dependency-boundary check reports no import from `src/core/` to `src/apps/`.
- **Affected components:** Core, application adapters, dependency-boundary validation.

## TG-REQ-002 — AppProfile contract

- **Description:** Core must expose a declarative typed `AppProfile` contract with `id`, `displayName`, `baseURL`, optional `apiURL`, `roles`, `testMatch`, `capabilities`, `featureFlags`, `evidencePolicy`, and `incidentPolicy`. Capabilities are data, initially covering `authentication`, `apiDataSetup`, `fileUpload`, `fileDownload`, `multiRole`, `networkInterception`, and `incidentReporting`; they do not introduce handlers or class hierarchies.
- **Priority:** MUST
- **Acceptance criteria:** Unit tests accept a complete valid profile, reject missing or invalid required fields, reject an unknown profile ID, and verify safe defaults: `apiURL` absent, one default role without reusable authentication, all capabilities disabled unless declared, conservative evidence retention, and `incidentPolicy` set to `preview` with provider `file`.
- **Affected components:** Core configuration, profile validation, application adapters.

## TG-REQ-003 — Application customization without core changes

- **Description:** A normal application must be configurable through an `ApplicationAdapter` without editing core implementation files. The adapter is technical implementation and remains separate from the declarative `AppProfile`. Its convention is `src/apps/<application-id>/{config,pages,fixtures,services,data}/`, with catalog at `cases/<application-id>/` and specs at `tests/e2e/<application-id>/`. A future `npm run app:scaffold` must create this structure without changing `src/core`.
- **Priority:** MUST
- **Acceptance criteria:** A fixture application adapter can be registered, resolved, listed, scaffolded to the required paths, and typechecked with no modification under `src/core/`; missing `APP_PROFILE` values fail with an explicit error.
- **Affected components:** Adapter selection, application profile, application directory convention.

## TG-REQ-004 — Mandatory Page Object Model

- **Description:** Reusable UI interaction must be encapsulated in Page Objects using semantic locators; specs retain functional intent.
- **Priority:** MUST
- **Acceptance criteria:** Review of representative UI specs finds no complex reusable selector or navigation flow embedded in the spec and no absolute XPath.
- **Affected components:** Application Page Objects, E2E specs, review controls.

## TG-REQ-005 — Traceable catalog

- **Description:** Each automated case must originate from a Playwright-independent versioned catalog entry containing `caseId`, `title`, `description`, `preconditions`, `inputData`, `steps`, `expectedResults`, `priority`, `type`, `tags`, and `automationStatus`.
- **Priority:** MUST
- **Acceptance criteria:** Catalog validation rejects duplicate IDs, invalid field types, and missing required fields; every implemented spec references an existing `caseId`, and execution data preserves the chain `caseId -> Playwright spec -> execution -> evidence -> report -> incident`.
- **Affected components:** Catalog contracts, catalog validator, E2E tests, reporting.

## TG-REQ-006 — Typed fixtures and services

- **Description:** Small typed fixtures must compose context, Page Objects, and services; services own API, data preparation, cleanup, and non-UI operations.
- **Priority:** MUST
- **Acceptance criteria:** Typecheck validates fixture composition, and a responsibility review finds no reusable API or cleanup logic embedded in UI specs.
- **Affected components:** Application fixtures, services, E2E tests.

## TG-REQ-007 — Evidence and reporting

- **Description:** A Playwright boundary adapter must map runner data into a `NormalizedTestResult` that exposes no internal Playwright objects to the rest of core. Reporting consumes normalized results and initially produces Playwright HTML, executive JSON, and executive Markdown containing case, outcome, duration, classification, and evidence paths. No Selenium or Cypress abstraction is required.
- **Priority:** MUST
- **Acceptance criteria:** Unit tests map pass, fail, and skipped Playwright results to the normalized contract without leaking runner objects or application imports; local integration generates Playwright HTML plus equivalent executive JSON and Markdown summaries.
- **Affected components:** Core reporting, result contract, evidence collection.

## TG-REQ-008 — Safe incident preview

- **Description:** Incident management must separate `FailureClassifier`, `IncidentModel`, and `IncidentProvider`. Defaults are `INCIDENT_MODE=preview` and `INCIDENT_PROVIDER=file`. Minimum classifications are `PRODUCT_DEFECT`, `AUTOMATION_DEFECT`, `TEST_DATA`, `ENVIRONMENT`, and `UNKNOWN`; a failed test never implies `PRODUCT_DEFECT` automatically. Jira, Azure DevOps, and Trello are future opt-in provider adapters and are not required by the MVP runtime.
- **Priority:** MUST
- **Acceptance criteria:** Unit tests exercise all minimum classifications and the non-product default; local integration maps a controlled normalized failure through classifier and model to a simulated file preview while proving that no external request occurs.
- **Affected components:** Core incidents, file provider, incident policy, execution configuration.

## TG-REQ-009 — Security baseline

- **Description:** No secret, credential, private endpoint, or persistent authentication state may be versioned. Storage state must be ephemeral and ignored; test data should be synthetic when possible. Evidence is potentially sensitive and requires safe paths, sanitization, and an explicit retention policy. Incident mode defaults to preview, and external providers are opt-in only.
- **Priority:** MUST
- **Acceptance criteria:** Sanitize checks find no prohibited references, secrets, private endpoints, or persistent storage state; ignore rules cover authentication and generated artifacts; tests verify safe evidence paths and retention defaults; default execution cannot activate an external incident provider.
- **Affected components:** Repository configuration, application configuration, sanitize gate.

## TG-REQ-010 — Configurable implementation skill

- **Description:** The Playwright implementation skill must resolve `applicationProfile` and `caseId`, respect active specs, and reuse existing components before creation.
- **Priority:** SHOULD
- **Acceptance criteria:** Skill review confirms one-case-at-a-time behavior, active-spec awareness, and no concrete application data.
- **Affected components:** Local Playwright implementation skill, catalogs, application adapters.

## TG-REQ-011 — Permanent agent contract

- **Description:** `AGENTS.md` must define permanent architecture, quality, security, POM, and SDD constraints for repository agents.
- **Priority:** MUST
- **Acceptance criteria:** Governance review confirms the required constraints and identifies no conflict with the approved architecture spec.
- **Affected components:** `AGENTS.md`, agent-driven workflows, SDD artifacts.

## TG-REQ-012 — Incremental quality gates

- **Description:** Architecture changes must be verified with the narrowest relevant typecheck, unit, boundary, catalog, sanitize, preview, and smoke controls.
- **Priority:** MUST
- **Acceptance criteria:** Each implementation task names its relevant validation, and the verification record shows every required control as PASS, FAIL, or BLOCKED with evidence.
- **Affected components:** Package scripts, validation utilities, CI design, verification records.
