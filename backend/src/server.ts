import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import { config } from './config';
import { query } from './db';
import { errorHandler } from './middleware/errorHandler';

const app = express();

// Trust reverse proxy (for Render / Nginx)
app.set('trust proxy', 1);

// Security Headers
app.use(helmet());
app.use(cookieParser());
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

// Explicit CORS setup
const allowedOrigins = config.corsAllowedOrigins.map(o => o.trim().replace(/\/$/, ''));

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }
    const cleanOrigin = origin.trim().replace(/\/$/, '');
    const isAllowed = allowedOrigins.some(allowed => allowed === cleanOrigin);
    if (isAllowed) {
      return callback(null, true);
    }
    console.warn(`[CORS Blocked] Request origin "${origin}" not in allowed list:`, allowedOrigins);
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Global API Rate Limiting
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  skip: (req) => process.env.NODE_ENV === 'test' && req.headers['x-test-enforce-rate-limit'] !== 'true',
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests from this IP. Please try again later.',
    code: 'RATE_LIMIT_EXCEEDED'
  }
});

// Strict Auth Rate Limiting (Brute Force Protection)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 requests per 15 mins for auth routes
  skip: (req) => process.env.NODE_ENV === 'test' && req.headers['x-test-enforce-rate-limit'] !== 'true',
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many authentication attempts from this IP. Please try again later.',
    code: 'AUTH_RATE_LIMIT_EXCEEDED'
  }
});

app.use('/api/v1/auth', authLimiter);
app.use('/api/v1/', apiLimiter);

// Body Parsing with 10 MB payload limit for attachments
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Custom 413 Payload Too Large Exception Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err.type === 'entity.too.large' || err.status === 413 || err.statusCode === 413) {
    return res.status(413).json({
      success: false,
      error: 'Attachment exceeds the maximum allowed file size (10 MB).',
      code: 'ATTACHMENT_TOO_LARGE'
    });
  }
  next(err);
});

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
import userRoutes from './routes/userRoutes';
import fileRoutes from './routes/fileRoutes';

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/employees', employeeRoutes);
app.use('/api/v1/attendance', attendanceRoutes);
app.use('/api/v1/leaves', leaveRoutes);
app.use('/api/v1/holidays', holidayRoutes);
app.use('/api/v1/expenses', expenseRoutes);
app.use('/api/v1/timesheets', timesheetRoutes);
app.use('/api/v1/assets', assetRoutes);
app.use('/api/v1/calendar', calendarRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/audit-logs', auditRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/files', fileRoutes);

// Health Check Endpoint (Verifies real PostgreSQL database ping)
const healthCheckHandler = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
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
      error: 'Database connection unavailable',
      code: 'DATABASE_CONNECTION_ERROR'
    });
  }
};

app.get('/api/v1/health', healthCheckHandler);
app.get('/api/health', healthCheckHandler);

// Centralized Error Handling Middleware
app.use(errorHandler);

import path from 'path';

if (require.main === module) {
  const startServer = async () => {
    try {
      const migratePath = path.join(__dirname, '../../database/scripts/migrate.js');
      const { runMigrations } = require(migratePath);
      await runMigrations();

      const shouldSeed = process.env.SEED_DEMO_DATA === 'true' && process.env.NODE_ENV !== 'production';
      if (shouldSeed) {
        const seedPath = path.join(__dirname, '../../database/scripts/seed.js');
        const { runSeed } = require(seedPath);
        await runSeed(true);
      }

      const { migrateLegacyAttachments } = require('./scripts/migrate_legacy_attachments');
      await migrateLegacyAttachments();

      const { AttendanceReconciliationService } = require('./services/attendanceReconciliationService');
      AttendanceReconciliationService.startReconciliationCron();
    } catch (err: any) {
      console.error(`[SERVER FATAL] Database initialization/migration failed: ${err.message}`);
      if (err.stack) console.error(err.stack);
      process.exit(1);
    }

    app.listen(config.port, () => {
      console.log(`====================================================`);
      console.log(`  THEIAKSHI ENTERPRISES HRMS BACKEND RUNNING`);
      console.log(`  Port: ${config.port}`);
      console.log(`  Environment: ${config.env}`);
      console.log(`====================================================`);
    });
  };

  startServer().catch((err: any) => {
    process.stderr.write(`❌ FATAL: Server startup error: ${err.message}\n`);
    if (err.stack) process.stderr.write(`Stack: ${err.stack}\n`);
    process.exit(1);
  });
}

export default app;
