import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/rbacMiddleware';
import { requireEmployee } from '../middleware/requireEmployee';
import { AssetController } from '../controllers/assetController';

const router = Router();
router.use(authenticate);

// Asset Metrics & Categories
router.get('/summary', AssetController.getSummary);
router.get('/categories', AssetController.getCategories);
router.post('/categories', requireRole('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'), AssetController.createCategory);

// Asset Requests (PHASE 4)
router.get('/requests', AssetController.getRequests);
router.post('/requests', requireEmployee, AssetController.createRequest);
router.get('/requests/:id', AssetController.getRequestById);
router.put('/requests/:id/approve', requireRole('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'), AssetController.approveRequest);
router.put('/requests/:id/reject', requireRole('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'), AssetController.rejectRequest);
router.put('/requests/:id/fulfill', requireRole('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'), AssetController.fulfillRequest);

// Asset CRUD
router.get('/', AssetController.list);
router.post('/', requireRole('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'), AssetController.create);
router.get('/:id', AssetController.getById);
router.put('/:id', requireRole('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'), AssetController.update);
router.delete('/:id', requireRole('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'), AssetController.delete);
router.delete('/:id/permanent', requireRole('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'), AssetController.permanentDelete);

// Lifecycle Operations
router.post('/:id/assign', requireRole('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'), AssetController.assign);
router.post('/:id/return', requireRole('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'), AssetController.returnAsset);
router.patch('/:id/status', requireRole('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'), AssetController.updateStatus);

// History & Maintenance
router.get('/:id/history', AssetController.getHistory);
router.get('/:id/maintenance', AssetController.getMaintenance);
router.post('/:id/maintenance', requireRole('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'), AssetController.createMaintenance);

export default router;
