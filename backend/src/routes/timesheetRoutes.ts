import { Router, Response, NextFunction } from 'express';
import { TimesheetRepository } from '../repositories/timesheetRepository';
import { authenticate } from '../middleware/authMiddleware';
import { requireEmployee } from '../middleware/requireEmployee';
import { requireRole } from '../middleware/rbacMiddleware';
import { AuthenticatedRequest } from '../types';

const router = Router();
router.use(authenticate);

router.get('/projects', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const projects = await TimesheetRepository.findProjects(req.user!.organizationId);
    return res.status(200).json({ success: true, data: { projects } });
  } catch (error) {
    return next(error);
  }
});

router.get('/my', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const employeeId = req.user!.employeeId;
    if (!employeeId) {
      return res.status(400).json({ success: false, error: 'Personal timesheets require a linked employee profile.', code: 'EMPLOYEE_PROFILE_REQUIRED' });
    }
    const timesheets = await TimesheetRepository.findByEmployee(req.user!.organizationId, employeeId);
    return res.status(200).json({ success: true, data: { timesheets } });
  } catch (error) {
    return next(error);
  }
});

router.post('/', requireEmployee, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const timesheet = await TimesheetRepository.create(req.user!.organizationId, req.user!.employeeId!, req.body);
    return res.status(201).json({ success: true, data: { timesheet, message: 'Timesheet logged successfully.' } });
  } catch (error) {
    return next(error);
  }
});

router.get('/', requireRole('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { page, limit } = req.query;
    const result = await TimesheetRepository.findAll(req.user!.organizationId, {
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 20
    });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
});

export default router;
