import User from '../models/User.js';

export const searchClients = async (req, res) => {
  try {
    const q = String(req.query.q || '')
      .trim()
      .slice(0, 80);
    const filter = { role: 'client' };
    if (q) {
      filter.$or = [
        { email: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
        { name: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
      ];
    }
    const clients = await User.find(filter).select('name email phone').limit(25).sort({ name: 1 });
    res.json({ success: true, data: clients, message: 'Clients fetched' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getClientByEmail = async (req, res) => {
  try {
    const email = String(req.query.email || '')
      .toLowerCase()
      .trim();
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email required' });
    }
    const client = await User.findOne({ email, role: 'client' }).select('name email phone');
    if (!client) {
      return res.status(404).json({ success: false, message: 'No client account with this email' });
    }
    res.json({ success: true, data: client, message: 'Client found' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
