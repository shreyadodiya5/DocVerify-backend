import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import upload from '../middleware/uploadMiddleware.js';
import {
  uploadDocuments,
  uploadDocumentsAuthenticated,
  getDocumentsByRequest,
  verifyDocument,
  rejectDocument,
  deleteDocument
} from '../controllers/documentController.js';

const router = express.Router();

// Allow up to 10 files
router.post('/upload/:token', upload.array('files', 10), uploadDocuments);
router.post('/upload/auth/:id', protect, upload.array('files', 10), uploadDocumentsAuthenticated);

router.get('/request/:id', protect, getDocumentsByRequest);
router.put('/:id/verify', protect, verifyDocument);
router.put('/:id/reject', protect, rejectDocument);
router.delete('/:id', protect, deleteDocument);

export default router;
