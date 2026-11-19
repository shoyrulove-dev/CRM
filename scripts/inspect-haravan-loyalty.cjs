// Run inside the CRM container; outputs schema/aggregate facts, never credentials or customer identity.
async function main() {
  const { MongoClient } = await import('mongodb');
  const { createHash, createDecipheriv } = await import('node:crypto');
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  try {
    const db = client.db(process.env.MONGODB_DB || 'nichiei_crm');
    const row = await db.collection('settings').findOne({ id: 'integrations' });
    let token = process.env.HARAVAN_ACCESS_TOKEN;
    if (row?.payload) {
      const [iv, tag, body] = row.payload.split('.');
      const decrypt = createDecipheriv('aes-256-gcm',
        createHash('sha256').update(process.env.SESSION_SECRET || 'nichiei-local-settings-key').digest(),
        Buffer.from(iv, 'base64'));
      decrypt.setAuthTag(Buffer.from(tag, 'base64'));
      const config = JSON.parse(Buffer.concat([decrypt.update(Buffer.from(body, 'base64')), decrypt.final()]).toString());
      token = config.haravanAccessToken || token;
    }
    if (!token) throw new Error('SAVED_TOKEN_MISSING');
    const total = await db.collection('customers').countDocuments({ haravanId: { $type: 'string', $regex: /^\d+$/ } });
    const synced = await db.collection('customers').countDocuments({ loyaltySyncedAt: { $exists: true } });
    const positivePoints = await db.collection('customers').countDocuments({ loyaltyPoints: { $gt: 0 } });
    const withTier = await db.collection('customers').countDocuments({ membershipTier: { $type: 'string', $ne: '' }, loyaltySyncedAt: { $exists: true } });
    const samples = await db.collection('customers').find({ haravanId: { $type: 'string', $regex: /^\d+$/ } })
      .sort({ loyaltySyncedAt: -1, revenue: -1 })
      .project({ _id: 0, haravanId: 1, membershipTier: 1, loyaltyPoints: 1, loyaltyExpiresAt: 1, loyaltySyncedAt: 1 }).limit(5).toArray();
    console.log(JSON.stringify({ eligibleCustomers: total, synced, positivePoints, withTier }));
    for (const [index, sample] of samples.entries()) {
      const response = await fetch(`https://apis.haravan.com/com/v2/customers/${sample.haravanId}.json`, {
        headers: { authorization: `Bearer ${token}`, accept: 'application/json' }, signal: AbortSignal.timeout(12_000),
      });
      const body = await response.json();
      const customer = body.customer;
      const membership = customer?.membership;
      console.log(JSON.stringify({ sample: index + 1, httpStatus: response.status,
        topLevelKeys: Object.keys(body), matchingId: String(customer?.id) === sample.haravanId,
        membershipPresent: Boolean(membership), membershipKeys: membership ? Object.keys(membership) : [],
        tierType: typeof membership?.name, pointsType: typeof membership?.reward_point_amount,
        expiryType: typeof membership?.reward_expire_date,
        expiryParseable: membership?.reward_expire_date == null || membership?.reward_expire_date === '' ||
          Number.isFinite(Date.parse(membership.reward_expire_date)),
        savedLoyaltyMatches: sample.loyaltySyncedAt && membership ?
          sample.membershipTier === (membership.name || '') &&
          sample.loyaltyPoints === Number(membership.reward_point_amount) &&
          sample.loyaltyExpiresAt === (membership.reward_expire_date || null) : null,
      }));
    }
  } finally { await client.close(); }
}
main().catch(() => { console.error('V2_INSPECTION_FAILED'); process.exitCode = 1; });
