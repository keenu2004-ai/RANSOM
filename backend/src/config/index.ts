import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/theiakshi_hrms',
  jwtSecret: process.env.JWT_SECRET || 'fallback-dev-jwt-secret-theiakshi-2026',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'fallback-dev-refresh-secret-theiakshi-2026',
  corsAllowedOrigins: (process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173,https://theiakshi-hrms-frontend.onrender.com')
    .split(',')
    .map(origin => origin.trim())
};
