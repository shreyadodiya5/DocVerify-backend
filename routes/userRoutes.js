import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { managerOnly } from '../middleware/roleMiddleware.js';
import { searchClients, getClientByEmail } from '../controllers/userController.js';

const router = express.Router();

router.get('/clients', protect, managerOnly, searchClients);
router.get('/clients/lookup', protect, managerOnly, getClientByEmail);

export default router;
