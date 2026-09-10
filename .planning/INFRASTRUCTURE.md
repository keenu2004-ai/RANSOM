# Infrastructure & Deployment Topology

## Status
IMPLEMENTED

## Overview
THEIAKSHI ONE utilizes a containerized microservices architecture managed via Docker Compose (`docker-compose.yml` / `docker-compose.self-hosted.yml`).

## Core Components
- **Host System**: Windows (w/ WSL) or Linux host.
- **Reverse Proxy (`caddy-proxy`)**: Caddy 2 Alpine. Maps ports 80/443 on the host to internal Docker networks. Manages TLS.
- **Frontend (`theiakshi-hrms-frontend`)**: Vite + React built statically and served by Nginx (Alpine). Internally listens on port 80. Maps to port 8085 locally on dev.
- **Backend (`theiakshi-hrms-backend`)**: Node.js/Express. Exposes port 5000 internally to the Docker network.
- **Database (`theiakshi-postgres`)**: PostgreSQL 18-alpine. Bound to port 5432.
- **Cache (`theiakshi-redis`)**: Redis 7-alpine. Bound to port 6379.
- **Nextcloud AIO**: An existing production workload that runs alongside the HRMS system. **Must not be disrupted by HRMS operations.**

## Networks
- `proxy-net`: Connects Caddy to Frontend, Website, and Backend.
- `app-net`: Internal network for application containers (Frontend, Backend). Features explicit DNS aliases (e.g., `hrms-backend` points to `backend`) to ensure proxy resolution functions properly without service renaming.
- `internal-net`: Strictly isolated network for Backend, Postgres, and Redis. The proxy and frontend CANNOT reach the database or Redis directly.

## Volumes & Storage
Persistent data is mounted to the host `/srv/theiakshi-data/` directory:
- Postgres data
- Redis data
- File uploads (`/app/uploads`)
- Backups (`/app/backups`)
- Secrets (e.g., `google_drive_backup.env`, `postgres_password`)

## Configuration
- Container environment variables are injected via `.env` (development) or `.env.self-hosted` (production).
- Secrets are NEVER stored in Dockerfiles or source code.
- Backend database configuration automatically targets `postgres:5432` inside the Docker network.
