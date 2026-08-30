import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcryptjs';
import { connectDB, User } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { recordActivity } from '@/lib/activity';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const payload = requireAuth(req, res);
  if (!payload) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    await connectDB();
    const { oldPassword, newPassword } = req.body || {};
    if (!oldPassword || !newPassword) return res.status(400).json({ error: 'oldPassword and newPassword required' });
    if (String(newPassword).length < 8) {
      return res.status(400).json({ error: 'new password must be at least 8 characters' });
    }
    const user = await User.findOne({ username: payload.username }).lean() as any;
    if (!user || !bcrypt.compareSync(String(oldPassword), user.passwordHash)) {
      return res.status(401).json({ error: 'رمز فعلی اشتباه است' });
    }
    await User.updateOne(
      { _id: user._id },
      { $set: { passwordHash: bcrypt.hashSync(String(newPassword), 10) } }
    );
    await recordActivity('رمز عبور تغییر کرد', 'success', payload.username);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
