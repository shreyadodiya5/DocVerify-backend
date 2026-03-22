import Request from '../models/Request.js';
import Document from '../models/Document.js';
import User from '../models/User.js';
import { generateSecureToken } from '../utils/generateToken.js';
import { sendRequestEmail, buildPublicUploadLink } from '../utils/emailService.js';
import { sendRequestSMS } from '../utils/smsService.js';
import { isManagerRole, isClientRole } from '../utils/roles.js';

const normalizeEmail = (v) => String(v || '').toLowerCase().trim();

const recipientMatchesUser = (request, user) =>
  normalizeEmail(request.recipientEmail) === normalizeEmail(user.email);

export const createRequest = async (req, res) => {
  try {
    const { recipientName, recipientEmail, recipientPhone, description, requiredDocuments } = req.body;

    if (!Array.isArray(requiredDocuments) || requiredDocuments.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one document must be requested' });
    }

    const emailNorm = normalizeEmail(recipientEmail);
    const clientUser = await User.findOne({ email: emailNorm, role: 'client' });
    if (!clientUser) {
      return res.status(400).json({
        success: false,
        message:
          'No registered client account exists for this email. The person must sign up and choose “Client” before you can send a request.',
      });
    }

    const nameFinal = (recipientName && String(recipientName).trim()) || clientUser.name || 'Client';
    const phoneFinal = (recipientPhone && String(recipientPhone).trim()) || clientUser.phone || '';
    if (!phoneFinal) {
      return res.status(400).json({
        success: false,
        message: 'Recipient phone is required. Add a number or ask the client to update their profile.',
      });
    }

    const accessToken = generateSecureToken();
    const accessTokenExpiry = new Date();
    accessTokenExpiry.setDate(accessTokenExpiry.getDate() + 7);

    const request = await Request.create({
      createdBy: req.user._id,
      recipientName: nameFinal,
      recipientEmail: emailNorm,
      recipientPhone: phoneFinal,
      description,
      requiredDocuments,
      accessToken,
      accessTokenExpiry,
      notificationSentAt: new Date(),
    });

    const accessLink = buildPublicUploadLink(accessToken);

    await sendRequestEmail(
      emailNorm,
      nameFinal,
      req.user.name,
      requiredDocuments,
      accessLink,
      description
    );

    await sendRequestSMS(phoneFinal, req.user.name, accessLink);

    res.status(201).json({
      success: true,
      data: request,
      message: 'Request created and notifications sent successfully',
    });
  } catch (error) {
    console.error('Request creation error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getRequests = async (req, res) => {
  try {
    let requests;
    if (isClientRole(req.user.role)) {
      console.log(`[DIAGNOSTIC] getRequests: Fetching as Client for ${req.user.email}`);
      requests = await Request.find({ recipientEmail: normalizeEmail(req.user.email) })
        .populate('createdBy', 'name email')
        .sort('-createdAt');
    } else if (isManagerRole(req.user.role)) {
      console.log(`[DIAGNOSTIC] getRequests: Fetching as Manager for ID ${req.user._id}`);
      requests = await Request.find({ createdBy: req.user._id }).sort('-createdAt');
    } else {
      return res.status(403).json({ success: false, message: 'Unsupported account type' });
    }

    res.json({
      success: true,
      data: requests,
      message: 'Requests fetched successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getRequestById = async (req, res) => {
  try {
    const request = await Request.findById(req.params.id).populate('createdBy', 'name email');

    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    const isCreator = request.createdBy?._id?.toString() === req.user._id.toString();
    const isRecipient = recipientMatchesUser(request, req.user);

    if (!isCreator && !isRecipient) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this request' });
    }

    res.json({
      success: true,
      data: request,
      message: 'Request fetched successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const submitRequestForReview = async (req, res) => {
  try {
    const request = await Request.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    if (!isClientRole(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Only client accounts can submit for review' });
    }

    if (!recipientMatchesUser(request, req.user)) {
      return res.status(403).json({ success: false, message: 'You can only submit requests addressed to you' });
    }

    if (request.status === 'approved') {
      return res.status(400).json({ success: false, message: 'This request is already approved' });
    }

    const required = request.requiredDocuments.filter((d) => d.isRequired);
    const docs = await Document.find({ requestId: request._id });

    for (const rd of required) {
      const doc = docs.find((d) => d.docType === rd.docType);
      if (!doc?.fileUrl || doc.status === 'rejected') {
        return res.status(400).json({
          success: false,
          message:
            'Upload every required document (and replace anything marked rejected) before submitting for review.',
        });
      }
    }

    request.status = 'submitted';
    await request.save();

    res.json({
      success: true,
      data: request,
      message: 'Your documents were sent to the manager for review',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateRequestStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const request = await Request.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.user._id },
      { status },
      { new: true }
    );

    if (request) {
      res.json({ success: true, data: request, message: 'Status updated' });
    } else {
      res.status(404).json({ success: false, message: 'Request not found' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteRequest = async (req, res) => {
  try {
    const request = await Request.findOneAndDelete({ _id: req.params.id, createdBy: req.user._id });
    if (request) {
      res.json({ success: true, data: {}, message: 'Request removed' });
    } else {
      res.status(404).json({ success: false, message: 'Request not found' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const verifyAccessToken = async (req, res) => {
  try {
    const { token } = req.params;
    const request = await Request.findOne({ accessToken: token }).populate('createdBy', 'name email');

    if (!request) {
      return res.status(404).json({ success: false, message: 'Invalid access link' });
    }

    if (new Date() > new Date(request.accessTokenExpiry)) {
      return res.status(400).json({ success: false, message: 'Access link has expired' });
    }

    const documents = await Document.find({ requestId: request._id }).lean();

    res.json({
      success: true,
      data: {
        requestId: request._id,
        recipientName: request.recipientName,
        recipientEmail: request.recipientEmail,
        recipientPhone: request.recipientPhone,
        requesterName: request.createdBy?.name,
        description: request.description,
        requiredDocuments: request.requiredDocuments,
        status: request.status,
        documents,
      },
      message: 'Token verified successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const resendNotification = async (req, res) => {
  try {
    const request = await Request.findOne({ _id: req.params.id, createdBy: req.user._id });
    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    const accessToken = generateSecureToken();
    const accessTokenExpiry = new Date();
    accessTokenExpiry.setDate(accessTokenExpiry.getDate() + 7);

    request.accessToken = accessToken;
    request.accessTokenExpiry = accessTokenExpiry;
    request.notificationSentAt = new Date();
    await request.save();

    const accessLink = buildPublicUploadLink(accessToken);

    await sendRequestEmail(
      request.recipientEmail,
      request.recipientName,
      req.user.name,
      request.requiredDocuments,
      accessLink,
      request.description
    );

    await sendRequestSMS(request.recipientPhone, req.user.name, accessLink);

    res.json({
      success: true,
      data: request,
      message: 'Notifications resent and link renewed',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
