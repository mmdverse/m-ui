import { describe, expect, it } from 'vitest';
import { statsFromOutput } from '@/lib/ssh';

// Shape of the exact command in lib/ssh.ts:
// loadavg | free -m | uptime | nproc | rx/tx from /proc/net/dev
const sample = ['0.42 0.35 0.10 1/298 2862', '3941 1483', '322.98 1292.11', '2', '375439097 1784316'].join('\n');

describe('statsFromOutput (the monitor’s parser)', () => {
  it('computes cpu as load/nproc, capped at 100', () => {
    expect(statsFromOutput(sample, 1).cpuUsage).toBe(21);      // 0.42 / 2
    expect(statsFromOutput(sample, 1).ramUsage).toBe(38);      // 1483/3941
    expect(statsFromOutput(sample, 1).load1).toBe(0.42);
    expect(statsFromOutput(sample, 1).uptimeSec).toBe(322.98);
    expect(statsFromOutput(sample, 1)).toMatchObject({ rxBytes: 375439097, txBytes: 1784316 });
  });

  it('caps a runaway load average at 100%', () => {
    const hot = ['99.0 90.0 80.0 1/2 3', '1000 900', '10.0 20.0', '1', '1 1'].join('\n');
    expect(statsFromOutput(hot, 1).cpuUsage).toBe(100);
  });

  it('ignores a missing nproc value and uses the caller’s fallback', () => {
    const noCpus = ['0.50 0.10 0.10 1/2 3', '1000 500', '10.0 20.0', '', '1 1'].join('\n');
    expect(statsFromOutput(noCpus, 4).cpuUsage).toBe(13); // 0.5/4
  });

  it('throws on truncated output instead of inventing values', () => {
    expect(() => statsFromOutput('0.1 0.1', 1)).toThrow(/unexpected SSH output/);
  });
});
