import Request from '../models/Request.js';
import Document from '../models/Document.js';
import { generateSecureToken } from '../utils/generateToken.js';
import { sendRequestEmail, buildPublicUploadLink } from '../utils/emailService.js';
import { sendRequestSMS } from '../utils/smsService.js';

export const createRequest = async (req, res) => {
  try {
    const { recipientName, recipientEmail, recipientPhone, description, requiredDocuments } = req.body;

    const accessToken = generateSecureToken();
    const accessTokenExpiry = new Date();
    accessTokenExpiry.setDate(accessTokenExpiry.getDate() + 7);

    const request = await Request.create({
      createdBy: req.user._id,
      recipientName,
      recipientEmail,
      recipientPhone,
      description,
      requiredDocuments,
      accessToken,
      accessTokenExpiry,
      notificationSentAt: new Date()
    });

    const accessLink = buildPublicUploadLink(accessToken);

    await sendRequestEmail(
      recipientEmail, 
      recipientName, 
      req.user.name, 
      requiredDocuments, 
      accessLink, 
      description
    );
    
    await sendRequestSMS(
      recipientPhone,
      req.user.name,
      accessLink
    );

    res.status(201).json({
      success: true,
      data: request,
      message: 'Request created and notifications sent successfully'
    });
  } catch (error) {
    console.error('Request creation error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getRequests = async (req, res) => {
  try {
    const requests = await Request.find({ createdBy: req.user._id })
      .sort('-createdAt');
      
    res.json({
      success: true,
      data: requests,
      message: 'Requests fetched successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getRequestById = async (req, res) => {
  try {
    const request = await Request.findById(req.params.id);
    
    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    // Check if user is either the creator or the recipient
    if (request.createdBy.toString() !== req.user._id.toString() && request.recipientEmail !== req.user.email) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this request' });
    }

    res.json({
      success: true,
      data: request,
      message: 'Request fetched successfully'
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
    const request = await Request.findOne({ accessToken: token })
      .populate('createdBy', 'name email');

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
      message: 'Token verified successfully'
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
    
    await sendRequestSMS(
      request.recipientPhone,
      req.user.name,
      accessLink
    );

    res.json({
      success: true,
      data: request,
      message: 'Notifications resent and link renewed'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
