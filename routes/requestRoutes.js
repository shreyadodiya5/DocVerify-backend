import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { managerOnly, clientOnly } from '../middleware/roleMiddleware.js';
import {
  createRequest,
  getRequests,
  getRequestById,
  updateRequestStatus,
  deleteRequest,
  verifyAccessToken,
  resendNotification,
  submitRequestForReview,
} from '../controllers/requestController.js';

const router = express.Router();

router.get('/verify/:token', verifyAccessToken);

router.route('/').post(protect, managerOnly, createRequest).get(protect, getRequests);

router.post('/:id/submit', protect, clientOnly, submitRequestForReview);

router.route('/:id').get(protect, getRequestById).delete(protect, managerOnly, deleteRequest);

router.put('/:id/status', protect, managerOnly, updateRequestStatus);
router.post('/:id/resend', protect, managerOnly, resendNotification);

export default router;
