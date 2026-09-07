# TestGenerator Core Architecture Verification

Every control records PASS, FAIL, or BLOCKED with a command or review artifact. Requirements must not be weakened to change a result.

## Static controls

| Control | Requirements | Verification |
|---|---|---|
| Strict typecheck | TG-REQ-001, TG-REQ-002, TG-REQ-003, TG-REQ-005, TG-REQ-007, TG-REQ-008, TG-REQ-012 | Active files compile with zero diagnostics and no emit. |
| Dependency boundary | TG-REQ-001, TG-REQ-003, TG-REQ-012 | Alias-aware validation finds no import from `src/core` to `src/apps` and rejects controlled relative and aliased violations. |
| Sanitize | TG-REQ-009, TG-REQ-012 | Finds no prohibited references, secrets, private endpoints, persistent storage state, or unsafe generated paths. |
| POM anti-pattern search | TG-REQ-004, TG-REQ-006, TG-REQ-012 | Finds no absolute XPath, `page.waitForTimeout`, generic `networkidle`, or unjustified complex selectors directly in specs. Trivial justified locators remain reviewable exceptions. |
| Application structure | TG-REQ-003, TG-REQ-006 | Confirms required `config`, `pages`, `fixtures`, `services`, `data`, catalog, and E2E paths without a core diff. |
| Catalog schema and IDs | TG-REQ-005, TG-REQ-012 | Confirms all required fields and types, unique IDs, and valid spec-to-case references. |

## Unit controls

| Control | Requirements | Verification |
|---|---|---|
| AppProfile validation | TG-REQ-002 | Accepts complete and minimal profiles and rejects missing or invalid required fields. |
| AppProfile defaults | TG-REQ-002, TG-REQ-009 | Verifies optional API, one-role/no-auth operation, disabled capabilities, conservative evidence retention, and preview/file incident defaults. |
| Capabilities | TG-REQ-002 | Verifies initial capability keys as declarative data and tolerates absent optional capabilities without handlers. |
| Profile resolver | TG-REQ-002, TG-REQ-003 | Resolves known static entries and fails explicitly for absent or unknown `APP_PROFILE`. |
| Catalog validation | TG-REQ-005 | Accepts a complete case and rejects duplicate IDs, invalid types, missing fields, and unknown traceability references. |
| Failure classifier | TG-REQ-008 | Covers `PRODUCT_DEFECT`, `AUTOMATION_DEFECT`, `TEST_DATA`, `ENVIRONMENT`, and `UNKNOWN`; generic failure does not default to product defect. |
| Incident model | TG-REQ-008, TG-REQ-009 | Preserves normalized failure, classification, evidence references, simulated marker, and safe provider policy. |
| Normalized reporting model | TG-REQ-005, TG-REQ-007 | Maps pass, fail, and skipped inputs without exposing Playwright internal objects or application-specific imports. |

## Local integration controls

| Control | Requirements | Verification |
|---|---|---|
| File incident preview | TG-REQ-008, TG-REQ-009, TG-REQ-012 | A controlled normalized failure writes a simulated preview through `INCIDENT_MODE=preview` and `INCIDENT_PROVIDER=file`. |
| Executive reporting | TG-REQ-005, TG-REQ-007, TG-REQ-012 | Normalized fixtures produce equivalent executive JSON and Markdown with case, outcome, duration, classification, and evidence paths. |
| Playwright HTML boundary | TG-REQ-007 | The Playwright adapter produces standard HTML while core reporting consumes only normalized results. |
| No external calls | TG-REQ-008, TG-REQ-009 | Default and preview executions perform no Jira, Azure DevOps, Trello, or other external incident request. |
| Evidence security | TG-REQ-009 | Evidence uses ignored safe paths, sanitized summaries, synthetic data where practical, and configured retention defaults. |

## Remote controls

| Control | Requirements | Verification |
|---|---|---|
| Reference application smoke | TG-REQ-003, TG-REQ-004, TG-REQ-005, TG-REQ-006, TG-REQ-012 | A narrow Playwright smoke run uses catalog case IDs after all required structural and local controls pass. |

Remote controls are opt-in and are never mandatory gates for ordinary local development or every pull request.

## Governance control

Review `AGENTS.md`, the implementation skill, and active specs against TG-REQ-010, TG-REQ-011, and TG-REQ-012. Confirm one-case-at-a-time behavior, POM boundaries, no concrete application leakage, and no silent requirement changes.

## Closure rule

Architecture verification closes only when every control required by completed tasks has an evidence-backed result and each BLOCKED or FAIL result has an explicit disposition. Remote controls run only when authorized and when their structural and local prerequisites pass.
