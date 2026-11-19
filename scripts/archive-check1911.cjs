/* eslint-disable @typescript-eslint/no-require-imports -- VPS maintenance command. */
// Explicit allowlists only. Archived documents retain their original _id for recovery.
const { MongoClient } = require('mongodb');
const { randomUUID } = require('node:crypto');
async function main() {
  const client = await new MongoClient(process.env.MONGODB_URI).connect();
  try {
    const db = client.db(process.env.MONGODB_DB || 'nichiei_crm');
    const commit = process.argv.includes('--commit');
    const maintenanceOwner = 'check1911-' + randomUUID();
    const plans = [
      ['care_tasks', { createdAt: { $lt: '2026-11-19T07:50:00.000Z' } }],
      ['service_tickets', { id: { $in: ['YC-1038', 'YC-1037', 'YC-1036', 'YC-096688', 'YC-662802'] } }],
      ['care_activities', { id: { $in: ['NK-501', 'NK-488', 'NK-455'] } }],
    ];
    if (commit) {
      try { await db.collection('job_locks').findOneAndUpdate({ _id: 'care-scheduler', $or: [{ expiresAt: { $lte: new Date() } }, { expiresAt: { $exists: false } }] },
        { $set: { expiresAt: new Date(Date.now() + 240000), maintenance: maintenanceOwner } }, { upsert: true }); }
      catch { throw new Error('Scheduler is running; wait until it finishes.'); }
      await db.collection('settings').updateOne({ id: 'care_automation' }, { $set: { orders: false, birthdays: false, holidays: false, activeFrom: '2026-11-19T08:00:00.000Z', orderRules: [], resetAt: new Date().toISOString() } }, { upsert: true });
    }
    for (const [name, filter] of plans) {
      // Old seed schedules did not have createdAt. Only their known IDs are included.
      const effective = name === 'care_tasks' ? { $or: [filter, { id: { $in: ['CS-381','CS-382','CS-383','CS-379'] } }] } : filter;
      const docs = await db.collection(name).find(effective).toArray();
      if (docs.length > (name === 'care_tasks' ? 30000 : name === 'service_tickets' ? 5 : 3)) throw new Error('Unexpected reset scope');
      const archiveName = name + '_archive_check1911';
      if (!commit) { console.log(JSON.stringify({ collection: name, candidates: docs.length, total: await db.collection(name).countDocuments({}) })); continue; }
      for (let offset = 0; offset < docs.length; offset += 200) {
        const batch = docs.slice(offset, offset + 200);
        await db.collection(archiveName).bulkWrite(batch.map(doc => ({ replaceOne: { filter: { _id: doc._id }, replacement: doc, upsert: true } })));
        const count = await db.collection(archiveName).countDocuments({ _id: { $in: batch.map(doc => doc._id) } });
        if (count !== batch.length) throw new Error('Archive verification failed; originals retained');
        await db.collection(name).deleteMany({ _id: { $in: batch.map(doc => doc._id) } });
      }
      console.log(JSON.stringify({ collection: name, archived: docs.length, archive: archiveName, remaining: await db.collection(name).countDocuments({}) }));
    }
  } finally {
    // The short maintenance lease expires automatically; never release another worker's lock.
    await client.close();
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
