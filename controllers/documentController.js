import Document from '../models/Document.js';
import Request from '../models/Request.js';
import cloudinary from '../config/cloudinary.js';
import { sendResubmissionEmail, sendApprovalEmail, buildPublicUploadLink } from '../utils/emailService.js';
import { sendResubmissionSMS } from '../utils/smsService.js';
import { isManagerRole } from '../utils/roles.js';

const normalizeEmail = (v) => String(v || '').toLowerCase().trim();

const allowedDocTypes = (request) => new Set((request.requiredDocuments || []).map((r) => r.docType));

const bumpRequestAfterClientUpload = async (request) => {
  if (['pending', 'submitted', 'under_review'].includes(request.status)) {
    request.status = 'in_progress';
    await request.save();
  }
};

const uploadToCloudinary = (fileBuffer, folderPath, originalName) => {
  return new Promise((resolve, reject) => {
    const ext = originalName.split('.').pop().toLowerCase();

    const isRawFile = ['pdf', 'doc', 'docx'].includes(ext);

    const options = {
      folder: folderPath,
      resource_type: isRawFile ? 'raw' : 'image',  // 🔥 FIXED
      public_id: `${originalName.split('.')[0]}_${Date.now()}${isRawFile ? `.${ext}` : ''}`,
      use_filename: true,
      unique_filename: false
    };

    const uploadStream = cloudinary.uploader.upload_stream(
      options,
      (error, result) => {
        if (error) {
          console.error('[ERROR]', error);
          reject(error);
        } else {
          console.log('[SUCCESS]', result.secure_url);
          resolve(result);
        }
      }
    );

    uploadStream.end(fileBuffer);
  });
};

export const uploadDocuments = async (req, res) => {
  try {
    const { token } = req.params;
    console.log(`[DIAGNOSTIC] uploadDocuments (magic link) - token: ${token}, files: ${req.files?.length}`);
    const request = await Request.findOne({ accessToken: token });

    if (!request) {
      return res.status(404).json({ success: false, message: 'Invalid or expired link' });
    }

    if (new Date() > new Date(request.accessTokenExpiry)) {
      return res.status(400).json({ success: false, message: 'Link has expired' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files uploaded' });
    }

    const allowed = allowedDocTypes(request);
    if (allowed.size === 0) {
      return res.status(400).json({ success: false, message: 'This request has no document slots defined' });
    }

    const { docTypes } = req.body;
    let typesArray = Array.isArray(docTypes) ? docTypes : [docTypes];
    if (
      typesArray.length === 1 &&
      typeof typesArray[0] === 'string' &&
      typesArray[0].trim().startsWith('[')
    ) {
      try {
        typesArray = JSON.parse(typesArray[0]);
      } catch {
        /* keep */
      }
    }

    for (const t of typesArray) {
      if (!allowed.has(t)) {
        return res.status(400).json({
          success: false,
          message: `File type "${t}" is not part of this request. You can only upload requested documents.`,
        });
      }
    }

    const savedDocs = [];

    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      const docType = typesArray[i];

      const folderPath = `docverify/${request._id}/${docType.replace(/\s+/g, '_')}`;

      const result = await uploadToCloudinary(file.buffer, folderPath, file.originalname);

      let document = await Document.findOne({ requestId: request._id, docType });

      if (document) {
        document.fileUrl = result.secure_url;
        document.filePublicId = result.public_id;
        document.fileName = file.originalname;
        document.fileSize = file.size;
        document.mimeType = file.mimetype;
        document.status = 'uploaded';
        document.uploadedAt = new Date();
        document.remarks = '';
        await document.save();
      } else {
        document = await Document.create({
          requestId: request._id,
          docType,
          label: docType,
          fileUrl: result.secure_url,
          filePublicId: result.public_id,
          fileName: file.originalname,
          fileSize: file.size,
          mimeType: file.mimetype,
          status: 'uploaded',
          uploadedAt: new Date(),
          submittedBy: request.recipientEmail,
        });
      }
      savedDocs.push(document);
    }

    // Magic-link flow: treat upload batch as submitted for review (no login).
    request.status = 'submitted';
    await request.save();

    res.status(201).json({
      success: true,
      data: savedDocs,
      message: 'Documents uploaded successfully',
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const uploadDocumentsAuthenticated = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[DIAGNOSTIC] uploadDocumentsAuthenticated - id: ${id}, user: ${req.user?._id}, files: ${req.files?.length}`);
    const request = await Request.findById(id);

    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    if (req.user.role !== 'client') {
      return res.status(403).json({
        success: false,
        message: 'Only client accounts can upload documents. Managers review and approve only.',
      });
    }

    if (normalizeEmail(request.recipientEmail) !== normalizeEmail(req.user.email)) {
      return res.status(403).json({
        success: false,
        message: 'You can only upload files for requests sent to your email.',
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files uploaded' });
    }

    const allowed = allowedDocTypes(request);
    const { docTypes } = req.body;
    const typesArray = Array.isArray(docTypes) ? docTypes : [docTypes];

    for (const t of typesArray) {
      if (!allowed.has(t)) {
        return res.status(400).json({
          success: false,
          message: `You cannot upload "${t}" for this request. Use only the document slots the manager asked for.`,
        });
      }
    }

    const savedDocs = [];

    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      const docType = typesArray[i];

      const folderPath = `docverify/${request._id}/${docType.replace(/\s+/g, '_')}`;

      const result = await uploadToCloudinary(file.buffer, folderPath, file.originalname);

      let document = await Document.findOne({ requestId: request._id, docType });

      if (document) {
        document.fileUrl = result.secure_url;
        document.filePublicId = result.public_id;
        document.fileName = file.originalname;
        document.fileSize = file.size;
        document.mimeType = file.mimetype;
        document.status = 'uploaded';
        document.uploadedAt = new Date();
        document.remarks = '';
        await document.save();
      } else {
        document = await Document.create({
          requestId: request._id,
          docType,
          label: docType,
          fileUrl: result.secure_url,
          filePublicId: result.public_id,
          fileName: file.originalname,
          fileSize: file.size,
          mimeType: file.mimetype,
          status: 'uploaded',
          uploadedAt: new Date(),
          submittedBy: request.recipientEmail,
        });
      }
      savedDocs.push(document);
    }

    await bumpRequestAfterClientUpload(request);

    res.status(201).json({
      success: true,
      data: savedDocs,
      message: 'Files saved. When everything looks right, submit the request for manager review.',
    });
  } catch (error) {
    console.error('Authenticated upload error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getDocumentsByRequest = async (req, res) => {
  try {
    const request = await Request.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    const isCreator = request.createdBy.toString() === req.user._id.toString();
    const isRecipient = normalizeEmail(request.recipientEmail) === normalizeEmail(req.user.email);

    if (!isCreator && !isRecipient) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this request' });
    }

    const documents = await Document.find({ requestId: req.params.id });

    res.json({
      success: true,
      data: documents,
      message: 'Documents fetched successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const verifyDocument = async (req, res) => {
  try {
    if (!isManagerRole(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Only managers can verify documents' });
    }

    const document = await Document.findById(req.params.id);
    if (!document) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    const request = await Request.findOne({ _id: document.requestId, createdBy: req.user._id });
    if (!request) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    if (request.status !== 'submitted' && request.status !== 'in_progress') {
      return res.status(400).json({
        success: false,
        message: 'You can verify documents once the client has started uploading.',
      });
    }

    document.status = 'verified';
    document.verifiedAt = new Date();
    await document.save();

    const allDocs = await Document.find({ requestId: request._id });
    const reqDocTypes = request.requiredDocuments.filter((d) => d.isRequired).map((d) => d.docType);

    const verifiedReqDocs = allDocs.filter(
      (d) => reqDocTypes.includes(d.docType) && d.status === 'verified'
    );

    if (verifiedReqDocs.length === reqDocTypes.length && reqDocTypes.length > 0) {
      request.status = 'approved';
      await request.save();

      await sendApprovalEmail(request.recipientEmail, request.recipientName, req.user.name);
    }

    res.json({
      success: true,
      data: document,
      message: 'Document verified',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const rejectDocument = async (req, res) => {
  try {
    if (!isManagerRole(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Only managers can reject documents' });
    }

    const { remarks } = req.body;

    const document = await Document.findById(req.params.id);
    if (!document) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    const request = await Request.findOne({ _id: document.requestId, createdBy: req.user._id });
    if (!request) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    if (request.status !== 'submitted' && request.status !== 'in_progress') {
      return res.status(400).json({
        success: false,
        message: 'You can reject or request changes once the client has started uploading.',
      });
    }

    document.status = 'rejected';
    document.remarks = remarks || 'Rejected. Please re-upload.';
    await document.save();

    request.status = 'under_review';
    await request.save();

    const accessLink = buildPublicUploadLink(request.accessToken);

    await sendResubmissionEmail(
      request.recipientEmail,
      request.recipientName,
      req.user.name,
      [document],
      accessLink
    );

    await sendResubmissionSMS(request.recipientPhone, accessLink);

    res.json({
      success: true,
      data: document,
      message: 'Document rejected and user notified',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteDocument = async (req, res) => {
  try {
    if (!isManagerRole(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Only managers can remove documents' });
    }

    const document = await Document.findById(req.params.id);
    if (!document) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    const request = await Request.findOne({ _id: document.requestId, createdBy: req.user._id });
    if (!request) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    if (document.filePublicId) {
      await cloudinary.uploader.destroy(document.filePublicId).catch(console.error);
    }

    await Document.findByIdAndDelete(req.params.id);

    res.json({ success: true, data: {}, message: 'Document deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
