import { Router } from 'express';
import { LeaveController } from '../controllers/leaveController';
import { authenticate } from '../middleware/authMiddleware';
import { requireEmployee } from '../middleware/requireEmployee';
import { requireRole } from '../middleware/rbacMiddleware';

const router = Router();

router.use(authenticate);

// Personal self-service endpoints (Require employeeId)
router.get('/me/balance', LeaveController.myBalance);
router.get('/monthly-usage', requireEmployee, LeaveController.monthlyUsage);
router.post('/apply', requireEmployee, LeaveController.apply);

// Administrative & Configuration endpoints (Do NOT require employeeId)
router.get('/all-balances', requireRole('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'HR'), LeaveController.allBalances);
router.get('/types', LeaveController.types);
router.put('/policy', requireRole('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'), LeaveController.updatePolicy);
router.get('/', LeaveController.list);
// Administrative Approval & Rejection routes
router.put('/:id/approve', requireRole('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'), LeaveController.approve);
router.post('/:id/approve', requireRole('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'), LeaveController.approve);
router.put('/:id/reject', requireRole('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'), LeaveController.reject);
router.post('/:id/reject', requireRole('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'), LeaveController.reject);

// Cancellation routes
router.put('/:id/cancel', LeaveController.cancel);
router.post('/:id/cancel', LeaveController.cancel);

// Leave entitlement adjustments
router.get('/adjustments/:employeeId', requireRole('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'), LeaveController.getAdjustments);
router.post('/adjustments', requireRole('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'), LeaveController.createAdjustment);

export default router;
