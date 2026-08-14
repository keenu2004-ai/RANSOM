import { Router, Response, NextFunction } from 'express';
import { ExpenseRepository } from '../repositories/expenseRepository';
import { authenticate } from '../middleware/authMiddleware';
import { requireEmployee } from '../middleware/requireEmployee';
import { requireRole } from '../middleware/rbacMiddleware';
import { AuthenticatedRequest } from '../types';

const router = Router();
router.use(authenticate);

// Personal self-service: My expenses
router.get('/my', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const organizationId = req.user!.organizationId;
    const employeeId = req.user!.employeeId;
    if (!employeeId) {
      return res.status(400).json({ success: false, error: 'Personal expenses require a linked employee profile.', code: 'EMPLOYEE_PROFILE_REQUIRED' });
    }
    const expenses = await ExpenseRepository.findByEmployee(organizationId, employeeId);
    return res.status(200).json({ success: true, data: { expenses } });
  } catch (error) {
    return next(error);
  }
});

// Personal self-service: Submit claim (requires employeeId)
router.post('/', requireEmployee, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const organizationId = req.user!.organizationId;
    const employeeId = req.user!.employeeId!;
    const expense = await ExpenseRepository.create(organizationId, employeeId, req.body);
    return res.status(201).json({ success: true, data: { expense, message: 'Expense claim submitted successfully.' } });
  } catch (error) {
    return next(error);
  }
});

// Categories list
router.get('/categories', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const categories = await ExpenseRepository.findCategories(req.user!.organizationId);
    return res.status(200).json({ success: true, data: { categories } });
  } catch (error) {
    return next(error);
  }
});

// Administrative Overview: Does NOT require employeeId
router.get('/', requireRole('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const organizationId = req.user!.organizationId;
    const { status, page, limit } = req.query;
    const result = await ExpenseRepository.findAll(organizationId, {
      status: status as string,
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 20
    });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
});

router.put('/:id/approve', requireRole('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const updated = await ExpenseRepository.updateStatus(req.params.id, req.user!.organizationId, 'APPROVED', req.user!.employeeId || undefined);
    return res.status(200).json({ success: true, data: { expense: updated, message: 'Expense claim approved.' } });
  } catch (error) {
    return next(error);
  }
});

router.put('/:id/reject', requireRole('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const updated = await ExpenseRepository.updateStatus(req.params.id, req.user!.organizationId, 'REJECTED', req.user!.employeeId || undefined, req.body.rejectionReason);
    return res.status(200).json({ success: true, data: { expense: updated, message: 'Expense claim rejected.' } });
  } catch (error) {
    return next(error);
  }
});

export default router;
