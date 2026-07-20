export const config = {
  mongodb: process.env.MONGODB_URI || 'mongodb://localhost:27017/mui',
  jwt: { secret: process.env.JWT_SECRET || 'mui-secret-key', expiresIn: '7d' },
  server: { port: parseInt(process.env.PORT || '3000'), url: process.env.SITE_URL || 'http://localhost:3000' },
  panel: {
    name: 'M-UI',
    version: '1.0.0',
    support: '@llllxyz',
    defaultAdmin: { username: 'admin', password: 'admin123' },
  },
  tunnels: {
    protocols: ['vmess', 'vless', 'trojan', 'shadowsocks', 'socks5', 'wireguard'],
    transports: ['tcp', 'kcp', 'ws', 'http', 'quic', 'grpc'],
    securities: ['none', 'tls', 'reality'],
  },
  monitoring: { retention: 30, checkInterval: 10 },
};

export type Protocol = 'vmess' | 'vless' | 'trojan' | 'shadowsocks' | 'socks5' | 'wireguard';
export type Transport = 'tcp' | 'kcp' | 'ws' | 'http' | 'quic' | 'grpc';
export type Security = 'none' | 'tls' | 'reality';
