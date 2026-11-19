// Read-only coverage report and focused diagnostic for records without Loyalty.
async function main() {
  const { MongoClient } = await import('mongodb');
  const { createHash, createDecipheriv } = await import('node:crypto');
  const client = new MongoClient(process.env.MONGODB_URI); await client.connect();
  try {
    const db = client.db(process.env.MONGODB_DB || 'nichiei_crm');
    const customers = db.collection('customers');
    const eligible = { haravanId: { $type: 'string', $regex: /^\d+$/ } };
    const total = await customers.countDocuments(eligible);
    const synced = await customers.countDocuments({ ...eligible, loyaltySyncedAt: { $exists: true } });
    const missing = await customers.find({ ...eligible, loyaltySyncedAt: { $exists: false } })
      .project({ _id: 0, id: 1, haravanId: 1, loyaltySyncError: 1, loyaltyNextSyncAt: 1 }).toArray();
    const tiers = await customers.aggregate([{ $match: { ...eligible, loyaltySyncedAt: { $exists: true } } },
      { $group: { _id: '$membershipTier', count: { $sum: 1 } } }]).toArray();
    console.log(JSON.stringify({ total, synced, missing: missing.length,
      positivePoints: await customers.countDocuments({ ...eligible, loyaltyPoints: { $gt: 0 } }),
      zeroPoints: await customers.countDocuments({ ...eligible, loyaltyPoints: 0 }),
      tiers: tiers.map(row => ({ tier: row._id || '(Chưa có hạng)', count: row.count })),
      job: await db.collection('settings').findOne({ id: 'haravan_loyalty_v2' }, { projection: { _id: 0 } }) }));
    if (!missing.length) return;
    const configRow = await db.collection('settings').findOne({ id: 'integrations' });
    let token = process.env.HARAVAN_ACCESS_TOKEN;
    if (configRow?.payload) {
      const [iv, tag, body] = configRow.payload.split('.');
      const decrypt = createDecipheriv('aes-256-gcm', createHash('sha256').update(process.env.SESSION_SECRET || 'nichiei-local-settings-key').digest(), Buffer.from(iv, 'base64'));
      decrypt.setAuthTag(Buffer.from(tag, 'base64'));
      token = JSON.parse(Buffer.concat([decrypt.update(Buffer.from(body, 'base64')), decrypt.final()]).toString()).haravanAccessToken || token;
    }
    if (!token) throw new Error('SAVED_TOKEN_MISSING');
    for (const [index, row] of missing.slice(0, 10).entries()) {
      const statuses = {};
      for (const [version, path] of [['v2', `v2/customers/${row.haravanId}.json`], ['v1', `customers/${row.haravanId}.json`]]) {
        const response = await fetch(`https://apis.haravan.com/com/${path}`, {
          headers: { authorization: `Bearer ${token}`, accept: 'application/json' }, signal: AbortSignal.timeout(12_000),
        });
        const body = await response.json().catch(() => ({}));
        statuses[version] = { status: response.status,
          error: response.ok ? null : JSON.stringify(body.errors || body.error || {}).replace(/\d+/g, '[number]').slice(0, 300) };
      }
      console.log(JSON.stringify({ exception: index + 1, customerId: row.id, storedError: row.loyaltySyncError,
        retryAt: row.loyaltyNextSyncAt, ...statuses }));
    }
  } finally { await client.close(); }
}
main().catch(() => { console.error('LOYALTY_REPORT_FAILED'); process.exitCode = 1; });
