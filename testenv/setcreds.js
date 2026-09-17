const mongoose = require('mongoose');
(async () => {
  await mongoose.connect('mongodb://127.0.0.1:27099/mui');
  const r = await mongoose.connection.db.collection('configs').updateOne(
    { protocol: 'socks5' },
    { $set: { deployed: true, socksUser: 'u_7f3a91', socksPass: 's3cr3t-proxy-pass-9x' } });
  console.log('  updated docs:', r.modifiedCount);
  await mongoose.disconnect();
})();
