# TestGenerator Core Architecture

Status: **APPROVED**

## Approval

Status: APPROVED

Approved baseline includes:

- Core separated from applications.
- Declarative `AppProfile`.
- One `ApplicationAdapter` per application.
- Mandatory POM for UI automation.
- Small typed fixtures.
- Services for API, data preparation, and cleanup.
- Traceable catalog.
- Normalized results.
- HTML, JSON, and Markdown reporting.
- Incident classifier, model, and provider separation.
- `INCIDENT_MODE=preview` by default.
- `INCIDENT_PROVIDER=file` by default.
- AGENTS, Skills, and SDD governance.
- Minimal static resolver.
- Multi-application customization.
- Security and evidence handling.

## Problem

The current neutral baseline does not yet provide a formal boundary between reusable framework capabilities and application-specific automation. Without that boundary, adding an application can couple configuration, tests, reporting, and data preparation to the core.

## Objective

Define a governed architecture that keeps TestGenerator reusable while allowing independently configured application adapters and traceable Playwright automation.

## Scope

- Generic core capabilities.
- The `AppProfile` contract.
- Declarative capabilities and safe profile defaults.
- A minimal static profile registry and resolver.
- Application adapters.
- Versioned test catalogs.
- Page Object Model conventions.
- Typed fixtures and services.
- Reporting and evidence contracts.
- File-based incident preview.
- Permanent governance through `AGENTS.md`.
- Specialized implementation skills.

## Out of scope

- Mobile automation.
- Autonomous self-healing.
- Automatic creation of real bugs.
- Multi-framework support.
- A hosted SaaS offering.
- A web administration portal.

## Proposed architecture

Create an application-independent core that defines small contracts for profiles, catalogs, normalized results, reporting, and incidents. `APP_PROFILE` selects a profile and adapter through a static map that fails explicitly for absent or unknown IDs. Each application supplies declarative configuration, capabilities, Pages, fixtures, services, data, catalog, and tests without changing core. A Playwright boundary produces normalized results for independent reporting and incident flows. Reporting initially produces Playwright HTML, executive JSON, and executive Markdown; incidents separate classification, model, and provider and default to preview plus file. Repository rules, skills, and specs govern changes.

## Alternatives considered

1. **Single application-oriented framework:** initially smaller, but couples business behavior to reusable infrastructure and makes later customization expensive.
2. **Plugin system with runtime discovery:** flexible, but adds lifecycle and loading complexity before the product has stable contracts.
3. **External SDD platform:** potentially richer workflow automation, but introduces dependencies and operating overhead not justified for the current repository.

The proposed core-plus-adapters model provides explicit boundaries with the least required mechanism.

## Risks

- Preserved reporting and incident code may not fit the new contracts without incremental migration.
- An oversized `AppProfile` could become a container for unrelated application logic.
- Fixtures or Page Objects may bypass boundaries unless reviews and tests enforce them.
- Quality gates cannot provide confidence until the dependency installation and TypeScript baseline are reproducible.

## Pending decisions

- Exact TypeScript representations for the approved `AppProfile` fields and capability extension point.
- Static registry file placement and composition entrypoint.
- Catalog schema validation library or dependency-free validation.
- Minimal normalized result contract for reporting.
- Migration sequence for preserved incident and reporting modules.

## Success criteria

- Core has no imports from application implementations.
- A configured application can be added through its adapter and catalog without modifying core.
- Minimal applications work without an API, multiple roles, reusable authentication, or external incident provider.
- UI tests follow POM and use typed fixtures and services with clear responsibilities.
- Catalog cases remain traceable to tests and execution results.
- Playwright results are normalized without leaking runner internals, and reporting produces HTML, JSON, and Markdown outputs.
- Failure classification does not assume product defect, and incident previews are generated locally through the file provider without external calls.
- Typecheck, unit, boundary, catalog, sanitize, and targeted execution controls verify the architecture incrementally.
