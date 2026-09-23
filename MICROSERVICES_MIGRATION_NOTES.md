# Microservices Migration Notes

Source baseline: `learning-finalization` commit `971d66b`.

## What changed

- Added runtime role selection (`SERVICE_ROLE`).
- Added six domain-specific service route files.
- Added gateway REST proxying while preserving existing public API URLs.
- Added HMAC-signed internal service authentication.
- Added service health endpoint for Admin.
- Added PostgreSQL schema partition migration for the six domains.
- Added `compose.microservices.yaml` for local seven-runtime orchestration.
- Retained monolith compatibility mode for rollback.

## Important

This migration intentionally preserves the existing UI and business services. It does not rewrite working Performance, Competency, Learning, Training, Succession, or Recognition logic from scratch. Instead, it changes the deployment/runtime boundary around those modules so they can execute as independent services.

Admin, HR, and User/Trainee remain RBAC roles and must not be converted into separate microservices.

## Environment variables

```env
MICROSERVICES_ENABLED=true
SERVICE_ROLE=gateway
MICROSERVICES_SHARED_SECRET=<strong-random-secret>
PERFORMANCE_SERVICE_URL=http://performance-service:8000
COMPETENCY_SERVICE_URL=http://competency-service:8000
LEARNING_SERVICE_URL=http://learning-service:8000
TRAINING_SERVICE_URL=http://training-service:8000
SUCCESSION_SERVICE_URL=http://succession-service:8000
RECOGNITION_SERVICE_URL=http://recognition-service:8000
```

For a domain service, only change `SERVICE_ROLE`, e.g. `SERVICE_ROLE=performance`.

## Admin health check

Authenticated Admin users can query:

`GET /admin/api/microservices/health`

It reports the runtime state of all six private services.
