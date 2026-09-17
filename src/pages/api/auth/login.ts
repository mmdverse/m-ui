import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcryptjs';
import { connectDB, User } from '@/lib/db';
import { signToken, seedAdmin } from '@/lib/auth';
import { hit, reset } from '@/lib/ratelimit';
import { recordActivity } from '@/lib/activity';
import { fail, apiError } from '@/lib/validate';

// A bcrypt hash of a random string: compared against when the user does not
// exist, so a missing account and a wrong password cost the same wall-clock
// time (audit P3-18).
const DUMMY_HASH = '$2a$10$C6UzMDM.H6dfI/f/IKcEeO1Q4Yb1t5xQ4Xy0h9YQ1iZm4O4mYyoCy';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return apiError(res, 405, 'api.methodNotAllowed', 'Method not allowed');
  try {
    await connectDB();
    await seedAdmin();
    const { username, password } = req.body || {};
    if (!username || !password) return apiError(res, 400, 'api.usernamePasswordRequired', 'username and password required');

    // Brute-force guard: counted per client+account, 8 tries / 10 minutes.
    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
    const key = `login:${ip}:${String(username).toLowerCase()}`;
    const rl = hit(key, 8, 10 * 60_000);
    if (!rl.allowed) {
      await recordActivity(
        `تلاش‌های ناموفق ورود برای «${username}» موقتاً محدود شد`,
        'error', 'system', 'act.loginBlocked', { user: String(username) },
      );
      res.setHeader('Retry-After', String(rl.retryAfterSec));
      return apiError(
        res, 429, 'api.rateLimited',
        `تلاش‌های ناموفق زیاد بود؛ ${rl.retryAfterSec} ثانیه دیگر دوباره امتحان کنید`,
        { sec: rl.retryAfterSec },
      );
    }

    const user = await User.findOne({ username: String(username), isActive: true }).lean() as any;
    const ok = bcrypt.compareSync(String(password), user ? user.passwordHash : DUMMY_HASH);
    if (!user || !ok) {
      return apiError(res, 401, 'api.badCredentials', 'نام کاربری یا رمز عبور اشتباه');
    }
    reset(key);
    const token = signToken({ username: user.username, role: user.role });
    res.json({ token, user: { username: user.username, role: user.role } });
  } catch (err: any) {
    fail(res, err);
  }
}
