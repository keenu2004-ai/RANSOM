import { Router, Response, NextFunction } from 'express';
import { query } from '../db';
import { authenticate } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/rbacMiddleware';
import { AuthenticatedRequest } from '../types';

const router = Router();
router.use(authenticate);

router.get('/statutory-rules', requireRole('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await query('SELECT id, rule_name, rule_code, epf_rate, esi_rate, pt_slabs, tds_slabs, is_active FROM statutory_rules WHERE organization_id = $1', [req.user!.organizationId]);
    return res.status(200).json({ success: true, data: { statutoryRules: result.rows } });
  } catch (error) {
    return next(error);
  }
});

router.get('/tasks', requireRole('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await query('SELECT id, title, category, due_date, status, details FROM compliance_tasks WHERE organization_id = $1 ORDER BY due_date ASC', [req.user!.organizationId]);
    return res.status(200).json({ success: true, data: { complianceTasks: result.rows } });
  } catch (error) {
    return next(error);
  }
});

export default router;
