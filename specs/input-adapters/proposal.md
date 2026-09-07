# Input Adapters Proposal

Status: APPROVED

Add a small input boundary so Excel, JSON, and structured User Stories converge on the existing normalized test catalog without coupling source formats to applications or catalog consumers.

Flow: INPUT → ADAPTER → NORMALIZATION → VALIDATION → PREVIEW → HUMAN APPROVAL.

Production catalogs are never overwritten automatically. External connectors and AI-assisted generation remain out of scope.
