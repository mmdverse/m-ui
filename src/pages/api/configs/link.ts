import type { NextApiRequest, NextApiResponse } from 'next';
import { connectDB, Config, Server } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { generateLink } from '@/lib/links';

/** Returns the real share link (or wireguard .conf) for a stored config. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const payload = requireAuth(req, res);
  if (!payload) return;
  try {
    await connectDB();
    const { id } = req.query;
    const config = await Config.findById(id).lean() as any;
    if (!config) return res.status(404).json({ error: 'config not found' });
    const server = await Server.findById(config.serverId).lean() as any;
    if (!server) return res.status(404).json({ error: 'server not found' });

    // SOCKS5: the proxy must have been deployed on the server first
    if (config.protocol === 'socks5') {
      if (!config.deployed) {
        return res.status(400).json({
          error: `پروکسی هنوز روی سرور فعال نشده — اول «فعال‌سازی روی سرور» را بزنید`,
        });
      }
      const auth = `${config.socksUser}:${config.socksPass}`;
      return res.json({
        link: `socks5://${encodeURIComponent(auth)}@${server.host}:${config.port}#${encodeURIComponent(config.name)}`,
        protocol: 'socks5',
      });
    }

    // WireGuard: the client .conf (the peer must be added on the server manually)
    if (config.protocol === 'wireguard') {
      if (!config.wgServerPub) {
        return res.status(400).json({
          error: 'کلید عمومی سرور (PubKey) برای WireGuard ثبت نشده — در فرم کانفیگ واردش کنید',
        });
      }
      if (!config.wgClientPriv) {
        return res.status(400).json({ error: 'کلید خصوصی کلاینت وجود ندارد — کانفیگ را دوباره بسازید' });
      }
      const conf = [
        '[Interface]',
        `PrivateKey = ${config.wgClientPriv}`,
        `Address = ${config.wgAddress}`,
        `DNS = ${config.wgDns}`,
        '',
        '[Peer]',
        `PublicKey = ${config.wgServerPub}`,
        `Endpoint = ${server.host}:${config.port}`,
        'AllowedIPs = 0.0.0.0/0',
        'PersistentKeepalive = 25',
        '',
      ].join('\n');
      return res.json({ link: conf, protocol: 'wireguard', format: 'conf' });
    }

    const result = generateLink(config, { host: server.host });
    if ('error' in result) {
      return res.status(400).json({ error: result.error });
    }
    res.json({ link: result.link, protocol: config.protocol });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
