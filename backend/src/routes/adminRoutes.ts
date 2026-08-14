import { Router, Response, NextFunction } from 'express';
import { query } from '../db';
import { authenticate } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/rbacMiddleware';
import { AuthenticatedRequest } from '../types';

const router = Router();
router.use(authenticate);
router.use(requireRole('SUPER_ADMIN', 'ADMIN'));

router.get('/users', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await query(`
      SELECT 
        u.id, u.email, u.status, u.created_at,
        r.name as role_name,
        e.id as employee_id, e.employee_code, CONCAT(e.first_name, ' ', e.last_name) as employee_name
      FROM users u
      INNER JOIN user_roles ur ON ur.user_id = u.id
      INNER JOIN roles r ON ur.role_id = r.id
      LEFT JOIN employees e ON e.user_id = u.id
      WHERE u.organization_id = $1
      ORDER BY u.created_at DESC
    `, [req.user!.organizationId]);
    return res.status(200).json({ success: true, data: { users: result.rows } });
  } catch (error) {
    return next(error);
  }
});

router.get('/roles', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await query(`
      SELECT id, name, description, is_system_role, created_at
      FROM roles
      WHERE organization_id = $1
      ORDER BY name ASC
    `, [req.user!.organizationId]);
    return res.status(200).json({ success: true, data: { roles: result.rows } });
  } catch (error) {
    return next(error);
  }
});

router.get('/permissions', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await query(`
      SELECT id, module, action, description, key
      FROM permissions
      ORDER BY module ASC, key ASC
    `);
    return res.status(200).json({ success: true, data: { permissions: result.rows } });
  } catch (error) {
    return next(error);
  }
});

export default router;
