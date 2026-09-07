# Final demo script — 15 minutes

## 0–2 min — Positioning

Present TestGenerator as a governed accelerator connecting requirements, application-specific automation, execution strategy, and evidence. Use SauceDemo as the primary live demo; keep `demo-local` ready as the offline fallback.

## 2–5 min — From requirement to automated test

Show `inputs/user-story/cart-story.md`, run `npm run demo:inputs`, and point out normalized candidates marked `REQUIRES_QA_REVIEW`. Show the explicit approval for `US-SD-CART-001-AC-2`, then run its read-only generation plan. Emphasize reuse detection before implementation.

Flow: Input → Normalize → QA Review → Generate → Validate → Group → Execute → Evidence.

## 5–8 min — Governed generation

Run `npm run demo:generation`. Show the selected candidate, source traceability, approval status, existing similar tests, reusable LoginPage/InventoryPage/fixture/data, expected file changes, required gates, and measured generation JSON. If demonstrating Codex live, use the exact prompt from `docs/DEMO.md` and invoke the local `playwright-test-implementation` skill for one case only.

## 8–10 min — TestStrategy

Run `npm run demo:strategy`. Explain that core understands generic dimensions while SauceDemo defines authentication, inventory, cart, checkout, smoke, regression, critical, risk, role, and optional dependencies. Demonstrate `tests:group` with `--list-only` before any selected execution.

## 10–13 min — SauceDemo execution and evidence

Run `npm run demo:sauce:headed`. Follow valid login, cart, and checkout. Open Playwright HTML plus executive JSON/Markdown. Show the synthetic incident preview and clarify that no external provider is active.

## 13–15 min — Customization and fallback

Show `src/apps/saucedemo`, `src/apps/demo-local`, and shared `src/core`. Explain the normal customization list and the factors that drive effort without inventing hours or savings. Close with `demo-local` as the deterministic no-internet fallback.
