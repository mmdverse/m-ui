import type { NextApiRequest, NextApiResponse } from 'next';
import { connectDB, Server } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { detectLocation } from '@/lib/geo';
import { recordActivity } from '@/lib/activity';
import { parsePort, clampText, fail, apiError } from '@/lib/validate';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const payload = requireAuth(req, res, 'admin');
  if (!payload) return;
  if (req.method !== 'POST') return apiError(res, 405, 'api.methodNotAllowed', 'Method not allowed');
  try {
    await connectDB();
    const { name, host, port, username, authType, password, sshKey, location } = req.body || {};
    if (!name || !host) return apiError(res, 400, 'api.nameHostRequired', 'name and host are required');
    const parsedPort = parsePort(port ?? 22);
    if (parsedPort === null) return apiError(res, 400, 'api.portRange', 'پورت باید عددی بین ۱ تا ۶۵۵۳۵ باشد');
    if (!['password', 'key'].includes(authType)) {
      return apiError(res, 400, 'api.authTypeInvalid', 'authType must be password or key');
    }

    // location: auto-detect from the host, fall back to the manual label
    const geo = await detectLocation(String(host));
    // No Persian placeholder in stored data: an unknown location stays empty and
    // the UI renders its own "unknown" in the selected language.
    const finalLocation = geo ? geo.location : location || '';

    const server = await Server.create({
      name: String(name),
      host: String(host),
      port: parsedPort,
      username: username || 'root',
      authType,
      password: authType === 'password' ? clampText(password, 4096) : '',
      sshKey: authType === 'key' ? clampText(sshKey, 16384) : '',
      location: finalLocation,
      geoSource: geo ? 'auto' : location ? 'manual' : 'none',
      status: 'unknown',
    });
    await recordActivity(
      `سرور «${server.name}» اضافه شد (موقعیت: ${finalLocation})`,
      'info',
      payload.username,
      'act.serverAdded',
      { name: server.name, location: finalLocation },
    );
    // Never echo credential fields back (audit P1-4).
    const safe = { ...server.toObject() } as any;
    delete safe.password;
    delete safe.sshKey;
    res.json({ success: true, server: safe });
  } catch (err: any) {
    fail(res, err);
  }
}
