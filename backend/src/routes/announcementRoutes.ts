import { Router, Response, NextFunction } from 'express';
import { query } from '../db';
import { authenticate } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/rbacMiddleware';
import { AuthenticatedRequest } from '../types';

const router = Router();
router.use(authenticate);

router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await query(`
      SELECT id, title, content, target_audience, status, published_at
      FROM announcements
      WHERE organization_id = $1 AND status = 'PUBLISHED'
      ORDER BY published_at DESC
    `, [req.user!.organizationId]);
    return res.status(200).json({ success: true, data: { announcements: result.rows } });
  } catch (error) {
    return next(error);
  }
});

router.post('/', requireRole('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { title, content, targetAudience } = req.body;
    const result = await query(`
      INSERT INTO announcements (organization_id, title, content, target_audience, status)
      VALUES ($1, $2, $3, $4, 'PUBLISHED')
      RETURNING id, title, content, published_at
    `, [req.user!.organizationId, title, content, targetAudience || 'ALL']);
    return res.status(201).json({ success: true, data: { announcement: result.rows[0], message: 'Announcement published successfully.' } });
  } catch (error) {
    return next(error);
  }
});

export default router;
