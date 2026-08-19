import { Router } from 'express';
import { AttendanceController } from '../controllers/attendanceController';
import { authenticate } from '../middleware/authMiddleware';
import { requireEmployee } from '../middleware/requireEmployee';
import { requireRole } from '../middleware/rbacMiddleware';

const router = Router();

router.use(authenticate);

// Personal self-service endpoints (Require employeeId via requireEmployee middleware)
router.get('/today', AttendanceController.getToday);
router.post('/check-in', requireEmployee, AttendanceController.checkIn);
router.post('/check-out', requireEmployee, AttendanceController.checkOut);
router.post('/break', requireEmployee, AttendanceController.updateBreak);

// Attendance Regularization endpoints
router.post('/regularize', requireEmployee, AttendanceController.applyRegularization);
router.get('/regularize', AttendanceController.getRegularizations);
router.put('/regularize/:id', requireRole('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'), AttendanceController.processRegularization);

// Administrative / Overview endpoints (Do NOT require employeeId)
router.get('/locations', AttendanceController.locations);
router.get('/workforce-summary', requireRole('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'), AttendanceController.workforceSummary);
router.get('/', requireRole('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'), AttendanceController.list);

export default router;
