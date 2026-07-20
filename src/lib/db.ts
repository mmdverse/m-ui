import mongoose from 'mongoose';

const URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mui';

const ServerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  host: { type: String, required: true },
  port: { type: Number, default: 22 },
  username: { type: String, default: 'root' },
  authType: { type: String, enum: ['password', 'key'], default: 'key' },
  password: { type: String },
  location: { type: String, default: 'ایران' },
  status: { type: String, enum: ['online', 'offline', 'error'], default: 'offline' },
  isTunnel: { type: Boolean, default: false },
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
  isActive: { type: Boolean, default: true },
  trafficUp: { type: Number, default: 0 },
  trafficDown: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'user', 'reseller'], default: 'user' },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

const TunnelSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ['direct', 'reverse', 'frp', 'ssh', 'wireguard'], required: true },
  localServer: { type: mongoose.Schema.Types.ObjectId, ref: 'Server', required: true },
  remoteServer: { type: mongoose.Schema.Types.ObjectId, ref: 'Server', required: true },
  localPort: { type: Number },
  remotePort: { type: Number },
  status: { type: String, enum: ['active', 'inactive', 'error'], default: 'inactive' },
  createdAt: { type: Date, default: Date.now },
});

const Server = mongoose.models.Server || mongoose.model('Server', ServerSchema);
const Config = mongoose.models.Config || mongoose.model('Config', ConfigSchema);
const User = mongoose.models.User || mongoose.model('User', UserSchema);
const Tunnel = mongoose.models.Tunnel || mongoose.model('Tunnel', TunnelSchema);

export { Server, Config, User, Tunnel };

// Cached MongoDB connection
let cached = (global as any).__mongo;
if (!cached) cached = (global as any).__mongo = { conn: null, promise: null };

export async function connectDB() {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(URI).then(m => {
      console.log('MongoDB connected');
      return m;
    }).catch(err => {
      console.error('MongoDB connection error:', err.message);
      cached.promise = null;
      throw err;
    });
  }
  cached.conn = await cached.promise;
  return cached.conn;
}
