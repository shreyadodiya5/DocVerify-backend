import mongoose from 'mongoose';

const documentSchema = new mongoose.Schema({
  requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'Request', required: true },
  docType: { type: String, required: true },
  label: { type: String },
  fileUrl: { type: String },
  filePublicId: { type: String },
  fileName: { type: String },
  fileSize: { type: Number },
  mimeType: { type: String },
  status: { type: String, enum: ['pending', 'uploaded', 'verified', 'rejected'], default: 'pending' },
  remarks: { type: String },
  uploadedAt: { type: Date },
  verifiedAt: { type: Date },
  submittedBy: { type: String }
});

const Document = mongoose.model('Document', documentSchema);
export default Document;
