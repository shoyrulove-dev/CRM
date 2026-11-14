
// Read-only audit. Output only text fields; never print integration credentials.
const suspicious = /\uFFFD|[\u00C3\u00C4\u00C6][\u0080-\u00BF]|\u00E1[\u00BA\u00BB]|\u00E2[\u0080\u20AC]|\u00EF\u00BF\u00BD/;
const lostLetter = /[\p{L}\p{M}]\?[\p{L}\p{M}]|[\p{L}\p{M}]\?(?:\s|$)/u;
const privateField = /password|secret|token|key|signature|uri|url|endpoint|hash/i;

async function main() {
  const { MongoClient } = await import('mongodb');
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  try {
    const db = client.db(process.env.MONGODB_DB || 'nichiei_crm');
    const summary = [];
    for (const { name } of await db.listCollections({}, { nameOnly: true }).toArray()) {
      let documents = 0, badDocuments = 0, badFields = 0;
      const samples = [];
      for await (const document of db.collection(name).find({})) {
        documents++;
        const found = [];
        function visit(value, path = '') {
          if (typeof value === 'string') {
            if (suspicious.test(value) || (lostLetter.test(value) && !/https?:|\/[\w-]+\?/.test(value)))
              found.push({ field: path, text: value.slice(0, 250) });
          } else if (Array.isArray(value)) value.forEach((item, i) => visit(item, `${path}.${i}`));
          else if (value && typeof value === 'object' && !(value instanceof Date))
            for (const [key, item] of Object.entries(value))
              if (key !== '_id' && !privateField.test(key)) visit(item, path ? `${path}.${key}` : key);
        }
        visit(document);
        if (found.length) {
          badDocuments++; badFields += found.length;
          if (samples.length < 30) samples.push({ id: document.id || String(document._id), fields: found });
        }
      }
      summary.push({ collection: name, documents, badDocuments, badFields, samples });
    }
    console.log(JSON.stringify(summary, null, 2));
  } finally { await client.close(); }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
