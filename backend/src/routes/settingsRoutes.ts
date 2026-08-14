import { Router, Response, NextFunction } from 'express';
import { query } from '../db';
import { authenticate } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/rbacMiddleware';
import { AuthenticatedRequest } from '../types';

const router = Router();
router.use(authenticate);

router.get('/organization', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await query(`
      SELECT o.id, o.name, o.code, o.currency, o.default_hq, s.time_zone, s.date_format, s.fiscal_year_start
      FROM organizations o
      LEFT JOIN organization_settings s ON s.organization_id = o.id
      WHERE o.id = $1
    `, [req.user!.organizationId]);
    return res.status(200).json({ success: true, data: { organization: result.rows[0] } });
  } catch (error) {
    return next(error);
  }
});

router.get('/departments', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await query('SELECT id, name, code, description FROM departments WHERE organization_id = $1 ORDER BY name ASC', [req.user!.organizationId]);
    return res.status(200).json({ success: true, data: { departments: result.rows } });
  } catch (error) {
    return next(error);
  }
});

router.get('/designations', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await query('SELECT id, name, code, description FROM designations WHERE organization_id = $1 ORDER BY name ASC', [req.user!.organizationId]);
    return res.status(200).json({ success: true, data: { designations: result.rows } });
  } catch (error) {
    return next(error);
  }
});

router.get('/teams', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await query('SELECT id, name, code FROM teams WHERE organization_id = $1 ORDER BY name ASC', [req.user!.organizationId]);
    return res.status(200).json({ success: true, data: { teams: result.rows } });
  } catch (error) {
    return next(error);
  }
});

router.get('/branches', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await query('SELECT id, name, code, location, is_headquarters FROM branches WHERE organization_id = $1 ORDER BY name ASC', [req.user!.organizationId]);
    return res.status(200).json({ success: true, data: { branches: result.rows } });
  } catch (error) {
    return next(error);
  }
});

export default router;
