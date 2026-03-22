import mongoose from 'mongoose';

const requiredDocumentSchema = new mongoose.Schema({
  docType: { type: String, required: true },
  label: { type: String, required: true },
  description: { type: String },
  isRequired: { type: Boolean, default: true }
});

const requestSchema = new mongoose.Schema({
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recipientName: { type: String },
  recipientEmail: { type: String, required: true },
  recipientPhone: { type: String, required: true },
  description: { type: String },
  requiredDocuments: [requiredDocumentSchema],
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'submitted', 'under_review', 'approved', 'rejected'],
    default: 'pending',
  },
  accessToken: { type: String, unique: true, required: true },
  accessTokenExpiry: { type: Date, required: true },
  notificationSentAt: { type: Date },
}, { timestamps: true });

const Request = mongoose.model('Request', requestSchema);
export default Request;
