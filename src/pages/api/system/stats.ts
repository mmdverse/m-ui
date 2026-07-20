import type { NextApiRequest, NextApiResponse } from 'next';
import { connectDB } from '@/lib/db';
import db from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await connectDB();
  const [servers, configs, tunnels, users] = await Promise.all([
    db.Server.find().lean(),
    db.Config.find().lean(),
    db.Tunnel.find().lean(),
    db.User.find().lean(),
  ]);

  const onlineServers = servers.filter(s => s.status === 'online').length;
  const activeConfigs = configs.filter(c => c.isActive).length;
  const monthlyTraffic = servers.reduce((sum, s: any) => sum + (s.monthlyTraffic || 0), 0);

  const trafficHistory = Array.from({ length: 7 }, (_, i) => ({
    day: `Day ${i + 1}`,
    down: Math.floor(Math.random() * 100 + 20),
  }));

  const serverStatus: Record<string, string> = {};
  servers.forEach((s: any) => { serverStatus[s.name] = s.status; });

  res.json({ servers: servers.length, onlineServers, activeConfigs, tunnels: tunnels.length, users: users.length, monthlyTraffic, trafficHistory, serverStatus });
}
