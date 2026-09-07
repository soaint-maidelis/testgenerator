# Design

Approval and generation records remain preview artifacts. The generation CLI reads normalized candidates, approval records, application components, catalog, and TestStrategy. It does not invoke an external model.

`src/core/strategy` validates generic strategy metadata and selection. SauceDemo owns its features, suites, risks, roles, and dependencies under its adapter boundary.
