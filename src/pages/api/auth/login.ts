import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { config } from '@/lib/config';

const ADMIN_USER = { username: 'admin', password: 'admin123', role: 'admin' };

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { username, password } = req.body;
  if (username === ADMIN_USER.username && password === ADMIN_USER.password) {
    const token = jwt.sign({ username, role: 'admin' }, config.jwt.secret, { expiresIn: '7d' });
    return res.json({ token, user: { username, role: 'admin' } });
  }
  res.status(401).json({ error: 'نام کاربری یا رمز عبور اشتباه' });
}
