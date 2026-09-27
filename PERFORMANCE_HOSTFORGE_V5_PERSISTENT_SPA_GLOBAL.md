# HostForge V5 — Persistent SPA Navigation + Live Global Refresh

## Scope

V5 converts routine authenticated P&D navigation into client-side page swaps so a module click no longer waits for a Laravel/Inertia page-route response before the destination UI appears.

Covered authenticated operational surfaces:

- Admin: Dashboard, Users, Performance, Manage Evaluators, Competency, Learning, Training, Succession, Recognition, Reports, Settings, Audit Trail, Integrations.
- HR: Dashboard, Users, Performance, Manage Evaluators, Competency, Learning, Training, Succession, Recognition, Reports, Settings.
- User personas (Trainee / Employee / Supervisor / Manager): Dashboard, My Learning, Assessments, Certificates, Training, Development / Skills Wallet, Profile, Notifications, Settings, plus Performance and Recognition where the persona is authorized.
- Hash/tab/workspace links and supported global-search / notification navigation stay inside the same React runtime.

Authentication, MFA, password confirmation, passkeys, and other security routes are intentionally NOT client-routed. They remain server-authoritative.

## What changed

1. Added a role/persona-scoped instant route registry using Inertia v2 client-side `router.push` page swaps.
2. Removed HostForge page-route prefetch storms. Hover/idle warming now loads only the required JS page chunks; it does not prefetch Laravel page routes.
3. Dashboard, User Management, Reports, Settings, and Current User/Profile state now have direct JSON read paths so those screens can paint before heavy state finishes.
4. Existing Performance, Competency, Learning, Training, Succession, and Recognition direct-state clients remain authoritative and reuse in-memory state across page swaps.
5. Operational writes bump read-model revisions. Visible clients poll the tiny revision endpoint every 8 seconds and refetch only changed domains; no manual F5 is required for writes that pass through the P&D APIs/middleware.
6. Header/User notifications now have a revision generation, so an operational write invalidates the per-user notification cache generation and notification screens refresh automatically.
7. Current-user profile data revalidates directly and responds to user-directory revisions.
8. Background notification/revision startup is delayed so secondary requests do not compete with the page that the user just opened.

## Important behavior

- First login/full browser load still goes through Laravel authentication and middleware.
- After login, registered operational route clicks change page component locally first. Each destination fetches/revalidates its authoritative API state in the background.
- Browser refresh/direct URL entry continues to use the normal Laravel route, so deep links remain valid.
- API authorization remains server-side. The client registry contains only routes allowed for the current role/persona.
- External integrations must write through P&D endpoints that trigger `invalidate.read:*` (or explicitly bump the affected read-model domain). A direct database write that bypasses application invalidation cannot produce immediate live refresh.

## Validation expectation

Run the normal project production build after applying this patch. The patch contains no environment files or credentials and does not alter login/MFA/passkey/password/security route behavior.
