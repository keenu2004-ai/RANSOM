import { Router, Response, NextFunction } from 'express';
import { PayrollRepository } from '../repositories/payrollRepository';
import { authenticate } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/rbacMiddleware';
import { AuthenticatedRequest } from '../types';

const router = Router();
router.use(authenticate);

// Employee personal payslips (requires employeeId)
router.get('/my-payslips', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const employeeId = req.user!.employeeId;
    if (!employeeId) {
      return res.status(400).json({ success: false, error: 'Personal payslips require a linked employee profile.', code: 'EMPLOYEE_PROFILE_REQUIRED' });
    }
    const payslips = await PayrollRepository.findMyPayslips(req.user!.organizationId, employeeId);
    return res.status(200).json({ success: true, data: { payslips } });
  } catch (error) {
    return next(error);
  }
});

// RBAC Protected Payroll Dashboard & Records
router.get('/structures', requireRole('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const structures = await PayrollRepository.findSalaryStructures(req.user!.organizationId);
    return res.status(200).json({ success: true, data: { salaryStructures: structures } });
  } catch (error) {
    return next(error);
  }
});

router.get('/records', requireRole('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const month = req.query.month ? parseInt(req.query.month as string, 10) : undefined;
    const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined;
    const records = await PayrollRepository.findPayrollRecords(req.user!.organizationId, month, year);
    return res.status(200).json({ success: true, data: { payrollRecords: records } });
  } catch (error) {
    return next(error);
  }
});

export default router;
