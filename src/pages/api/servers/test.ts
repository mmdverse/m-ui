import { connectDB } from '@/lib/db';
import db from '@/lib/db';

export default async function handler(req: any, res: any) {
  await connectDB();
  const { id } = req.query;
  const server = await db.Server.findById(id);
  if (!server) return res.status(404).json({ error: 'Server not found' });

  // Simulate connection test
  const isOnline = Math.random() > 0.3;
  if (isOnline) {
    server.status = 'online';
    server.cpuUsage = Math.floor(Math.random() * 60 + 10);
    server.ramUsage = Math.floor(Math.random() * 50 + 20);
    server.uptime = Math.floor(Math.random() * 86400 * 7);
    server.lastPing = new Date();
  } else {
    server.status = 'error';
  }
  await server.save();

  res.json({ status: server.status, cpu: server.cpuUsage, ram: server.ramUsage, uptime: server.uptime });
}
