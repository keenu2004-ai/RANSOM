# Project Architecture

## System Overview
THEIAKSHI ONE is an Enterprise HRMS application designed with a containerized, decoupled architecture. 

## Frontend
- **Framework**: React.js
- **Build Tool**: Vite
- **Routing**: React Router DOM
- **State Management**: React Context (e.g., `AuthContext`)
- **API Communication**: Axios (configured with `withCredentials: true` and interceptors for 401/403 handling)
- **Deployment**: Statically compiled and served by an Alpine Nginx container.

## Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **API Design**: RESTful, centrally namespaced under `/api/v1`
- **Authentication**: JWT within HttpOnly cookies + Microsoft MSAL (Entra ID)
- **Authorization**: Strict Server-Side Role-Based Access Control (RBAC) enforced via middleware.
- **Database Access**: Raw SQL queries via the `pg` client, organized into Repositories (`userRepository.ts`, etc.) to isolate data access logic.

## Database
- **Engine**: PostgreSQL 18-alpine
- **Schema Management**: Custom SQL migration script system executing on application startup.
- **Data Isolation**: Strict multi-tenant isolation via `organization_id` foreign keys and query parameters.

## API Gateway / Reverse Proxy
- **Engine**: Caddy 2
- **Responsibilities**: 
  - TLS / SSL Termination
  - Routing external requests to appropriate internal services based on hostname (e.g., `api.theiakshi.example.com` to backend, `app.theiakshi...` to frontend).
  - Port forwarding to internal Docker networks.

## Infrastructure & Hosting
- **Containerization**: Docker and Docker Compose.
- **Isolation**: Three distinct Docker networks (`proxy-net`, `app-net`, `internal-net`) ensure that the database and Redis cache are inaccessible from the internet or reverse proxy directly.
