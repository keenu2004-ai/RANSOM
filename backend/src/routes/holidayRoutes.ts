import { Router, Response, NextFunction } from 'express';
import { HolidayRepository } from '../repositories/holidayRepository';
import { authenticate } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/rbacMiddleware';
import { AuthenticatedRequest } from '../types';

const router = Router();
router.use(authenticate);

router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const organizationId = req.user!.organizationId;
    const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined;
    const actor = {
      role: req.user!.role,
      employeeId: req.user!.employeeId || null
    };
    const holidays = await HolidayRepository.findAll(organizationId, year, actor);
    return res.status(200).json({ success: true, data: { holidays }, holidays });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const organizationId = req.user!.organizationId;
    const holiday = await HolidayRepository.findById(req.params.id, organizationId);
    if (!holiday) {
      return res.status(404).json({ success: false, error: 'Holiday not found.', code: 'NOT_FOUND' });
    }
    return res.status(200).json({ success: true, data: { holiday }, holiday });
  } catch (error) {
    return next(error);
  }
});

router.post('/', requireRole('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const organizationId = req.user!.organizationId;
    const holiday = await HolidayRepository.create(organizationId, req.body);
    return res.status(201).json({ success: true, data: { holiday, message: 'Holiday created successfully.' }, holiday });
  } catch (error) {
    return next(error);
  }
});

router.put('/:id', requireRole('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const organizationId = req.user!.organizationId;
    const holiday = await HolidayRepository.update(req.params.id, organizationId, req.body);
    return res.status(200).json({ success: true, data: { holiday, message: 'Holiday updated successfully.' }, holiday });
  } catch (error) {
    return next(error);
  }
});

router.delete('/:id', requireRole('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const organizationId = req.user!.organizationId;
    const deleted = await HolidayRepository.delete(req.params.id, organizationId);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Holiday not found.', code: 'NOT_FOUND' });
    }
    return res.status(200).json({ success: true, data: { message: 'Holiday deleted.' } });
  } catch (error) {
    return next(error);
  }
});

export default router;
