# THEIAKSHI ONE - Self-Hosted Deployment Guide

This document outlines the requirements and procedures for deploying THEIAKSHI ONE to a private single-server production environment.

## 1. Resource Requirements
For the initial single-server deployment:
- **CPU:** 4 vCPUs recommended (2 vCPUs minimum).
- **RAM:** 8GB recommended (4GB minimum - PostgreSQL and Redis need memory, plus Node.js services).
- **Disk:** 50GB+ SSD (SSD is required for database performance). Monitor storage growth in `/srv/theiakshi-data/uploads`.
- **Scaling Triggers:** Consider a separate database server if I/O wait exceeds 10%, or a second app server if CPU regularly spikes above 80% or memory is exhausted. Object storage (S3) is recommended when uploads exceed 50GB.

## 2. Firewall Requirements (UFW)
Only expose the minimum required ports. The reverse proxy handles all external traffic.

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP (Caddy will redirect to HTTPS)
ufw allow 443/tcp   # HTTPS
ufw enable
```

Do NOT expose 5432 (Postgres), 6379 (Redis), or 5000/8080/8085 (Internal app ports) to the public internet.

## 3. Initial Setup
1. Install Docker and Docker Compose on the host.
2. Create the required persistent directories:
   ```bash
   sudo mkdir -p /srv/theiakshi-data/{postgres,redis,uploads,caddy/data,caddy/config,backups}
   # Ensure correct permissions
   ```
3. Copy `.env.self-hosted.example` to `.env.self-hosted` and fill in all variables securely.
4. Copy `deploy/Caddyfile` and `docker-compose.self-hosted.yml`.

## 4. Deployment Commands
To start the application:
```bash
docker compose -f docker-compose.self-hosted.yml up -d
```

To view logs:
```bash
docker compose -f docker-compose.self-hosted.yml logs -f
```

## 5. Backups & Restore
Backup scripts are located in `deploy/`.
- `deploy/backup.sh`: Creates a custom-format dump of PostgreSQL and a tarball of uploads.
- `deploy/restore.sh`: Restores the backup.

### Retention Policy
- Implement a cron job to run `deploy/backup.sh` daily.
- Configure retention: 30 days daily, 12 weeks weekly, 12 months monthly.
- **CRITICAL:** Backups MUST be transmitted offsite (e.g., via `rsync` or S3) to protect against physical server failure.

## 6. Security Controls
- **Networks:** Internal services (Postgres, Redis) are on the `internal-net` and inaccessible to the reverse proxy or public internet.
- **TLS:** Caddy automatically provisions and renews TLS certificates via Let's Encrypt.
- **Secrets:** All credentials are provided via the `.env.self-hosted` file and are never committed to version control.
- **CORS:** Ensure wildcard CORS is disabled in the backend.
