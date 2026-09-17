import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import nacl from 'tweetnacl';
import { connectDB, Config } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { recordActivity } from '@/lib/activity';
import { parsePort, clampText, fail, apiError } from '@/lib/validate';

const PROTOCOLS = ['vmess', 'vless', 'trojan', 'shadowsocks', 'socks5', 'wireguard'];
const TRANSPORTS = ['tcp', 'kcp', 'ws', 'http', 'quic', 'grpc'];
const SECURITIES = ['none', 'tls', 'reality'];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const payload = requireAuth(req, res, 'admin');
  if (!payload) return;
  if (req.method !== 'POST') return apiError(res, 405, 'api.methodNotAllowed', 'Method not allowed');
  try {
    await connectDB();
    const {
      name, serverId, protocol, port, transport, security, domain, path, sni,
      pbk, fp, sid, wgServerPub, wgAddress, wgDns,
    } = req.body || {};
    // `port` is checked for presence separately from its range: port=0 is a bad
    // *value*, not a missing field, and the message should say so.
    if (!name || !serverId || port === undefined || port === null || port === '')
      return apiError(res, 400, 'api.configFieldsRequired', 'نام، سرور و پورت الزامی است');
    if (!PROTOCOLS.includes(protocol)) return apiError(res, 400, 'api.protocolInvalid', 'invalid protocol');
    const parsedPort = parsePort(port);
    if (parsedPort === null) {
      return apiError(res, 400, 'api.portRange', 'پورت باید عددی بین ۱ تا ۶۵۵۳۵ باشد');
    }

    // WireGuard needs a client keypair — generated once here, persisted.
    let wgClientPriv = '';
    let wgClientPub = '';
    if (protocol === 'wireguard') {
      const pair = nacl.box.keyPair();
      wgClientPriv = Buffer.from(pair.secretKey).toString('base64');
      wgClientPub = Buffer.from(pair.publicKey).toString('base64');
    }

    const config = await Config.create({
      name: clampText(name, 120),
      serverId,
      protocol,
      uuid: crypto.randomUUID(), // persistent — the broker key for vmess/vless
      password: crypto.randomBytes(16).toString('base64url'), // for trojan/ss
      port: parsedPort,
      transport: TRANSPORTS.includes(transport) ? transport : 'tcp',
      security: SECURITIES.includes(security) ? security : 'none',
      domain: domain || '',
      path: path || '/',
      sni: sni || '',
      pbk: pbk || '',
      fp: ['chrome', 'firefox', 'edge', 'safari', 'ios', 'android', '360', 'qq'].includes(fp) ? fp : 'chrome',
      sid: sid || '',
      wgClientPriv,
      wgClientPub,
      wgServerPub: wgServerPub || '',
      wgAddress: wgAddress || '10.0.0.2/32',
      wgDns: wgDns || '1.1.1.1',
      isActive: true,
    });
    await recordActivity(`کانفیگ «${config.name}» ایجاد شد`, 'info', payload.username, 'act.configCreated', { name: config.name });
    const safe = { ...config.toObject(), password: undefined } as any;
    delete safe.password;
    res.status(201).json({ success: true, config: safe });
  } catch (err: any) {
    fail(res, err);
  }
}
