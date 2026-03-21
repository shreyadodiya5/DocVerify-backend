import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  createRequest,
  getRequests,
  getRequestById,
  updateRequestStatus,
  deleteRequest,
  verifyAccessToken,
  resendNotification
} from '../controllers/requestController.js';

const router = express.Router();

router.get('/verify/:token', verifyAccessToken);

router.route('/')
  .post(protect, createRequest)
  .get(protect, getRequests);

router.route('/:id')
  .get(protect, getRequestById)
  .delete(protect, deleteRequest);

router.put('/:id/status', protect, updateRequestStatus);
router.post('/:id/resend', protect, resendNotification);

export default router;
