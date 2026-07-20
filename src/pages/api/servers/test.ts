import { connectDB } from '@/lib/db';
import { Server } from '@/lib/db';

export default async function handler(req: any, res: any) {
  try {
    await connectDB();
    const { id } = req.query;
    const server = await Server.findById(id);
    if (!server) return res.status(404).json({ error: 'Server not found' });
    const isOnline = Math.random() > 0.3;
    server.status = isOnline ? 'online' : 'error';
    server.cpuUsage = Math.floor(Math.random() * 60 + 10);
    server.ramUsage = Math.floor(Math.random() * 50 + 20);
    server.lastPing = new Date();
    await server.save();
    res.json({ status: server.status, cpu: server.cpuUsage, ram: server.ramUsage });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
