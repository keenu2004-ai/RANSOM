import { Router } from 'express';
import { FileController } from '../controllers/fileController';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();

// Public stream token download fallback for local storage
router.get('/download-local/:token/:filename', FileController.downloadLocalStream);

// Authenticated Endpoints
router.use(authenticate);

router.post('/upload-init', FileController.uploadInit);
router.post('/upload-complete', FileController.uploadComplete);
router.post('/upload-direct', FileController.uploadDirect);
router.get('/:id/download', FileController.download);

export default router;
