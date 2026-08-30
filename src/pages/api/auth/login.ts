import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcryptjs';
import { connectDB, User } from '@/lib/db';
import { signToken, seedAdmin } from '@/lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    await connectDB();
    await seedAdmin();
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'username and password required' });

    const user = await User.findOne({ username: String(username), isActive: true }).lean() as any;
    if (!user || !bcrypt.compareSync(String(password), user.passwordHash)) {
      return res.status(401).json({ error: 'نام کاربری یا رمز عبور اشتباه' });
    }
    const token = signToken({ username: user.username, role: user.role });
    res.json({ token, user: { username: user.username, role: user.role } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
