// Authenticated read-only timings. Session secrets and customer payloads never leave this process.
async function main() {
  const { MongoClient } = await import('mongodb');
  const { createHmac } = await import('node:crypto');
  const client = new MongoClient(process.env.MONGODB_URI); await client.connect();
  try {
    const db = client.db(process.env.MONGODB_DB || 'nichiei_crm');
    for (const role of ['super_admin', 'sales']) {
      const user = await db.collection('users').findOne({ active: true, role });
      if (!user) continue;
      const header = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url');
      const iat = Math.floor(Date.now() / 1000);
      const payload = Buffer.from(JSON.stringify({ id: user.id, sub: user.id, name: user.name,
        email: user.email, role, sessionVersion: user.sessionVersion || 0, iat, exp: iat + 600 })).toString('base64url');
      const signature = createHmac('sha256', process.env.SESSION_SECRET).update(header + '.' + payload).digest('base64url');
      const cookie = 'nichiei_session=' + header + '.' + payload + '.' + signature;
      for (const path of ['/', '/customers', '/care', '/tickets', '/reports', '/help', '/api/notifications', '/api/form-options?kind=care']) {
        const times = []; let bytes = 0, status = 0;
        for (let run = 0; run < 4; run++) {
          const started = performance.now();
          const response = await fetch('http://127.0.0.1:3000' + path, { headers: { cookie }, redirect: 'manual', signal: AbortSignal.timeout(30_000) });
          bytes = (await response.arrayBuffer()).byteLength; status = response.status;
          times.push(Math.round((performance.now() - started) * 10) / 10);
        }
        const warm = times.slice(1).sort((a, b) => a - b);
        console.log(JSON.stringify({ label: process.env.BENCH_LABEL || 'baseline', role, path, status, bytes, firstMs: times[0], warmMedianMs: warm[1], maxMs: Math.max(...times) }));
      }
    }
    for (const name of ['customers', 'care_tasks', 'care_activities', 'orders', 'service_tickets']) {
      console.log(JSON.stringify({ collection: name, documents: await db.collection(name).countDocuments({}) }));
    }
    for (const [name, filter, sort] of [
      ['customers', {}, { name: 1, id: 1 }],
      ['care_tasks', { status: { $ne: 'done' }, dueAt: { $lte: new Date(Date.now() + 86400_000).toISOString() } }, { dueAt: 1 }],
      ['service_tickets', {}, { createdAt: -1, id: -1 }],
    ]) {
      const plan = await db.collection(name).find(filter).sort(sort).limit(20).explain('executionStats');
      console.log(JSON.stringify({ explain: name, returned: plan.executionStats.nReturned,
        examined: plan.executionStats.totalDocsExamined, keys: plan.executionStats.totalKeysExamined,
        executionMs: plan.executionStats.executionTimeMillis,
        blockingSort: JSON.stringify(plan.queryPlanner.winningPlan).includes('"SORT"') }));
    }
  } finally { await client.close(); }
}
main().catch(() => { console.error('CRM_BENCHMARK_FAILED'); process.exitCode = 1; });
