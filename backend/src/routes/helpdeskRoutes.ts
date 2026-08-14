import { Router, Response, NextFunction } from 'express';
import { query } from '../db';
import { authenticate } from '../middleware/authMiddleware';
import { requireEmployee } from '../middleware/requireEmployee';
import { AuthenticatedRequest } from '../types';

const router = Router();
router.use(authenticate);

router.get('/my', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const employeeId = req.user!.employeeId;
    if (!employeeId) {
      return res.status(400).json({ success: false, error: 'Helpdesk tickets require a linked employee profile.', code: 'EMPLOYEE_PROFILE_REQUIRED' });
    }
    const result = await query(`
      SELECT id, ticket_number, title, category, priority, description, status, created_at
      FROM helpdesk_tickets
      WHERE organization_id = $1 AND employee_id = $2
      ORDER BY created_at DESC
    `, [req.user!.organizationId, employeeId]);
    return res.status(200).json({ success: true, data: { tickets: result.rows } });
  } catch (error) {
    return next(error);
  }
});

router.post('/', requireEmployee, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { title, category, priority, description } = req.body;
    const ticketNum = `TICK-${Date.now().toString().slice(-6)}`;
    const result = await query(`
      INSERT INTO helpdesk_tickets (organization_id, employee_id, ticket_number, title, category, priority, description, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'OPEN')
      RETURNING id, ticket_number, title, status, created_at
    `, [req.user!.organizationId, req.user!.employeeId!, ticketNum, title, category || 'IT', priority || 'MEDIUM', description]);
    return res.status(201).json({ success: true, data: { ticket: result.rows[0], message: 'Support ticket submitted successfully.' } });
  } catch (error) {
    return next(error);
  }
});

export default router;
