# Architecture responsibilities

TestGenerator uses `CORE + APP PROFILE + ADAPTER + CATALOG + POM + FIXTURES + SERVICES`.

- `src/core/` owns application-independent configuration, catalogs, reporting, and incident contracts.
- `src/apps/<application-id>/` owns the profile and adapter implementation.
- `pages/` encapsulates reusable UI interactions with semantic locators.
- `services/` owns API calls, data preparation, cleanup, and non-UI operations.
- `fixtures/` composes typed context, Page Objects, enabled services, and reusable setup.
- `tests/e2e/<application-id>/` contains specs that express functional intent.

Core must not import from an application adapter. A spec owns functional intent and assertions; a Page Object owns reusable UI interaction; a service owns API, data, and cleanup; a fixture owns composition and context.

Use only the current aliases `@core/*` and `@apps/*`. Do not assume a global fixture alias. Absolute XPath, `waitForTimeout`, generic `networkidle`, complex selectors in specs, duplicated navigation, and weakened assertions are not acceptable implementation paths.
