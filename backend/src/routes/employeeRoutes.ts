import { Router } from 'express';
import { EmployeeController } from '../controllers/employeeController';
import { authenticate } from '../middleware/authMiddleware';
import { requirePermission, requireRole } from '../middleware/rbacMiddleware';

const router = Router();

router.use(authenticate);

router.get('/', requirePermission('EMPLOYEE_VIEW_WORKFORCE'), EmployeeController.list);
router.get('/org-chart', EmployeeController.orgChart);
router.get('/:id', EmployeeController.getById);

router.post('/', requirePermission('EMPLOYEE_CREATE'), EmployeeController.create);
router.put('/:id', requirePermission('EMPLOYEE_UPDATE'), EmployeeController.update);
router.post('/:id/deactivate', requirePermission('EMPLOYEE_UPDATE'), EmployeeController.deactivate);
router.put('/:id/deactivate', requirePermission('EMPLOYEE_UPDATE'), EmployeeController.deactivate);
router.post('/:id/restore', requirePermission('EMPLOYEE_UPDATE'), EmployeeController.restore);
router.put('/:id/restore', requirePermission('EMPLOYEE_UPDATE'), EmployeeController.restore);
router.delete('/:id', requireRole('SUPER_ADMIN', 'ADMIN'), EmployeeController.delete);

export default router;
