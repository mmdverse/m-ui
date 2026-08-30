import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcryptjs';
import { connectDB, User } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

const SAFE_FIELDS = 'username role isActive createdAt';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const payload = requireAuth(req, res, 'admin');
  if (!payload) return;

  try {
    await connectDB();
    if (req.method === 'GET') {
      const users = await User.find().select(SAFE_FIELDS).sort({ createdAt: -1 }).lean() as any;
      return res.json(users);
    }
    if (req.method === 'POST') {
      const { username, password, role } = req.body || {};
      if (!username || !password) return res.status(400).json({ error: 'username and password required' });
      if (String(password).length < 8) {
        return res.status(400).json({ error: 'password must be at least 8 characters' });
      }
      const exists = await User.findOne({ username: String(username) }).lean() as any;
      if (exists) return res.status(409).json({ error: 'username already exists' });
      const user = await User.create({
        username: String(username),
        passwordHash: bcrypt.hashSync(String(password), 10),
        role: ['admin', 'user', 'reseller'].includes(role) ? role : 'user',
      });
      return res.status(201).json({ username: user.username, role: user.role });
    }
    if (req.method === 'DELETE') {
      const { id } = req.query;
      const target = await User.findById(id).lean() as any;
      if (!target) return res.status(404).json({ error: 'user not found' });
      if (target.username === payload.username) {
        return res.status(400).json({ error: 'cannot delete yourself' });
      }
      await User.deleteOne({ _id: id });
      return res.json({ success: true });
    }
    res.status(405).json({ error: 'Method not allowed' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
