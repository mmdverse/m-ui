import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import nacl from 'tweetnacl';
import { connectDB, Config } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { recordActivity } from '@/lib/activity';

const PROTOCOLS = ['vmess', 'vless', 'trojan', 'shadowsocks', 'socks5', 'wireguard'];
const TRANSPORTS = ['tcp', 'kcp', 'ws', 'http', 'quic', 'grpc'];
const SECURITIES = ['none', 'tls', 'reality'];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const payload = requireAuth(req, res);
  if (!payload) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    await connectDB();
    const {
      name, serverId, protocol, port, transport, security, domain, path, sni,
      pbk, fp, sid, wgServerPub, wgAddress, wgDns,
    } = req.body || {};
    if (!name || !serverId || !port) return res.status(400).json({ error: 'name, serverId and port are required' });
    if (!PROTOCOLS.includes(protocol)) return res.status(400).json({ error: 'invalid protocol' });

    // WireGuard needs a client keypair — generated once here, persisted.
    let wgClientPriv = '';
    let wgClientPub = '';
    if (protocol === 'wireguard') {
      const pair = nacl.box.keyPair();
      wgClientPriv = Buffer.from(pair.secretKey).toString('base64');
      wgClientPub = Buffer.from(pair.publicKey).toString('base64');
    }

    const config = await Config.create({
      name: String(name),
      serverId,
      protocol,
      uuid: crypto.randomUUID(), // persistent — the broker key for vmess/vless
      password: crypto.randomBytes(16).toString('base64url'), // for trojan/ss
      port: Number(port),
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
    await recordActivity(`کانفیگ «${config.name}» ایجاد شد`, 'info', payload.username);
    res.status(201).json({ success: true, config });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
