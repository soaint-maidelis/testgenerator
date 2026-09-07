# RealWorld demo catalog

| caseId | Intent | Tags |
|---|---|---|
| RW-AUTH-001 | Sign in with an execution-scoped synthetic user | smoke, auth |
| RW-AUTH-002 | Reject unique invalid credentials with a visible message | smoke, auth |
| RW-ARTICLE-001 | Publish and verify a unique article | smoke, article |
| RW-ARTICLE-002 | Edit an article and verify persistence | article |
| RW-COMMENT-001 | Create and remove a unique comment | comment |
| RW-INCIDENT-001 | Produce a local preview from an explicitly simulated DELETE failure | incident, simulated |

The JSON catalog is authoritative. Each automated spec retains its `caseId`; all users and content are synthetic and unique per execution.
