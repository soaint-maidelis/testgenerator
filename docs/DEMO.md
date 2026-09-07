# TestGenerator demo

## Main and fallback modes

SauceDemo is the primary commercial demo: `npm run demo:sauce` or `npm run demo:sauce:headed`. The deterministic offline fallback remains `npm run demo:local` or `npm run demo:local:headed`. RealWorld is an optional external reference.

## From requirement to automated test

Input → Normalize → QA Review → Generate → Validate → Group → Execute → Evidence.

Run `npm run demo:inputs`, approve the selected candidate with `npm run candidate:approve -- --app saucedemo --case US-SD-CART-001-AC-2`, and inspect the read-only plan with `npm run generation:plan -- --app saucedemo --case US-SD-CART-001-AC-2`. The exact live Codex prompt is:

> Use the playwright-test-implementation skill for applicationProfile=saucedemo and caseId=US-SD-CART-001-AC-2. Verify explicit QA approval, reuse existing POM/fixtures/services, implement only this case, run the required quality gates and narrow test, record generation metrics, summarize, and stop.

`npm run demo:generation` presents the complete governed handoff without invoking Codex automatically. `npm run demo:strategy` lists smoke, checkout, and high-priority selections without opening a browser.

## Customization model

- Input: Excel, JSON, or structured User Story through an InputAdapter.
- Application: AppProfile, ApplicationAdapter, POM, Services, Fixtures, TestStrategy, and catalog cases.
- Output: normalized results, reports, evidence, and preview-only Incident Provider.

For a new application, normally customize AppProfile, adapter, POM, fixtures, services, TestStrategy, and catalog. Add a new InputAdapter or IncidentProvider only when required. Core, reporting contracts, AI governance, SDD rules, and quality gates normally remain unchanged.

Effort depends on authentication, roles, UI complexity, selector quality, API availability, data, integrations, and case volume/complexity. No hours, ROI, or savings are claimed without measurement.

## Evolution

Before: Fixed Excel → Python conversion → Markdown → project-specific automation.

Now: Excel / JSON / User Story → Input Adapter → Normalized Catalog → QA Approval → Governed Generation → App Adapter → TestStrategy → Playwright → Reporting / Incident Provider.

This is an evolution toward flexible inputs, reusable application boundaries, governance, and measurable evidence.
