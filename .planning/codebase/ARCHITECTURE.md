# Codebase Architecture

**Analysis Date:** 2026-09-09

## System Design
- **Pattern:** Client-Server Monolithic API
- **Frontend:** Single Page Application (SPA) communicating with the backend over REST.
- **Backend:** Express API server interacting with a PostgreSQL relational database. 
- **API Style:** RESTful JSON endpoints routed via Nginx proxy (`/api/`).

## Data Flow
1. **Client -> Nginx Proxy:** Web requests sent to the frontend domain; `/api/*` paths are proxied to the backend container.
2. **Backend Authentication:** Requests passing through Express middleware validate identity by parsing the HTTP-Only `theiakshi_session` cookie (or Bearer token) and performing a synchronized database `auth_version` check.
3. **Controller/Service:** Express routers delegate request handling to specialized Controllers which interact with Services and Repositories to handle business logic.

## Abstractions & Layers
- **Database Migrations:** Managed by a custom SQL execution script (`db:migrate`) utilizing `.sql` files in the `database/migrations` directory.
- **Access Control:** Centralized backend RBAC middleware and a mirrored frontend capability check (`hasPermission`).
