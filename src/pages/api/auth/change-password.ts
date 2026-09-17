import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcryptjs';
import { connectDB, User } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { recordActivity } from '@/lib/activity';
import { fail, apiError } from '@/lib/validate';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const payload = requireAuth(req, res);
  if (!payload) return;
  if (req.method !== 'POST') return apiError(res, 405, 'api.methodNotAllowed', 'Method not allowed');
  try {
    await connectDB();
    const { oldPassword, newPassword } = req.body || {};
    if (!oldPassword || !newPassword) return apiError(res, 400, 'api.passwordRequired', 'oldPassword and newPassword required');
    if (String(newPassword).length < 8) {
      return apiError(res, 400, 'api.passwordTooShort', 'new password must be at least 8 characters');
    }
    const user = await User.findOne({ username: payload.username }).lean() as any;
    if (!user || !bcrypt.compareSync(String(oldPassword), user.passwordHash)) {
      return apiError(res, 401, 'api.currentPasswordWrong', 'رمز فعلی اشتباه است');
    }
    await User.updateOne(
      { _id: user._id },
      { $set: { passwordHash: bcrypt.hashSync(String(newPassword), 10) } }
    );
    await recordActivity('رمز عبور تغییر کرد', 'success', payload.username, 'act.passwordChanged');
    res.json({ success: true });
  } catch (err: any) {
    fail(res, err);
  }
}
