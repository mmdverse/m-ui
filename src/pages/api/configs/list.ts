import type { NextApiRequest, NextApiResponse } from 'next';
import { connectDB, Config } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { fail } from '@/lib/validate';

// Sensitive material stays server-side; only the link endpoint and the deployer
// read it (audit P1-4: `socksPass` was leaking through this projection while the
// comment above claimed otherwise).
const PUBLIC_FIELDS = '-password -wgClientPriv -socksPass';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const payload = requireAuth(req, res);
  if (!payload) return;
  try {
    await connectDB();
    const configs = await Config.find().select(PUBLIC_FIELDS).sort({ createdAt: -1 }).lean() as any[];
    res.json(configs);
  } catch (err: any) {
    fail(res, err);
  }
}
