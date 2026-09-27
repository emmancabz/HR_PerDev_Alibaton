# Performance HostForge Speed V3 — Global Operational Read Cache

Scope: system-wide production read-path optimization for the main P&D application modules.

Covered:
- Dashboard: keeps the existing short production aggregate cache already in DashboardController.
- Header notifications: assumes the already-deployed V1 per-user Redis cache/deduplication fix remains in place.
- User Management directory.
- Performance API state.
- Competency / Development page + state.
- Learning / Assessments / Certificates page + state.
- Training page + state.
- Succession page + state.
- Recognition / Leaderboard page + state.
- Reports page + filtered state.

Correctness controls:
- Cache is production-only and per user + role.
- Read-model TTL is 60 seconds.
- Successful domain mutations bump a generation token, so later reads rebuild immediately instead of waiting for TTL expiry.
- State controllers do NOT use cache when invoked from POST/PUT/PATCH/DELETE, preventing stale mutation responses.
- Reports and User Management caches are invalidated by cross-module writes because they aggregate data from multiple domains.
- Auth, MFA, passkeys, password/session security and security-sensitive Settings state are intentionally not cached or changed.

Database:
- Includes the V2 Learning/Training read-path index migration.
- Does not add speculative indexes to other modules without query-plan evidence.

Apply this V3 instead of the earlier V2 package. V3 contains the V2 read-cache/index work plus the additional operational modules above.
