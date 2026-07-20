import mongoose from 'mongoose';

const ServerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  host: { type: String, required: true },
  port: { type: Number, default: 22 },
  username: { type: String, default: 'root' },
  authType: { type: String, enum: ['password', 'key'], default: 'key' },
  privateKey: { type: String },
  password: { type: String },
  location: { type: String, default: 'ایران' },
  provider: { type: String, default: '' },
  status: { type: String, enum: ['online', 'offline', 'error'], default: 'offline' },
  isTunnel: { type: Boolean, default: false },
  tunnelTarget: { type: String },
  cpuUsage: { type: Number, default: 0 },
  ramUsage: { type: Number, default: 0 },
  totalTraffic: { type: Number, default: 0 },
  monthlyTraffic: { type: Number, default: 0 },
  uptime: { type: Number, default: 0 },
  lastPing: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

const ConfigSchema = new mongoose.Schema({
  name: { type: String, required: true },
  serverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Server', required: true },
  protocol: { type: String, enum: ['vmess', 'vless', 'trojan', 'shadowsocks', 'socks5', 'wireguard'], required: true },
  port: { type: Number, required: true },
  transport: { type: String, enum: ['tcp', 'kcp', 'ws', 'http', 'quic', 'grpc'], default: 'tcp' },
  security: { type: String, enum: ['none', 'tls', 'reality'], default: 'none' },
  domain: { type: String },
  path: { type: String },
  sni: { type: String },
  realityConfig: { type: mongoose.Schema.Types.Mixed },
  isActive: { type: Boolean, default: true },
  inboundTag: { type: String },
  remark: { type: String },
  trafficUp: { type: Number, default: 0 },
  trafficDown: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'user', 'reseller'], default: 'user' },
  trafficLimit: { type: Number, default: 0 },
  trafficUsed: { type: Number, default: 0 },
  expiryDate: { type: Date },
  isActive: { type: Boolean, default: true },
  createdServers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Server' }],
  createdAt: { type: Date, default: Date.now },
});

const TunnelSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ['direct', 'reverse', 'frp', 'ssh', 'wireguard'], required: true },
  localServer: { type: mongoose.Schema.Types.ObjectId, ref: 'Server', required: true },
  remoteServer: { type: mongoose.Schema.Types.ObjectId, ref: 'Server', required: true },
  localPort: { type: Number },
  remotePort: { type: Number },
  protocol: { type: String, default: 'tcp' },
  status: { type: String, enum: ['active', 'inactive', 'error'], default: 'inactive' },
  traffic: { type: Number, default: 0 },
  latency: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

const TrafficLogSchema = new mongoose.Schema({
  serverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Server' },
  configId: { type: mongoose.Schema.Types.ObjectId, ref: 'Config' },
  up: { type: Number, default: 0 },
  down: { type: Number, default: 0 },
  timestamp: { type: Date, default: Date.now, index: { expireAfterSeconds: 2592000 } },
});

let cached = (global as any).__mongo;
if (!cached) cached = (global as any).__mongo = { conn: null, promise: null };

const models = {
  Server: mongoose.models.Server || mongoose.model('Server', ServerSchema),
  Config: mongoose.models.Config || mongoose.model('Config', ConfigSchema),
  User: mongoose.models.User || mongoose.model('User', UserSchema),
  Tunnel: mongoose.models.Tunnel || mongoose.model('Tunnel', TunnelSchema),
  TrafficLog: mongoose.models.TrafficLog || mongoose.model('TrafficLog', TrafficLogSchema),
};

export async function connectDB() {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    const { config } = await import('./config');
    cached.promise = mongoose.connect(config.mongodb).then(m => m);
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

export default models;
