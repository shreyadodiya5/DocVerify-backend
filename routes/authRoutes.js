import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  registerUser,
  loginUser,
  logoutUser,
  getUserProfile,
  refreshToken
} from '../controllers/authController.js';

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/logout', protect, logoutUser);
router.get('/me', protect, getUserProfile);
router.post('/refresh-token', protect, refreshToken);

export default router;
