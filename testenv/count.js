const mongoose = require('mongoose');
(async () => {
  await mongoose.connect('mongodb://127.0.0.1:27099/mui');
  const db = mongoose.connection.db;
  for (const c of ['usage_samples','servers','configs','tunnels','users','activities']) {
    const n = await db.collection(c).countDocuments().catch(() => 'n/a');
    console.log(`  ${c}: ${n}`);
  }
  await mongoose.disconnect();
})();
