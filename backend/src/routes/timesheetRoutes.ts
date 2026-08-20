import { Router, Response, NextFunction } from 'express';
import { TimesheetRepository } from '../repositories/timesheetRepository';
import { authenticate } from '../middleware/authMiddleware';
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
      return res.status(400).json({ success: false, error: 'Personal tasks require a linked employee profile.', code: 'EMPLOYEE_PROFILE_REQUIRED' });
    }
    const tasks = await TimesheetRepository.findTasks(
      req.user!.organizationId,
      req.user!.userId,
      req.user!.role,
      employeeId,
      { assignedEmployeeId: employeeId }
    );
    return res.status(200).json({ success: true, data: { timesheets: tasks, tasks } });
  } catch (error) {
    return next(error);
  }
});

router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate, assignedEmployeeId, status } = req.query;
    const tasks = await TimesheetRepository.findTasks(
      req.user!.organizationId,
      req.user!.userId,
      req.user!.role,
      req.user!.employeeId || null,
      {
        startDate: startDate as string,
        endDate: endDate as string,
        assignedEmployeeId: assignedEmployeeId as string,
        status: status as string
      }
    );
    return res.status(200).json({ success: true, data: { tasks, timesheets: tasks } });
  } catch (error) {
    return next(error);
  }
});

router.post('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const task = await TimesheetRepository.createTask(
      req.user!.organizationId,
      req.user!.userId,
      req.user!.role,
      req.user!.employeeId || null,
      req.body
    );
    return res.status(201).json({ success: true, data: { task, timesheet: task, message: 'Daily task created successfully.' } });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error.message || 'Creating task failed.' });
  }
});

router.put('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const task = await TimesheetRepository.updateTask(
      req.user!.organizationId,
      req.params.id,
      req.user!.userId,
      req.user!.role,
      req.user!.employeeId || null,
      req.body
    );
    return res.status(200).json({ success: true, data: { task, message: 'Daily task updated.' } });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error.message || 'Updating task failed.' });
  }
});

router.delete('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    await TimesheetRepository.deleteTask(
      req.user!.organizationId,
      req.params.id,
      req.user!.userId,
      req.user!.role,
      req.user!.employeeId || null
    );
    return res.status(200).json({ success: true, message: 'Daily task deleted.' });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error.message || 'Deleting task failed.' });
  }
});

export default router;
