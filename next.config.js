/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    instrumentationHook: true,
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // ssh2 ships an optional native binding (.node) that webpack cannot
      // parse — keep it as a runtime require on the server side.
      let externals = config.externals;
      if (typeof externals === 'function') externals = [externals];
      if (Array.isArray(externals)) {
        externals.push('ssh2');
        config.externals = externals;
      } else {
        config.externals = { ...(externals || {}), ssh2: 'commonjs ssh2' };
      }
    }
    return config;
  },
};
module.exports = nextConfig;
