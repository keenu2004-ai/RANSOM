import { Router, Response, NextFunction } from 'express';
import { query } from '../db';
import { authenticate } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/rbacMiddleware';
import { AuthenticatedRequest } from '../types';

const router = Router();
router.use(authenticate);
router.use(requireRole('SUPER_ADMIN', 'ADMIN'));

router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 25;
    const offset = (page - 1) * limit;

    const countRes = await query<{ total: number }>('SELECT COUNT(*)::int as total FROM audit_logs WHERE organization_id = $1', [req.user!.organizationId]);

    const result = await query(`
      SELECT 
        a.id, a.action, a.module, a.entity_name, a.entity_id, a.ip_address, a.created_at,
        u.email as actor_email
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE a.organization_id = $1
      ORDER BY a.created_at DESC
      LIMIT $2 OFFSET $3
    `, [req.user!.organizationId, limit, offset]);

    return res.status(200).json({
      success: true,
      data: {
        auditLogs: result.rows,
        pagination: {
          total: countRes.rows[0].total,
          page,
          limit,
          totalPages: Math.ceil(countRes.rows[0].total / limit)
        }
      }
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
