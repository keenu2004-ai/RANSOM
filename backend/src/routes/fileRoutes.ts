import { Router } from 'express';
import { FileController } from '../controllers/fileController';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();

// Public stream token download fallback for local storage
router.get('/download-local/:token/:filename', FileController.downloadLocalStream);

// Authenticated Endpoints
router.use(authenticate);

router.get('/health', FileController.health);
router.post('/upload-init', FileController.uploadInit);
router.post('/upload-complete', FileController.uploadComplete);
router.post('/upload-direct', FileController.uploadDirect);
router.get('/:id/view', FileController.view);
router.get('/:id/download', FileController.download);

export default router;
