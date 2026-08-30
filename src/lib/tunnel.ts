import { spawn, spawnSync, type ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';

export interface TunnelSpec {
  host: string;
  port: number;
  username: string;
  authType: 'password' | 'key';
  password: string;
  sshKey: string;
  localPort: number;
  remotePort: number;
}

interface Running {
  proc: ChildProcess;
  keyFile?: string;
  stderr: string;
}

/** Last exit info per tunnel id (kept briefly so the UI can show why it died). */
const recentExits = new Map<string, { code: number | null; signal: NodeJS.Signals | null; stderr: string; at: number }>();

// process registry: tunnel id -> running process (in-memory, per instance)
const registry = new Map<string, Running>();

export function lastExit(id: string) {
  return recentExits.get(id) || null;
}

function hasSshpass(): boolean {
  try {
    return spawnSync('sshpass', ['-V'], { stdio: 'ignore' }).status === 0;
  } catch {
    return false;
  }
}

/**
 * Starts an SSH reverse tunnel: `ssh -N -R remotePort:127.0.0.1:localPort user@host`.
 * Uses the OpenSSH client (key auth natively, password via sshpass). The process is
 * tracked in-memory; on server restart the tunnel does NOT auto-resume — restart it
 * from the UI. Returns the child pid.
 */
export async function startTunnel(id: string, spec: TunnelSpec): Promise<number> {
  if (registry.has(id)) throw new Error('tunnel already running');

  const args = [
    '-N',
    '-o', 'ExitOnForwardFailure=yes',
    '-o', 'ServerAliveInterval=30',
    '-o', 'ServerAliveCountMax=3',
    '-o', 'StrictHostKeyChecking=accept-new',
    '-o', 'LogLevel=ERROR',
    '-R', `${spec.remotePort}:127.0.0.1:${spec.localPort}`,
    '-p', String(spec.port),
  ];

  let sshpassNeeded = false;
  let keyFile: string | undefined;
  if (spec.authType === 'key' && spec.sshKey) {
    // OpenSSH refuses keys that don't end with a newline ("error in libcrypto"),
    // and textareas strip a trailing newline — normalize at use time.
    const key = spec.sshKey.endsWith('\n') ? spec.sshKey : spec.sshKey + '\n';
    keyFile = path.join(os.tmpdir(), `m-ui-${crypto.randomUUID()}-key`);
    await fs.writeFile(keyFile, key, { mode: 0o600 });
    args.push('-i', keyFile);
  } else {
    sshpassNeeded = true;
  }

  const target = `${spec.username}@${spec.host}`;
  let proc: ChildProcess;
  if (sshpassNeeded) {
    const ok = hasSshpass();
    if (!ok) {
      if (keyFile) await fs.unlink(keyFile).catch(() => {});
      throw new Error('password-based tunnels need sshpass installed, or switch the server to key auth');
    }
    proc = spawn('sshpass', ['-p', spec.password, 'ssh', ...args, target]);
  } else {
    proc = spawn('ssh', [...args, target]);
  }

  const running: Running = { proc, keyFile, stderr: '' };
  proc.stderr?.on('data', (chunk: Buffer) => {
    if (running.stderr.length < 4096) running.stderr += chunk.toString();
  });
  registry.set(id, running);

  proc.on('exit', (code, signal) => {
    recentExits.set(id, { code, signal, stderr: running.stderr, at: Date.now() });
    registry.delete(id);
    void fs.unlink(keyFile as string).catch(() => {});
  });
  return proc.pid as number;
}

export function stopTunnel(id: string): boolean {
  const running = registry.get(id);
  if (!running) return false;
  running.proc.kill('SIGTERM');
  return true;
}

export function tunnelRunning(id: string): boolean {
  return registry.has(id);
}
