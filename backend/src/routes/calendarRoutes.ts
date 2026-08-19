import { Router } from 'express';
import { CalendarController } from '../controllers/calendarController';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();

router.use(authenticate);

// Unified Calendar endpoint
router.get('/', CalendarController.getEvents);

export default router;
