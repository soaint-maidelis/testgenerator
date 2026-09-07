# TestGenerator engineering contract

- Use a core-plus-adapters architecture. Customize applications through an app profile, adapter, catalog, Page Objects, fixtures, and services.
- Keep application behavior under `src/apps/<application-id>/`; core must never import or contain application-specific logic.
- Page Object Model is mandatory for reusable UI interaction. Specs express functional intent and avoid complex selectors or navigation logic.
- Reuse existing components before creating new abstractions.
- Keep fixtures small, typed, and focused on context, roles, Page Objects, services, or reusable setup.
- Treat the catalog as the source of functional traceability. Do not change existing cases without an explicit justification.
- Use semantic locators. Absolute XPath, `waitForTimeout`, and generic `networkidle` waiting are prohibited.
- Never weaken assertions to obtain a passing result.
- Incidents default to preview mode. Real incident connectors remain inactive unless a future, explicit requirement authorizes them.
- Keep secrets, credentials, tokens, private endpoints, and persistent browser state outside the repository.
- Run only the quality gates relevant to the current change.
- Stop and request direction when a material functional ambiguity cannot be resolved from the catalog or configured application.
- Route external test definitions through an InputAdapter before normalization.
- Never allow an InputAdapter to bypass catalog validation.
- Treat User Story output as candidates requiring QA review, never as approved cases.
- Never overwrite a production catalog without an explicit action.
- Generate Playwright only from catalog cases or candidates with an explicit QA approval record.
- Reuse application Pages, fixtures, services, and tests before creating components.
- Keep functional suites, features, risks, roles, and dependencies in the application TestStrategy; core owns only generic dimensions.

## Spec-Driven Development

- Architectural and other substantial changes must consult the applicable artifacts under `specs/`.
- A proposal must be approved before substantial implementation begins, and implementation must follow its `tasks.md`.
- The applicable `verification.md` defines closure; never change a requirement silently to obtain PASS.
- If implementation and an approved spec diverge, stop and report the divergence.
