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

router.get('/pending-carry-forward', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const cutoffDate = req.query.beforeDate as string;
    const tasks = await TimesheetRepository.findPendingCarryForward(
      req.user!.organizationId,
      req.user!.userId,
      req.user!.role,
      req.user!.employeeId || null,
      cutoffDate
    );
    return res.status(200).json({ success: true, data: { tasks, count: tasks.length } });
  } catch (error) {
    return next(error);
  }
});

router.get('/export', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate, assignedEmployeeId, status, visitType, priority, opportunityStage } = req.query;
    const tasks = await TimesheetRepository.findTasks(
      req.user!.organizationId,
      req.user!.userId,
      req.user!.role,
      req.user!.employeeId || null,
      {
        startDate: startDate as string,
        endDate: endDate as string,
        assignedEmployeeId: assignedEmployeeId as string,
        status: status as string,
        visitType: visitType as string,
        priority: priority as string,
        opportunityStage: opportunityStage as string
      }
    );

    // Build Excel CSV Table Export with Header Metadata
    let csv = 'THEIAKSHI ENTERPRISE HRMS - WEEKLY PLAN & FIELD VISIT TRACKER EXPORT\n';
    csv += `Export Date,${new Date().toISOString()}\n`;
    csv += `Organization ID,${req.user!.organizationId}\n`;
    csv += `Exported By,${req.user!.email} (${req.user!.role})\n\n`;

    csv += 'Task ID,Date,Day,Assigned Employee,Employee Code,Customer Name,Contact Person,Contact Details,Visit Location,Visit Type,Time Slot,Products To Present,Visit Objective,Task Title,Description,Planned Hours,Status,Priority,Opportunity Stage,Estimated Value (INR),Outcome Summary,Next Action,Follow-up Date,Rescheduled From,Rescheduled To,Reschedule Count\n';

    tasks.forEach(t => {
      const dayName = new Date(t.date).toLocaleDateString('en-US', { weekday: 'short' });
      csv += `"${t.id}","${t.date}","${dayName}","${t.assigned_employee_name || ''}","${t.assigned_employee_code || ''}","${(t.customer_name || '').replace(/"/g, '""')}","${(t.contact_person || '').replace(/"/g, '""')}","${(t.contact_details || '').replace(/"/g, '""')}","${(t.visit_location || '').replace(/"/g, '""')}","${t.visit_type || ''}","${t.time_slot || ''}","${(t.products_to_present || '').replace(/"/g, '""')}","${(t.visit_objective || '').replace(/"/g, '""')}","${(t.title || '').replace(/"/g, '""')}","${(t.description || '').replace(/"/g, '""')}",${t.hours || 1.0},"${t.status}","${t.priority || 'MEDIUM'}","${t.opportunity_stage || ''}",${t.estimated_value || 0},"${(t.outcome_summary || '').replace(/"/g, '""')}","${(t.next_action || '').replace(/"/g, '""')}","${t.follow_up_date || ''}","${t.rescheduled_from_task_id || ''}","${t.rescheduled_to_task_id || ''}",${t.reschedule_count || 0}\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=weekly_plan_export_${new Date().toISOString().split('T')[0]}.csv`);
    return res.status(200).send(csv);
  } catch (error) {
    return next(error);
  }
});

router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate, assignedEmployeeId, status, visitType, priority, opportunityStage } = req.query;
    const tasks = await TimesheetRepository.findTasks(
      req.user!.organizationId,
      req.user!.userId,
      req.user!.role,
      req.user!.employeeId || null,
      {
        startDate: startDate as string,
        endDate: endDate as string,
        assignedEmployeeId: assignedEmployeeId as string,
        status: status as string,
        visitType: visitType as string,
        priority: priority as string,
        opportunityStage: opportunityStage as string
      }
    );
    return res.status(200).json({ success: true, data: { tasks, timesheets: tasks } });
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/reschedule', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { newDate, reason } = req.body;
    if (!newDate) {
      return res.status(400).json({ success: false, error: 'Target date for rescheduling is required.' });
    }

    const result = await TimesheetRepository.rescheduleTask(
      req.user!.organizationId,
      req.params.id,
      req.user!.userId,
      req.user!.role,
      req.user!.employeeId || null,
      newDate,
      reason
    );

    return res.status(200).json({
      success: true,
      message: 'Task rescheduled successfully.',
      data: result
    });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error.message || 'Rescheduling task failed.' });
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
