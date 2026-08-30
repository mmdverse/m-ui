import mongoose from 'mongoose';

const URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mui';

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

const ServerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  host: { type: String, required: true },
  port: { type: Number, default: 22 },
  username: { type: String, default: 'root' },
  authType: { type: String, enum: ['password', 'key'], default: 'password' },
  password: { type: String, default: '' },
  sshKey: { type: String, default: '' }, // PEM private key (authType = 'key')
  location: { type: String, default: 'ایران' },
  geoSource: { type: String, enum: ['auto', 'manual', 'none'], default: 'none' },
  status: { type: String, enum: ['online', 'offline', 'error', 'unknown'], default: 'unknown' },
  isTunnel: { type: Boolean, default: false },
  cpuUsage: { type: Number, default: 0 },
  ramUsage: { type: Number, default: 0 },
  load1: { type: Number, default: 0 },
  uptimeSec: { type: Number, default: 0 },
  rxBytes: { type: Number, default: 0 },
  txBytes: { type: Number, default: 0 },
  lastPing: { type: Date },
  lastError: { type: String },
  createdAt: { type: Date, default: Date.now },
});

const ConfigSchema = new mongoose.Schema({
  name: { type: String, required: true },
  serverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Server', required: true },
  protocol: {
    type: String,
    enum: ['vmess', 'vless', 'trojan', 'shadowsocks', 'socks5', 'wireguard'],
    required: true,
  },
  uuid: { type: String, required: true }, // persistent per config
  port: { type: Number, required: true },
  transport: { type: String, enum: ['tcp', 'kcp', 'ws', 'http', 'quic', 'grpc'], default: 'tcp' },
  security: { type: String, enum: ['none', 'tls', 'reality'], default: 'none' },
  domain: { type: String },
  path: { type: String },
  sni: { type: String },
  password: { type: String, default: '' }, // used by trojan/ss protocols
  pbk: { type: String, default: '' }, // REALITY public key
  fp: { type: String, default: 'chrome' }, // REALITY fingerprint
  sid: { type: String, default: '' }, // REALITY shortId
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['admin', 'user', 'reseller'], default: 'user' },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

const TunnelSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ['ssh', 'direct', 'frp', 'wireguard'], required: true },
  localServer: { type: mongoose.Schema.Types.ObjectId, ref: 'Server', required: true },
  remoteServer: { type: mongoose.Schema.Types.ObjectId, ref: 'Server', required: true },
  localPort: { type: Number },
  remotePort: { type: Number },
  status: { type: String, enum: ['active', 'inactive', 'error'], default: 'inactive' },
  pid: { type: Number },
  lastError: { type: String },
  createdAt: { type: Date, default: Date.now },
});

// One row per monitoring sample (used by the dashboard history).
const UsageSampleSchema = new mongoose.Schema(
  {
    serverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Server', required: true },
    ts: { type: Date, default: Date.now },
    cpuUsage: Number,
    ramUsage: Number,
    load1: Number,
    uptimeSec: Number,
    rxBytes: Number, // cumulative counters from /proc/net/dev (for delta math)
    txBytes: Number,
    rxDelta: Number, // bytes since the previous sample
    txDelta: Number,
  },
  { collection: 'usage_samples' }
);
UsageSampleSchema.index({ serverId: 1, ts: -1 });

const ActivitySchema = new mongoose.Schema({
  ts: { type: Date, default: Date.now },
  actor: { type: String, default: 'system' },
  event: { type: String, required: true },
  type: { type: String, enum: ['info', 'success', 'error'], default: 'info' },
});
ActivitySchema.index({ ts: -1 });

export const Server: mongoose.Model<any> =
  (mongoose.models.Server as mongoose.Model<any>) || mongoose.model('Server', ServerSchema);
export const Config: mongoose.Model<any> =
  (mongoose.models.Config as mongoose.Model<any>) || mongoose.model('Config', ConfigSchema);
export const User: mongoose.Model<any> =
  (mongoose.models.User as mongoose.Model<any>) || mongoose.model('User', UserSchema);
export const Tunnel: mongoose.Model<any> =
  (mongoose.models.Tunnel as mongoose.Model<any>) || mongoose.model('Tunnel', TunnelSchema);
export const UsageSample: mongoose.Model<any> =
  (mongoose.models.UsageSample as mongoose.Model<any>) ||
  mongoose.model('UsageSample', UsageSampleSchema);
export const Activity: mongoose.Model<any> =
  (mongoose.models.Activity as mongoose.Model<any>) || mongoose.model('Activity', ActivitySchema);

// ---------------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------------

let cached: typeof mongoose | null = null;

export async function connectDB() {
  if (cached && cached.connection.readyState === 1) return cached;
  cached = await mongoose.connect(URI, { serverSelectionTimeoutMS: 5000 });
  return cached;
}
