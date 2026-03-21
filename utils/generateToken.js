import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

export const generateAccessToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d',
  });
};

export const generateSecureToken = () => {
  return uuidv4();
};
