import Document from '../models/Document.js';
import Request from '../models/Request.js';
import cloudinary from '../config/cloudinary.js';
import { sendResubmissionEmail, sendApprovalEmail, buildPublicUploadLink } from '../utils/emailService.js';
import { sendResubmissionSMS } from '../utils/smsService.js';

const uploadToCloudinary = (fileBuffer, folderPath) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: folderPath },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    uploadStream.end(fileBuffer);
  });
};

export const uploadDocuments = async (req, res) => {
  try {
    const { token } = req.params;
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

    const { docTypes } = req.body;
    let typesArray = Array.isArray(docTypes) ? docTypes : [docTypes];
    if (typesArray.length === 1 && typeof typesArray[0] === 'string' && typesArray[0].trim().startsWith('[')) {
      try {
        typesArray = JSON.parse(typesArray[0]);
      } catch {
        /* keep as single entry */
      }
    }
    
    const savedDocs = [];

    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      const docType = typesArray[i];
      
      const folderPath = `docverify/${request._id}/${docType.replace(/\s+/g, '_')}`;
      
      const result = await uploadToCloudinary(file.buffer, folderPath);

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
          submittedBy: request.recipientEmail
        });
      }
      savedDocs.push(document);
    }

    request.status = 'submitted';
    await request.save();

    res.status(201).json({
      success: true,
      data: savedDocs,
      message: 'Documents uploaded successfully'
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const uploadDocumentsAuthenticated = async (req, res) => {
  try {
    const { id } = req.params;
    const request = await Request.findById(id);

    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    const isRecipient = request.recipientEmail === req.user.email;
    const isCreator =
      request.createdBy?.toString() === req.user._id.toString();
    if (!isRecipient && !isCreator) {
      return res.status(403).json({ success: false, message: 'Not authorized to upload for this request' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files uploaded' });
    }

    const { docTypes } = req.body;
    const typesArray = Array.isArray(docTypes) ? docTypes : [docTypes];

    const savedDocs = [];

    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      const docType = typesArray[i];

      const folderPath = `docverify/${request._id}/${docType.replace(/\s+/g, '_')}`;

      const result = await uploadToCloudinary(file.buffer, folderPath);

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
          submittedBy: request.recipientEmail
        });
      }
      savedDocs.push(document);
    }

    request.status = 'submitted';
    await request.save();

    res.status(201).json({
      success: true,
      data: savedDocs,
      message: 'Documents uploaded successfully'
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

    // Check if user is either the creator or the recipient
    if (request.createdBy.toString() !== req.user._id.toString() && request.recipientEmail !== req.user.email) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this request' });
    }

    const documents = await Document.find({ requestId: req.params.id });
    
    res.json({
      success: true,
      data: documents,
      message: 'Documents fetched successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const verifyDocument = async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);
    if (!document) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    const request = await Request.findOne({ _id: document.requestId, createdBy: req.user._id });
    if (!request) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    document.status = 'verified';
    document.verifiedAt = new Date();
    await document.save();

    const allDocs = await Document.find({ requestId: request._id });
    const reqDocTypes = request.requiredDocuments.filter(d => d.isRequired).map(d => d.docType);
    
    const verifiedReqDocs = allDocs.filter(d => 
      reqDocTypes.includes(d.docType) && d.status === 'verified'
    );

    if (verifiedReqDocs.length === reqDocTypes.length && reqDocTypes.length > 0) {
      request.status = 'approved';
      await request.save();
      
      await sendApprovalEmail(
        request.recipientEmail,
        request.recipientName,
        req.user.name
      );
    }

    res.json({
      success: true,
      data: document,
      message: 'Document verified'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const rejectDocument = async (req, res) => {
  try {
    const { remarks } = req.body;
    
    const document = await Document.findById(req.params.id);
    if (!document) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    const request = await Request.findOne({ _id: document.requestId, createdBy: req.user._id });
    if (!request) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
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
    
    await sendResubmissionSMS(
      request.recipientPhone,
      accessLink
    );

    res.json({
      success: true,
      data: document,
      message: 'Document rejected and user notified'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteDocument = async (req, res) => {
  try {
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
