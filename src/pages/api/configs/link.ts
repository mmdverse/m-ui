import type { NextApiRequest, NextApiResponse } from 'next';
import { connectDB, Config, Server } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { generateLink } from '@/lib/links';
import { openConfig, openServer } from '@/lib/credentials';
import { isObjectId, fail, apiError } from '@/lib/validate';

/** Returns the real share link (or wireguard .conf) for a stored config. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const payload = requireAuth(req, res);
  if (!payload) return;
  try {
    await connectDB();
    const { id } = req.query;
    if (!isObjectId(id)) return apiError(res, 400, 'api.idInvalid', 'invalid id');
    const config = openConfig(await Config.findById(id).lean() as any);
    if (!config) return apiError(res, 404, 'api.configNotFound', 'config not found');
    const server = openServer(await Server.findById(config.serverId).lean() as any);
    if (!server) return apiError(res, 404, 'api.serverNotFound', 'server not found');

    // SOCKS5: the proxy must have been deployed on the server first
    if (config.protocol === 'socks5') {
      if (!config.deployed) {
        return apiError(
          res, 400, 'api.proxyNotDeployed',
          'پروکسی هنوز روی سرور فعال نشده — اول «اجرا روی سرور» را بزنید',
        );
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
          code: 'api.wgPubKeyMissing',
        });
      }
      if (!config.wgClientPriv) {
        return apiError(res, 400, 'api.wgClientKeyMissing', 'کلید خصوصی کلاینت وجود ندارد — کانفیگ را دوباره بسازید');
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
      return res.status(400).json(
        result.code
          ? { error: result.error, code: result.code, ...(result.vars ? { vars: result.vars } : {}) }
          : { error: result.error },
      );
    }
    res.json({ link: result.link, protocol: config.protocol });
  } catch (err: any) {
    fail(res, err);
  }
}
