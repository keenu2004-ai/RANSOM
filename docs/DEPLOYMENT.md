# THEIAKSHI ENTERPRISE HRMS — DEPLOYMENT GUIDE

## Target Production Architecture
- **Frontend**: Render Static Site (`https://theiakshi-hrms-frontend.onrender.com`)
- **Backend**: Render Web Service (`https://theiakshi-hrms-backend.onrender.com`)
- **Database**: Neon PostgreSQL (`DATABASE_URL`)

## Render Deployment Steps
1. Push repository containing `render.yaml` to GitHub/GitLab.
2. In Render Dashboard, click **New +** -> **Blueprint**.
3. Select the repository. Render will automatically parse `render.yaml`.
4. Configure standard environment variables:
   - Backend: `DATABASE_URL`, `JWT_SECRET`, `CORS_ALLOWED_ORIGINS`
   - Frontend: `VITE_API_URL`
5. Click **Apply**.
