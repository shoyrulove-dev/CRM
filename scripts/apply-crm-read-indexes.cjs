// Additive indexes only. Does not alter application records or remove existing indexes.
async function main() {
  if (!process.argv.includes('--apply')) throw new Error('Pass --apply to add CRM read indexes.');
  const { MongoClient } = await import('mongodb');
  const client = new MongoClient(process.env.MONGODB_URI); await client.connect();
  try {
    const db = client.db(process.env.MONGODB_DB || 'nichiei_crm');
    const definitions = [
      ['customers', { name: 1, id: 1 }], ['customers', { owner: 1, name: 1, id: 1 }],
      ['customers', { lastOrder: 1, id: 1 }], ['customers', { lastOrder: -1, id: 1 }],
      ['care_tasks', { dueAt: 1, id: 1 }], ['care_tasks', { owner: 1, dueAt: 1, id: 1 }],
      ['care_tasks', { customerId: 1, dueAt: -1, id: -1 }], ['service_tickets', { createdAt: -1, id: -1 }],
    ];
    for (const [collection, keys] of definitions) {
      const name = await db.collection(collection).createIndex(keys);
      console.log(JSON.stringify({ collection, index: name }));
    }
    console.log(JSON.stringify({ readIndexesCreatedOrExisting: definitions.length }));
  } finally { await client.close(); }
}
main().catch(() => { console.error('CRM_READ_INDEX_UPDATE_FAILED'); process.exitCode = 1; });
