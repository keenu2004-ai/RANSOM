import { Router } from 'express';
import { EmployeeController } from '../controllers/employeeController';
import { authenticate } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/rbacMiddleware';

const router = Router();

router.use(authenticate);

router.get('/', requireRole('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'), EmployeeController.list);
router.get('/org-chart', EmployeeController.orgChart);
router.get('/:id', EmployeeController.getById);

router.post('/', requireRole('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'), EmployeeController.create);
router.put('/:id', requireRole('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'), EmployeeController.update);
router.post('/:id/deactivate', requireRole('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'), EmployeeController.deactivate);
router.post('/:id/restore', requireRole('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'), EmployeeController.restore);

export default router;
