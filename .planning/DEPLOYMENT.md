# Deployment Architecture

## Status
IMPLEMENTED

## Process
The application relies on `docker-compose.self-hosted.yml` for production deployments and `docker-compose.yml` for local development.

## Container Topology
- **caddy-proxy**: Handles incoming traffic on ports 80/443. Manages SSL termination and routes `/api` to the backend.
- **theiakshi-website**: Static marketing/informational site.
- **theiakshi-hrms-frontend**: Static React frontend served by Nginx.
- **theiakshi-hrms-backend**: Node.js/Express API.
- **theiakshi-postgres**: PostgreSQL database (isolated on `internal-net`).
- **theiakshi-redis**: Redis cache (isolated on `internal-net`).

## CI/CD Pipeline
- Production readiness was established in Phase 6.
- Detailed deployment instructions and scaling policies were validated in Phase 15 (DevOps & Deployment Review). Database migration scripts are enforced with fatal process exit hooks (`process.exit(1)`) to ensure faulty schema upgrades trigger immediate container failure rather than silent data corruption.

## Secrets Management
- Secrets are securely managed via `.env.self-hosted` files which are mounted into the containers at runtime.
- For secure internal container operations (e.g. database dumps), explicit read-only secret volume mounts (like `/run/secrets/postgres_password`) are injected directly into the container filesystem.
- Environment files are specifically `.gitignore`d to prevent leakage.
