import { Client } from 'ssh2';

export interface ServerCredentials {
  host: string;
  port: number;
  username: string;
  authType: 'password' | 'key';
  password: string;
  sshKey: string;
}

export interface StatsResult {
  ok: boolean;
  status: 'online' | 'error';
  cpuUsage?: number;
  ramUsage?: number;
  load1?: number;
  uptimeSec?: number;
  rxBytes?: number;
  txBytes?: number;
  error?: string;
}

const CONNECT_TIMEOUT = 10_000;
const CMD =
  'cat /proc/loadavg; free -m | awk \'/^Mem:/{print $2, $3}\'; ' +
  'cat /proc/uptime; nproc; ' +
  'cat /proc/net/dev | awk \'NR>2 && $1 !~ /^lo:/ {gsub(":", "", $1); rx+=$2; tx+=$10} END {print rx, tx}\'';

export function statsFromOutput(output: string, cpus: number): Partial<StatsResult> {
  // /proc/loadavg → "0.42 0.35 ..." | free -m → "total used" | uptime → "sec ..." | nproc | "rx tx"
  const [loadLine, memLine, uptimeLine, _cpus, netLine] = output.trim().split('\n');
  if (!loadLine || !memLine || !uptimeLine || !netLine) {
    throw new Error('unexpected SSH output: ' + output.slice(0, 120));
  }
  const load1 = parseFloat(loadLine.split(' ')[0]);
  const [memTotal, memUsed] = memLine.trim().split(/\s+/).map(Number);
  const uptimeSec = parseFloat(uptimeLine.split(' ')[0]);
  const [rx, tx] = netLine.trim().split(/\s+/).map(Number);
  return {
    cpuUsage: Math.min(100, Math.round((load1 / Math.max(1, Number(_cpus) || cpus)) * 100)),
    ramUsage: memTotal > 0 ? Math.round((memUsed / memTotal) * 100) : 0,
    load1,
    uptimeSec,
    rxBytes: rx || 0,
    txBytes: tx || 0,
  };
}

/** Connects to the server over SSH, reads system metrics, returns them (or an error). */
export function testAndCollect(server: ServerCredentials): Promise<StatsResult> {
  return new Promise((resolve) => {
    const client = new Client();
    let settled = false;
    const done = (result: StatsResult) => {
      if (settled) return;
      settled = true;
      try {
        client.end();
      } catch {
        /* ignore */
      }
      resolve(result);
    };

    client.on('ready', () => {
      client.exec(CMD, (err, stream) => {
        if (err) return done({ ok: false, status: 'error', error: err.message });
        let output = '';
        let stderr = '';
        stream.on('data', (chunk: Buffer) => (output += chunk.toString()));
        stream.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
        stream.on('close', (code: number | null) => {
          if (code !== 0) return done({ ok: false, status: 'error', error: stderr || 'exit ' + code });
          try {
            const stats = statsFromOutput(output, 1);
            done({ ok: true, status: 'online', ...stats });
          } catch (e: any) {
            done({ ok: false, status: 'error', error: e.message });
          }
        });
        stream.on('error', (e: Error) => done({ ok: false, status: 'error', error: e.message }));
      });
    });
    client.on('error', (e: Error) => done({ ok: false, status: 'error', error: e.message }));
    client.on('timeout', () => done({ ok: false, status: 'error', error: 'connection timed out' }));

    const config: any = {
      host: server.host,
      port: server.port,
      username: server.username,
      readyTimeout: CONNECT_TIMEOUT,
    };
    if (server.authType === 'key' && server.sshKey) {
      // same normalization as tunnel.ts — some clients are picky about EOL
      config.privateKey = server.sshKey.endsWith('\n') ? server.sshKey : server.sshKey + '\n';
    } else {
      config.password = server.password;
    }
    client.connect(config);
  });
}
