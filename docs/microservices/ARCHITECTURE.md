# Alibaton Performance & Development — Module-Based Microservices

This implementation follows the manuscript's business-capability boundaries:

1. Performance Management
2. Competency Management
3. Learning Management
4. Training Management
5. Succession Planning
6. Social Recognition

Admin, HR, and User/Trainee remain RBAC roles in the gateway. They are not separate microservices.

## Runtime topology

```text
Browser
  |
  v
Gateway / BFF (Laravel + React/Inertia)
  |- Authentication / MFA / Passkeys
  |- RBAC: Admin / HR / User
  |- User Management
  |- Reports / Settings / Notifications
  |- Aevyn / Groq orchestration
  |
  +--> Performance Service  --REST--+
  +--> Competency Service   --REST--+
  +--> Learning Service     --REST--+--> PostgreSQL
  +--> Training Service     --REST--+--> Redis
  +--> Succession Service   --REST--+
  +--> Recognition Service  --REST--+
```

The repository remains a monorepo, but each domain is bootable as its own Laravel runtime by setting `SERVICE_ROLE`. This allows independent containers/deployments without duplicating the frontend or authentication stack.

## Gateway compatibility

`MICROSERVICES_ENABLED=false` preserves the original single-runtime behavior. This is intentionally retained as a rollback path during migration.

With `MICROSERVICES_ENABLED=true`, the browser continues to call the existing public API paths. The gateway forwards those requests to the correct private service, so the current React Admin/HR/User pages do not need a breaking URL rewrite.

## Service-to-service authentication

The gateway signs each internal request using `MICROSERVICES_SHARED_SECRET` and sends:

- `X-PND-Service`
- `X-PND-User`
- `X-PND-Timestamp`
- `X-PND-Signature`
- `X-Request-ID`

A domain runtime loads only its own route file and rejects requests without a valid, fresh signature. The gateway identity is then resolved to the existing canonical user account so the current authorization rules continue to apply.

## Data boundaries

The migration `2026_09_23_000000_partition_domain_tables_into_microservice_schemas.php` creates PostgreSQL schemas and moves existing prefixed tables without deleting data:

- `performance.*`
- `competency.*`
- `learning.*`
- `training.*`
- `succession.*`
- `recognition.*`

Cross-cutting identity/security/governance tables remain in `public` (for example `users`, MFA, sessions, settings, security audit, and report export metadata).

The gateway search path includes all domain schemas for compatibility. A domain runtime places its own schema first. This is a migration-safe step toward stricter service-owned persistence while preserving existing records and foreign-key relationships.

## REST route ownership

### Performance Service
Owns `/performance/api/*`, `/api/performance/360/*`, and `/api/performance/user-reviews/*`.

### Competency Service
Owns `/competency/api/*`.

### Learning Service
Owns `/learning/api/*`.

### Training Service
Owns `/training/api/*`.

### Succession Service
Owns `/succession/api/*`.

### Recognition Service
Owns `/recognition/api/*`.

## Cross-cutting functions kept in the gateway

The following are intentionally not modeled as domain microservices because they are platform concerns rather than the six manuscript business capabilities:

- Authentication, MFA, passkeys, password recovery
- RBAC and access governance
- User Management
- Global navigation and Inertia frontend shell
- Header notifications
- Reports aggregation
- Settings/governance
- Groq/Aevyn orchestration

## Local run

Generate a strong shared secret first:

```bash
php -r 'echo bin2hex(random_bytes(32)), PHP_EOL;'
```

Set it in `.env`:

```env
MICROSERVICES_ENABLED=true
SERVICE_ROLE=gateway
MICROSERVICES_SHARED_SECRET=<generated-secret>
```

Then run:

```bash
docker compose -f compose.microservices.yaml up -d --build
php artisan migrate
```

The gateway is exposed on the normal application port. Domain services stay on the private Docker network.

## Production / HostForge model

Create seven application runtimes from the same repository/commit:

- gateway — public, custom domain `hr-3.alibaton-ph.com`
- performance — private
- competency — private
- learning — private
- training — private
- succession — private
- recognition — private

All runtimes share the same `MICROSERVICES_SHARED_SECRET`. The gateway receives the six private service URLs through the corresponding `*_SERVICE_URL` variables. PostgreSQL and Redis remain managed infrastructure resources.

Only the gateway should be publicly reachable.

## Migration safety

Do not use `migrate:fresh` on the hosted database. Use:

```bash
php artisan migrate --force
```

The domain-schema migration is non-destructive and moves existing PostgreSQL tables in place.
