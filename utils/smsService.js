import Twilio from 'twilio';

let twilioClient = null;

// Initialize Twilio client
const getClient = () => {
  if (!twilioClient && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    twilioClient = Twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
  }
  return twilioClient;
};

// Format phone number
const formatPhoneNumber = (phone) => {
  if (!phone) return null;

  let formatted = phone.trim();

  // If 10 digits → assume India
  if (formatted.length === 10 && !formatted.startsWith('+')) {
    formatted = '+91' + formatted;
  }

  return formatted;
};

// 🔹 Send Request SMS
export const sendRequestSMS = async (to, requesterName, accessLink) => {
  try {
    const client = getClient();
    if (!client) {
      console.warn('Twilio not configured, skipping SMS');
      return;
    }

    const formattedPhone = formatPhoneNumber(to);
    if (!formattedPhone) {
      console.error('Invalid phone number');
      return;
    }

    await client.messages.create({
      body: `DocVerify: ${requesterName} requested documents from you. Upload securely here: ${accessLink} (Expires in 7 days)`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: formattedPhone,
    });

    console.log('Request SMS sent ✅');

  } catch (error) {
    console.error('Error sending Request SMS:', error.message);
  }
};

// 🔹 Send Resubmission SMS
export const sendResubmissionSMS = async (to, accessLink) => {
  try {
    const client = getClient();
    if (!client) {
      console.warn('Twilio not configured, skipping SMS');
      return;
    }

    const formattedPhone = formatPhoneNumber(to);
    if (!formattedPhone) {
      console.error('Invalid phone number');
      return;
    }

    await client.messages.create({
      body: `DocVerify Needed: Some documents were rejected. Please check remarks and re-upload here: ${accessLink}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: formattedPhone,
    });

    console.log('Resubmission SMS sent ✅');

  } catch (error) {
    console.error('Error sending Resubmission SMS:', error.message);
  }
};