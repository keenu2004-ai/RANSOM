import { Router, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/rbacMiddleware';
import { AuthenticatedRequest } from '../types';
import { UserRepository } from '../repositories/userRepository';

const router = Router();
router.use(authenticate);

/**
 * GET /api/users - List all users in organization with linked employee profiles
 */
router.get('/', requirePermission('USER_VIEW'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const search = req.query.search as string;
    const role = req.query.role as string;
    const users = await UserRepository.findAll(req.user!.organizationId, { search, role });
    return res.status(200).json({ success: true, data: { users } });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /api/users/:id - Get user details
 */
router.get('/:id', requirePermission('USER_VIEW'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = await UserRepository.findById(req.params.id);
    if (!user || user.organization_id !== req.user!.organizationId) {
      return res.status(404).json({ success: false, error: 'User account not found.' });
    }
    return res.status(200).json({ success: true, data: { user } });
  } catch (error) {
    return next(error);
  }
});

/**
 * PUT /api/users/:id/role - Update user system role with role authority matrix & self-escalation protection
 */
router.put('/:id/role', requirePermission('USER_ROLE_ASSIGN'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { role } = req.body;
    if (!role) {
      return res.status(400).json({ success: false, error: 'Target role is required.' });
    }

    const result = await UserRepository.updateRole(
      {
        id: req.user!.userId,
        role: req.user!.role,
        organizationId: req.user!.organizationId
      },
      req.params.id,
      role
    );

    return res.status(200).json({
      success: true,
      message: `User system role updated successfully to ${result.newRole}.`,
      data: result
    });
  } catch (error: any) {
    if (error.statusCode === 403 || error.code === 'PERMISSION_DENIED') {
      return res.status(403).json({
        success: false,
        error: error.message || 'Permission denied for user role assignment.',
        code: 'PERMISSION_DENIED'
      });
    }
    return next(error);
  }
});

/**
 * PUT /api/users/:id/status - Update account status (ACTIVE, INACTIVE, SUSPENDED)
 */
router.put('/:id/status', requirePermission('USER_UPDATE'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body;
    if (!['ACTIVE', 'INACTIVE', 'SUSPENDED'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid account status.' });
    }

    await UserRepository.updateStatus(
      {
        id: req.user!.userId,
        role: req.user!.role,
        organizationId: req.user!.organizationId
      },
      req.params.id,
      status
    );

    return res.status(200).json({
      success: true,
      message: `Account status updated successfully to ${status}.`
    });
  } catch (error: any) {
    if (error.statusCode === 403) {
      return res.status(403).json({ success: false, error: error.message });
    }
    return next(error);
  }
});

export default router;
