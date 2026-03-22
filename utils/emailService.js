import nodemailer from 'nodemailer';

/**
 * Public upload link for Person B (email/SMS). Always set FRONTEND_URL in .env
 * to your deployed frontend (e.g. https://docverify.vercel.app) before production.
 */
export const buildPublicUploadLink = (accessToken) => {
  const base = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
  return `${base}/upload/${accessToken}`;
};

export const buildVerificationLink = (token) => {
  // HARDCODED FOR TESTING:
  const base = process.env.FRONTEND_URL || 'http://localhost:5173';
  console.log(`[CRITICAL DIAGNOSTIC] buildVerificationLink called. Using base: ${base}`);
  return `${base}/verify-email/${token}`;
};

const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

export const sendRequestEmail = async (to, recipientName, requesterName, documents, accessLink, description) => {
  if (!process.env.EMAIL_HOST) {
    return console.warn('Email not sent (Nodemailer not configured): sendRequestEmail');
  }
  const transporter = createTransporter();
  
  const docsList = documents.map(doc => `<li>${doc.label} ${doc.isRequired ? '(Required)' : '(Optional)'}</li>`).join('');
  
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to,
    subject: `Action Required: Document Submission Request from ${requesterName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <div style="background-color: #1E40AF; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">DocVerify</h1>
        </div>
        <div style="padding: 20px; border: 1px solid #ddd;">
          <h2>Hello ${recipientName || 'there'},</h2>
          <p><strong>${requesterName}</strong> has requested you to securely submit documents for verification.</p>
          ${description ? `<p><em>Note from requester:</em> ${description}</p>` : ''}
          
          <h3>Required Documents:</h3>
          <ul>
            ${docsList}
          </ul>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${accessLink}" style="background-color: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Upload Documents Now</a>
          </div>
          
          <p style="color: #666; font-size: 14px;">This secure link expires in 7 days.</p>
        </div>
        <div style="text-align: center; padding: 20px; font-size: 12px; color: #666;">
          <p>&copy; ${new Date().getFullYear()} DocVerify. All rights reserved.</p>
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Email send error:', error.message);
  }
};

export const sendResubmissionEmail = async (to, recipientName, requesterName, rejectedDocs, accessLink) => {
  if (!process.env.EMAIL_HOST) return;
  const transporter = createTransporter();
  
  const docsList = rejectedDocs.map(doc => `
    <li style="margin-bottom: 10px;">
      <strong>${doc.label}</strong><br/>
      <span style="color: #EF4444;">Reason for rejection: ${doc.remarks || 'Please re-upload a clearer copy.'}</span>
    </li>
  `).join('');
  
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to,
    subject: `Action Required: Please Re-upload Documents - ${requesterName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <div style="background-color: #F59E0B; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">DocVerify - Action Needed</h1>
        </div>
        <div style="padding: 20px; border: 1px solid #ddd;">
          <h2>Hello ${recipientName || 'there'},</h2>
          <p>Some of the documents you previously submitted to <strong>${requesterName}</strong> require your attention and need to be re-uploaded.</p>
          
          <h3>Documents to Re-upload:</h3>
          <ul>
            ${docsList}
          </ul>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${accessLink}" style="background-color: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Re-upload Documents</a>
          </div>
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Email send error:', error.message);
  }
};

export const sendApprovalEmail = async (to, recipientName, requesterName) => {
  if (!process.env.EMAIL_HOST) return;
  const transporter = createTransporter();
  
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to,
    subject: `Your Documents Have Been Approved ✓`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <div style="background-color: #10B981; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Verification Complete</h1>
        </div>
        <div style="padding: 20px; border: 1px solid #ddd;">
          <h2>Congratulations ${recipientName || ''},</h2>
          <p>All your submitted documents have been reviewed and approved by <strong>${requesterName}</strong>.</p>
          <p>No further action is required from your side.</p>
          <p>Thank you for using our secure document verification portal.</p>
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Email send error:', error.message);
  }
};

export const sendVerificationEmail = async (to, name, verificationLink) => {
  if (!process.env.EMAIL_HOST) {
    return console.warn('Email not sent (Nodemailer not configured): sendVerificationEmail');
  }
  const transporter = createTransporter();
  
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to,
    subject: 'Please verify your email address',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333 text-align: center;">
        <div style="background-color: #1E40AF; padding: 20px;">
          <h1 style="color: white; margin: 0;">DocVerify</h1>
        </div>
        <div style="padding: 30px; border: 1px solid #ddd; text-align: left;">
          <h2>Welcome to DocVerify, ${name}!</h2>
          <p>Thank you for signing up. Please verify your email address to activate your account and start using our secure document platform.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationLink}" style="background-color: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Verify Email Address</a>
          </div>
          
          <p style="color: #666; font-size: 14px;">If the button above doesn't work, copy and paste this link into your browser:</p>
          <p style="color: #3B82F6; font-size: 12px; word-break: break-all;">${verificationLink}</p>
          
          <p style="color: #666; font-size: 14px; margin-top: 20px;">This link will expire in 24 hours.</p>
        </div>
        <div style="text-align: center; padding: 20px; font-size: 12px; color: #666;">
          <p>&copy; ${new Date().getFullYear()} DocVerify. All rights reserved.</p>
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Email send error:', error.message);
  }
};
