/**
 * testApp.ts
 * Exports the Express app WITHOUT calling server.listen().
 * This allows Supertest to bind to an ephemeral port for each test run,
 * guaranteeing port-collision-free test execution.
 *
 * IMPORTANT: This file deliberately does NOT start background jobs (e.g.,
 * attendance reconciliation crons). Those are side-effecting and must not
 * run during unit/integration tests.
 */
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import { errorHandler } from '../middleware/errorHandler';

// Routes
import authRoutes from '../routes/authRoutes';
import employeeRoutes from '../routes/employeeRoutes';
import attendanceRoutes from '../routes/attendanceRoutes';
import leaveRoutes from '../routes/leaveRoutes';
import expenseRoutes from '../routes/expenseRoutes';
import assetRoutes from '../routes/assetRoutes';
import dashboardRoutes from '../routes/dashboardRoutes';
import notificationRoutes from '../routes/notificationRoutes';
import holidayRoutes from '../routes/holidayRoutes';
import timesheetRoutes from '../routes/timesheetRoutes';
import reportRoutes from '../routes/reportRoutes';
import auditRoutes from '../routes/auditRoutes';
import settingsRoutes from '../routes/settingsRoutes';
import adminRoutes from '../routes/adminRoutes';
import userRoutes from '../routes/userRoutes';
import fileRoutes from '../routes/fileRoutes';

const app = express();

app.set('trust proxy', 1);

// Minimal security headers (no CSRF enforcement needed in tests using Bearer tokens)
app.use(helmet());
app.use(cookieParser());
app.use(compression());

// Open CORS for test environment
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'Origin', 'Referer']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Mount all routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/employees', employeeRoutes);
app.use('/api/v1/attendance', attendanceRoutes);
app.use('/api/v1/leaves', leaveRoutes);
app.use('/api/v1/expenses', expenseRoutes);
app.use('/api/v1/assets', assetRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/holidays', holidayRoutes);
app.use('/api/v1/timesheets', timesheetRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/audit-logs', auditRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/files', fileRoutes);

// Health check
app.get('/api/v1/health', (_req, res) => {
  res.status(200).json({ success: true, data: { status: 'OK' } });
});

// Centralized error handler
app.use(errorHandler);

export default app;
