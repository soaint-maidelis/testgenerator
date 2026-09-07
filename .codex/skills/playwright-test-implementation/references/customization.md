# Application customization

Resolve `applicationProfile` through the current static registry and resolver before implementation. Application-specific files belong under `src/apps/<application-id>/`, E2E specs under `tests/e2e/<application-id>/`, and catalog entries under `cases/<application-id>/`.

Read profile `capabilities` before choosing dependencies. When `apiDataSetup=false`, do not require an API service. When `authentication=false`, do not require an authentication fixture. When `multiRole=false`, do not invent roles. Treat file operations and incident integration as optional in the same way.

Prefer extending the existing adapter. A normal application addition must not modify core. If the required profile or adapter does not exist, report the missing prerequisite; create structural pieces only when the user has authorized that scope.
