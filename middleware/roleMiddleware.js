import { isManagerRole } from '../utils/roles.js';

export const managerOnly = (req, res, next) => {
  if (!req.user || !isManagerRole(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Manager access required' });
  }
  next();
};

export const clientOnly = (req, res, next) => {
  if (!req.user || req.user.role !== 'client') {
    return res.status(403).json({ success: false, message: 'Client access required' });
  }
  next();
};
