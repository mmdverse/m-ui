import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { connectDB, Config, Server } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { runCommand } from '@/lib/ssh';
import { recordActivity } from '@/lib/activity';

/**
 * Deploys a real SOCKS5 proxy (microsocks) on the config's server over SSH:
 * installs the package if missing (apt/dnf/yum/apk) and starts the proxy in
 * the background with per-config credentials. The proxy keeps running
 * detached; configs/deploy can be re-run to refresh credentials.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const payload = requireAuth(req, res);
  if (!payload) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    await connectDB();
    const { id } = req.query || req.body || {};
    const config = await Config.findById(id).lean() as any;
    if (!config) return res.status(404).json({ error: 'config not found' });
    if (config.protocol !== 'socks5') {
      return res.status(400).json({ error: 'فقط برای کانفیگ SOCKS5 قابل استفاده است' });
    }
    const server = await Server.findById(config.serverId).lean() as any;
    if (!server) return res.status(404).json({ error: 'server not found' });

    const port = Number(config.port) || 1080;

    // per-config proxy credentials, generated once and kept in the DB
    const socksUser = config.socksUser || crypto.randomBytes(6).toString('hex').slice(0, 10);
    const socksPass = config.socksPass || crypto.randomBytes(12).toString('base64url');

    // install microsocks if missing (sudo when the SSH user is not root)
    const installScript = [
      'if [ "$(id -u)" != "0" ]; then SUDO=sudo; else SUDO=""; fi',
      'if ! command -v microsocks >/dev/null 2>&1; then',
      '  if command -v apt-get >/dev/null 2>&1; then $SUDO apt-get install -y microsocks >/dev/null 2>&1 || ($SUDO apt-get update >/dev/null 2>&1 && $SUDO apt-get install -y microsocks >/dev/null 2>&1);',
      '  elif command -v dnf >/dev/null 2>&1; then $SUDO dnf install -y microsocks >/dev/null 2>&1;',
      '  elif command -v yum >/dev/null 2>&1; then $SUDO yum install -y microsocks >/dev/null 2>&1;',
      '  elif command -v apk >/dev/null 2>&1; then $SUDO apk add microsocks >/dev/null 2>&1;',
      '  fi',
      'fi',
      'command -v microsocks || echo "MICROSOCKS_MISSING"',
    ].join('\n');

    const install = await runCommand(server, installScript);
    if (install.code !== 0 || install.stdout.trim() === 'MICROSOCKS_MISSING') {
      const errMsg = 'نصب microsocks روی سرور ناموفق بود (بسته در مخازن سرور نیست یا دسترسی sudo ندارد)';
      await Config.updateOne({ _id: config._id }, { $set: { deployed: false, deployError: errMsg } });
      await recordActivity(`نصب SOCKS5 روی «${server.name}» ناموفق بود`, 'error', payload.username);
      return res.status(500).json({ error: errMsg, detail: (install.stderr || install.stdout).slice(0, 300) });
    }

    // (re)start the proxy on the configured port with the credentials
    // (previous instance is stopped via its pidfile — never pkill by pattern,
    //  the pattern would match this very shell)
    const startScript = [
      'if [ "$(id -u)" != "0" ]; then SUDO=sudo; else SUDO=""; fi',
      `PIDFILE=/tmp/m-ui-socks-${port}.pid`,
      'if [ -f "$PIDFILE" ]; then $SUDO kill "$(cat "$PIDFILE")" 2>/dev/null || true; rm -f "$PIDFILE"; fi',
      `$SUDO sh -c 'setsid nohup microsocks -i 0.0.0.0 -p ${port} -u ${socksUser} -P ${socksPass} >>/var/log/microsocks.log 2>&1 < /dev/null & echo $! > /tmp/m-ui-socks-${port}.pid'`,
      'sleep 1',
      `ss -tln 2>/dev/null | grep -q ":${port}" && echo "LISTENING" || echo "NOT_LISTENING"`,
    ].join('\n');

    const start = await runCommand(server, startScript);
    if (start.code !== 0 || !start.stdout.includes('LISTENING')) {
      const errMsg = `پروکسی روی پورت ${port} بالا نیامد (پورت آزاد نیست یا مجوز bind ندارد)`;
      await Config.updateOne({ _id: config._id }, { $set: { deployed: false, deployError: errMsg } });
      await recordActivity(`اجرای SOCKS5 روی «${server.name}» ناموفق بود`, 'error', payload.username);
      return res.status(500).json({ error: errMsg, detail: (start.stderr || start.stdout).slice(0, 300) });
    }

    await Config.updateOne(
      { _id: config._id },
      { $set: { deployed: true, deployError: '', socksUser, socksPass } }
    );
    await recordActivity(
      `پروکسی SOCKS5 کانفیگ «${config.name}» روی ${server.host}:${port} فعال شد`,
      'success',
      payload.username
    );
    res.json({ success: true, host: server.host, port, user: socksUser, pass: socksPass });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
