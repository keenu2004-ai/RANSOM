# THEIAKSHI ENTERPRISE HRMS — TROUBLESHOOTING GUIDE

## Common Issue Resolution

### 1. `EMPLOYEE_PROFILE_REQUIRED` HTTP 400 Error
- **Cause**: Attempting a personal self-service action (`/attendance/check-in`, `/leaves/apply`, `/expenses`) from an administrative user account (`superadmin@theiakshi.com` or `admin@theiakshi.com`) that has no linked employee record (`employeeId = null`).
- **Solution**: Switch to an employee demo account (`hr@theiakshi.com`, `manager@theiakshi.com`, `employee@theiakshi.com`) or link an employee profile via Admin Control.

### 2. CORS Error in Browser Console
- **Cause**: Backend `CORS_ALLOWED_ORIGINS` does not include the exact frontend origin URL.
- **Solution**: Ensure `CORS_ALLOWED_ORIGINS` in backend environment includes `http://localhost:5173` (development) or `https://theiakshi-hrms-frontend.onrender.com` (production).

### 3. Database Connection Error
- **Cause**: Missing or invalid `DATABASE_URL`.
- **Solution**: Verify PostgreSQL is running and `DATABASE_URL` is configured in `backend/.env`.
