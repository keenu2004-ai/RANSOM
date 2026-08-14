import { Router } from 'express';
import { LeaveController } from '../controllers/leaveController';
import { authenticate } from '../middleware/authMiddleware';
import { requireEmployee } from '../middleware/requireEmployee';
import { requireRole } from '../middleware/rbacMiddleware';

const router = Router();

router.use(authenticate);

// Personal self-service endpoints (Require employeeId)
router.get('/me/balance', LeaveController.myBalance);
router.post('/apply', requireEmployee, LeaveController.apply);

// Administrative & Configuration endpoints (Do NOT require employeeId)
router.get('/types', LeaveController.types);
router.get('/', requireRole('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'), LeaveController.list);
router.put('/:id/approve', requireRole('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'), LeaveController.approve);
router.put('/:id/reject', requireRole('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'), LeaveController.reject);

export default router;
