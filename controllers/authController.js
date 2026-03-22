import User from '../models/User.js';
import { generateAccessToken } from '../utils/generateToken.js';
import crypto from 'crypto';
import { sendVerificationEmail, buildVerificationLink } from '../utils/emailService.js';

export const registerUser = async (req, res) => {
  try {
    const { name, email, password, phone, role } = req.body;
    console.log(`[DIAGNOSTIC] Register attempt: ${email}, role: ${role}`);

    if (!role || !['manager', 'client'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Account type is required: choose Manager / agent or Client',
      });
    }

    const userExists = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const user = await User.create({
      name,
      email: String(email).toLowerCase().trim(),
      password,
      phone,
      role,
      verificationToken,
      verificationTokenExpires,
    });

    if (user) {
      const verificationLink = buildVerificationLink(verificationToken);
      console.log(`[DIAGNOSTIC] Sending verification email to ${user.email} with link: ${verificationLink}`);
      await sendVerificationEmail(user.email, user.name, verificationLink);

      res.status(201).json({
        success: true,
        message: 'Registration successful! Please check your email to verify your account.'
      });
    } else {
      res.status(400).json({ success: false, message: 'Invalid user data' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log(`[DIAGNOSTIC] Login attempt: ${email}`);

    const user = await User.findOne({ email: String(email).toLowerCase().trim() });

    if (user && (await user.matchPassword(password))) {
      if (!user.isVerified) {
        return res.status(401).json({ 
          success: false, 
          message: 'Please verify your email address before logging in.',
          notVerified: true 
        });
      }

      res.json({
        success: true,
        data: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          token: generateAccessToken(user._id)
        },
        message: 'Login successful'
      });
    } else {
      res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const logoutUser = async (req, res) => {
  res.status(200).json({ success: true, message: 'Logged out successfully' });
};

export const getUserProfile = async (req, res) => {
  const user = await User.findById(req.user._id).select('-password');
  if (user) {
    res.json({
      success: true,
      data: user,
      message: 'Profile fetched successfully'
    });
  } else {
    res.status(404).json({ success: false, message: 'User not found' });
  }
};

export const refreshToken = async (req, res) => {
  try {
    const token = generateAccessToken(req.user._id);
    res.json({
      success: true,
      data: { token },
      message: 'Token refreshed'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;
    const user = await User.findOne({
      verificationToken: token,
      verificationTokenExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired verification link' });
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;
    await user.save();

    res.json({ success: true, message: 'Email verified successfully! You can now log in.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const resendVerificationEmail = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: String(email).toLowerCase().trim() });

    if (!user) {
      return res.status(404).json({ success: false, message: 'No account found with this email' });
    }

    if (user.isVerified) {
      return res.status(400).json({ success: false, message: 'Account is already verified' });
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    user.verificationToken = verificationToken;
    user.verificationTokenExpires = verificationTokenExpires;
    await user.save();

    const verificationLink = buildVerificationLink(verificationToken);
    console.log(`[DIAGNOSTIC] Resending verification email to ${user.email} with link: ${verificationLink}`);
    await sendVerificationEmail(user.email, user.name, verificationLink);

    res.json({ success: true, message: 'Verification email resent successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
