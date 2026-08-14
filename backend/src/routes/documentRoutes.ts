import { Router, Response, NextFunction } from 'express';
import { query } from '../db';
import { authenticate } from '../middleware/authMiddleware';
import { AuthenticatedRequest } from '../types';

const router = Router();
router.use(authenticate);

router.get('/types', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await query('SELECT id, name, code, is_required, description FROM document_types WHERE organization_id = $1 ORDER BY name ASC', [req.user!.organizationId]);
    return res.status(200).json({ success: true, data: { documentTypes: result.rows } });
  } catch (error) {
    return next(error);
  }
});

router.get('/my', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const employeeId = req.user!.employeeId;
    if (!employeeId) {
      return res.status(400).json({ success: false, error: 'Personal documents require a linked employee profile.', code: 'EMPLOYEE_PROFILE_REQUIRED' });
    }
    const result = await query(`
      SELECT d.id, d.title, d.file_url, d.status, d.uploaded_at, dt.name as document_type_name
      FROM documents d
      INNER JOIN document_types dt ON d.document_type_id = dt.id
      WHERE d.organization_id = $1 AND d.employee_id = $2
      ORDER BY d.uploaded_at DESC
    `, [req.user!.organizationId, employeeId]);
    return res.status(200).json({ success: true, data: { documents: result.rows } });
  } catch (error) {
    return next(error);
  }
});

export default router;
