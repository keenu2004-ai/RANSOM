import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/rbacMiddleware';
import { AssetController } from '../controllers/assetController';

const router = Router();
router.use(authenticate);

// Asset Metrics & Categories
router.get('/summary', AssetController.getSummary);
router.get('/categories', AssetController.getCategories);
router.post('/categories', requireRole('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'), AssetController.createCategory);

// Asset CRUD
router.get('/', AssetController.list);
router.post('/', requireRole('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'), AssetController.create);
router.get('/:id', AssetController.getById);
router.put('/:id', requireRole('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'), AssetController.update);
router.delete('/:id', requireRole('SUPER_ADMIN', 'ADMIN'), AssetController.delete);

// Lifecycle Operations
router.post('/:id/assign', requireRole('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'), AssetController.assign);
router.post('/:id/return', requireRole('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'MANAGER'), AssetController.returnAsset);
router.patch('/:id/status', requireRole('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'), AssetController.updateStatus);

// History & Maintenance
router.get('/:id/history', AssetController.getHistory);
router.get('/:id/maintenance', AssetController.getMaintenance);
router.post('/:id/maintenance', requireRole('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER'), AssetController.createMaintenance);

export default router;
