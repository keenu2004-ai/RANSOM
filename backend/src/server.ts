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
app.use('/api/users', userRoutes);
app.use('/api/files', fileRoutes);

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
  const startServer = async () => {
    if (process.env.DATABASE_URL) {
      try {
        const migratePath = path.join(__dirname, '../../database/scripts/migrate.js');
        const seedPath = path.join(__dirname, '../../database/scripts/seed.js');
        const { runMigrations } = require(migratePath);
        const { runSeed } = require(seedPath);

        await runMigrations();
        await runSeed(true);
      } catch (err: any) {
        process.stderr.write(`❌ FATAL: Database initialization failed: ${err.message}\n`);
        if (err.stack) process.stderr.write(`Stack: ${err.stack}\n`);
        process.exit(1);
      }
    }

    app.listen(config.port, () => {
      console.log(`====================================================`);
      console.log(`  THEIAKSHI ENTERPRISE HRMS BACKEND RUNNING`);
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
