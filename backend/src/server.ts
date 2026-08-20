import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { query } from './db';
import { errorHandler } from './middleware/errorHandler';

const app = express();

// Trust reverse proxy (for Render / Nginx)
app.set('trust proxy', 1);

// Security Headers
app.use(helmet());

// Explicit CORS setup
const allowedOrigins = config.corsAllowedOrigins;
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow server-to-server or curl/postman without origin in dev
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS policy rejection for origin: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

// Preflight OPTIONS handling before auth
app.options('*', cors());

// Rate Limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests from this IP. Please try again later.',
    code: 'RATE_LIMIT_EXCEEDED'
  }
});
app.use('/api/', apiLimiter);

// Body Parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Import All API Routes
import authRoutes from './routes/authRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import employeeRoutes from './routes/employeeRoutes';
import attendanceRoutes from './routes/attendanceRoutes';
import leaveRoutes from './routes/leaveRoutes';
import holidayRoutes from './routes/holidayRoutes';
import expenseRoutes from './routes/expenseRoutes';
import timesheetRoutes from './routes/timesheetRoutes';
import notificationRoutes from './routes/notificationRoutes';
import reportRoutes from './routes/reportRoutes';
import auditRoutes from './routes/auditRoutes';
import settingsRoutes from './routes/settingsRoutes';
import adminRoutes from './routes/adminRoutes';
import assetRoutes from './routes/assetRoutes';
import calendarRoutes from './routes/calendarRoutes';

app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/holidays', holidayRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/timesheets', timesheetRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/admin', adminRoutes);

// Health Check Endpoint (Verifies real PostgreSQL database ping)
app.get('/api/health', async (req, res, next) => {
  try {
    const result = await query('SELECT NOW() as now, current_database() as db');
    return res.status(200).json({
      success: true,
      status: 'ok',
      service: 'theiakshi-enterprise-hrms',
      database: 'connected',
      details: {
        timestamp: result.rows[0].now,
        databaseName: result.rows[0].db
      }
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      status: 'error',
      service: 'theiakshi-enterprise-hrms',
      database: 'disconnected',
      error: error.message,
      code: 'DATABASE_CONNECTION_ERROR'
    });
  }
});

// Centralized Error Handling Middleware
app.use(errorHandler);

import path from 'path';

if (require.main === module) {
  app.listen(config.port, () => {
    console.log(`====================================================`);
    console.log(`  THEIAKSHI ENTERPRISE HRMS BACKEND RUNNING`);
    console.log(`  Port: ${config.port}`);
    console.log(`  Environment: ${config.env}`);
    console.log(`====================================================`);

    if (process.env.DATABASE_URL) {
      try {
        const migratePath = path.join(__dirname, '../../database/scripts/migrate.js');
        const seedPath = path.join(__dirname, '../../database/scripts/seed.js');
        const { runMigrations } = require(migratePath);
        const { runSeed } = require(seedPath);

        runMigrations()
          .then(() => runSeed(true))
          .catch((err: any) => {
            console.error('❌ FATAL: Database initialization failed:', err.message);
            process.exit(1);
          });
      } catch (e: any) {
        console.error('❌ FATAL: Migration script load error:', e.message);
        process.exit(1);
      }
    }
  });
}

export default app;
