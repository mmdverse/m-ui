const { MongoMemoryServer } = require('mongodb-memory-server');
(async () => {
  const m = await MongoMemoryServer.create({ instance: { port: 27099, dbName: 'mui' } });
  console.log('MONGO_READY ' + m.getUri());
  const stop = async () => { await m.stop(); process.exit(0); };
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
  setInterval(() => {}, 1 << 30);
})().catch((e) => { console.error('MONGO_FAIL', e.message); process.exit(1); });
