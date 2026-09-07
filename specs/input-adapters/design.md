# Design

`src/core/input` defines format-neutral contracts, validation orchestration, and a static registry factory. Implementations under `src/input-adapters` own all XLSX, JSON-shape, and User Story syntax knowledge.

Adapters receive source bytes plus import context and return the same catalog shape consumed by TestGenerator, enriched only with optional `source`, `sourceType`, `reviewStatus`, and preview warnings. The existing catalog validator is always called before output.

The CLI composes the static registry, writes preview artifacts, and never updates `cases/**`.
