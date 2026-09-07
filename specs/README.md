# Spec-Driven Development

The `specs/` directory is the versioned source of intent, decisions, and verification for significant TestGenerator changes. `AGENTS.md` remains the permanent repository contract, while specialized skills define focused implementation procedures.

## When SDD is required

Use SDD when a change:

- modifies architecture;
- creates a new core capability;
- adds a new integration type;
- changes the `AppProfile` contract;
- significantly changes reporting or incidents;
- introduces a new execution strategy;
- affects multiple modules non-trivially; or
- contains functional or technical decisions that must remain documented.

Do not require SDD for small corrections, cosmetic changes, text-only updates, an isolated locator, or a clearly understood mechanical adjustment.

## Required flow

`EXPLORE -> PROPOSAL -> APPROVAL -> REQUIREMENTS -> DESIGN -> TASKS -> IMPLEMENT -> VERIFY`

No significant implementation may begin before its proposal is approved. Requirements and design must remain consistent with that approval. Implementation follows the ordered task list, and verification closes the change against explicit acceptance criteria.

If implementation evidence conflicts with the approved spec, stop and resolve the divergence openly; do not silently rewrite requirements to obtain a passing result.
