# Performance HostForge V4 — Instant Navigation + Automatic Fresh Data

Source basis: `PERFORMANCE_CURRENT_AFTER_V3_20260927-140010.zip`.

## Goal

Make operational navigation feel immediate while keeping authoritative data fresh without requiring users to press F5.

## What changes

- Heavy page routes render lightweight Inertia shells instead of blocking navigation on large PostgreSQL read models.
- Dashboard and Settings heavy props use Inertia deferred props.
- Learning, Training, Competency/Development, Succession, Recognition and Reports load their authoritative state after the route shell paints.
- Existing in-tab state is reused immediately on revisits, then revalidated in the background.
- Performance keeps its existing client state cache/background refresh path and now participates in the global refresh signal.
- User Management directory data is deferred instead of blocking route navigation.
- A lightweight `/api/read-model-revisions` endpoint exposes Redis generation numbers only; it does not return business data.
- The authenticated layout checks that small revision endpoint every 5 seconds while visible and on focus. When a domain generation changes, only interested open modules refresh.
- Successful operational mutations bump their domain generation plus cross-module Dashboard/Reports/User-directory generations.
- Performance 360 and user-review writes now participate in performance read-model invalidation.
- Useful navigation targets are prefetched only after the user hovers/focuses them; there is no mass background prefetch.
- Settings opens immediately with a deferred fresh state, but sensitive settings/security data is not persisted in a browser cache.

## Fresh-data behavior

For P&D API/integration writes that pass through the normal Laravel mutation routes:

1. the write completes in PostgreSQL;
2. the affected Redis read-model generation is bumped;
3. cached state for that generation becomes obsolete;
4. an already-open affected module detects the new generation and refetches automatically (normally within about five seconds while the tab is visible);
5. a user who enters the affected module after the write receives the current generation automatically — no manual browser refresh is required.

External integrations should call the governed P&D API/integration endpoint rather than writing directly to PostgreSQL. Direct database writes bypass Laravel middleware and therefore cannot automatically emit the cache/revision invalidation signal.

## Security boundary

This patch does not weaken login, MFA, passkeys, password/session protections, authorization or sensitive-settings verification. Security-sensitive settings state is deferred fresh, not aggressively browser-cached.

## Validation already performed on the patch source

- PHP syntax passed for every changed PHP file and route file.
- TypeScript/TSX parser/transpilation checks passed for every changed frontend file.
- Full Laravel tests and the production Vite/TypeScript build must still be run in the real project Docker environment because the uploaded source snapshot intentionally excluded `vendor` and `node_modules`.

## Expected UX

The target is click-like navigation: the route shell appears quickly, cached/in-memory data is reused when available, and authoritative state updates after paint. This avoids making navigation wait for the full read model. It does not promise a literal 100 ms origin response on every HostForge request; network, PHP/Laravel boot, authentication, Redis and PostgreSQL still impose real latency.
