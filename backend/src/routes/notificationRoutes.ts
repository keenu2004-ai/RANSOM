import { Router, Response, NextFunction } from 'express';
import { query } from '../db';
import { authenticate } from '../middleware/authMiddleware';
import { AuthenticatedRequest } from '../types';

const router = Router();
router.use(authenticate);

router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await query(`
      SELECT id, title, message, link, is_read, created_at
      FROM notifications
      WHERE organization_id = $1 AND user_id = $2
      ORDER BY created_at DESC
      LIMIT 20
    `, [req.user!.organizationId, req.user!.userId]);

    const unreadCount = result.rows.filter(r => !r.is_read).length;
    return res.status(200).json({ success: true, data: { notifications: result.rows, unreadCount } });
  } catch (error) {
    return next(error);
  }
});

router.post('/mark-all-read', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    await query(`
      UPDATE notifications
      SET is_read = TRUE
      WHERE organization_id = $1 AND user_id = $2
    `, [req.user!.organizationId, req.user!.userId]);
    return res.status(200).json({ success: true, data: { message: 'All notifications marked as read.' } });
  } catch (error) {
    return next(error);
  }
});

export default router;
