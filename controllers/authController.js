import User from '../models/User.js';
import { generateAccessToken } from '../utils/generateToken.js';

export const registerUser = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    const user = await User.create({
      name,
      email,
      password,
      phone
    });

    if (user) {
      res.status(201).json({
        success: true,
        data: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          token: generateAccessToken(user._id)
        },
        message: 'User registered successfully'
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

    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
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
