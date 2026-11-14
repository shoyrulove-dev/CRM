
// Run without --apply to preview. These are known test records, not guesses at
// customers' names. Original fields are retained as base64 for reversal.
const replacements = new Map([
  ['Admin ki?m th?', 'Admin kiểm thử'],
  ['Ki?m th? quy tr\uFFFDnh 14-11', 'Kiểm thử quy trình 14-11'],
  ['Phi?u t? d?ng, s? x\uFFFDa sau ki?m th?', 'Phiếu tự động, sẽ xóa sau kiểm thử'],
  ['V\uFFFDn Anh', 'Vân Anh'],
  ['D\uFFFD ki?m tra nh?t k\uFFFD c?p nh?t', 'Đã kiểm tra nhật ký cập nhật'],
  ['D\uFFFD d\uFFFDng', 'Đã đóng'],
  ['Kh\uFFFDng du?c ghi', 'Không được ghi'],
]);
const targetAuditIds = new Set([
  '6af863b81a345569131a1717', '6af863b81a345569131a1718',
  '6af863b81a345569131a1719', '6af863b91a345569131a171a',
]);

async function main() {
  const { MongoClient } = await import('mongodb');
  const apply = process.argv.includes('--apply');
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  try {
    const db = client.db(process.env.MONGODB_DB || 'nichiei_crm');
    let documents = 0, fields = 0;
    for (const collection of ['login_events', 'audit_logs']) {
      for await (const document of db.collection(collection).find({})) {
        if (collection === 'login_events' && !(String(document.email).startsWith('test-admin-') && document.userName === 'Admin ki?m th?')) continue;
        if (collection === 'audit_logs' && !targetAuditIds.has(String(document._id))) continue;
        const changes = {}, originals = {};
        function visit(value, path = '') {
          if (typeof value === 'string' && replacements.has(value)) {
            changes[path] = replacements.get(value);
            originals[path] = Buffer.from(value, 'utf8').toString('base64');
          } else if (Array.isArray(value)) value.forEach((item, i) => visit(item, `${path}.${i}`));
          else if (value && typeof value === 'object' && !(value instanceof Date))
            for (const [key, item] of Object.entries(value))
              if (key !== '_id') visit(item, path ? `${path}.${key}` : key);
        }
        visit(document);
        if (!Object.keys(changes).length) continue;
        documents++; fields += Object.keys(changes).length;
        if (apply) {
          await db.collection('text_repair_history').insertOne({
            migration: 'check1411-encoding', collection, documentId: document._id,
            originalsBase64: originals, correctedFields: Object.keys(changes), createdAt: new Date(),
          });
          await db.collection(collection).updateOne({ _id: document._id }, { $set: { ...changes, textRepairedAt: new Date().toISOString() } });
        }
      }
    }
    let legacyDates = 0;
    const legacyTimes = new Map([
      ['CS-381', { days: -1, time: '09:00' }],
      ['CS-382', { days: 0, time: '10:30' }],
      ['CS-383', { days: 0, time: '14:00' }],
    ]);
    for await (const task of db.collection('care_tasks').find({ id: { $in: [...legacyTimes.keys()] } })) {
      if (Number.isFinite(Date.parse(task.dueAt))) continue;
      const rule = legacyTimes.get(task.id);
      // The seed used relative labels; anchor them to the original insertion
      // day rather than moving old demo tasks to today's date on every repair.
      const inserted = task._id.getTimestamp();
      const localDay = new Date(inserted.getTime() + 7 * 3600000 + rule.days * 86400000).toISOString().slice(0, 10);
      const dueAt = new Date(`${localDay}T${rule.time}:00+07:00`).toISOString();
      legacyDates++;
      if (apply) {
        await db.collection('text_repair_history').insertOne({
          migration: 'check1411-legacy-date', collection: 'care_tasks', documentId: task._id,
          originalsBase64: { dueAt: Buffer.from(task.dueAt).toString('base64') }, createdAt: new Date(),
        });
        await db.collection('care_tasks').updateOne({ _id: task._id }, { $set: {
          dueAt, ...(task.status !== 'done' ? { status: Date.parse(dueAt) < Date.now() ? 'overdue' : 'due' } : {}),
          dateRepairedAt: new Date().toISOString(),
        } });
      }
    }
    let localDateTimes = 0;
    for await (const task of db.collection('care_tasks').find({ dueAt: { $regex: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}$' } })) {
      const dueAt = new Date(`${task.dueAt}:00+07:00`).toISOString();
      localDateTimes++;
      if (apply) {
        await db.collection('text_repair_history').insertOne({
          migration: 'check1411-vietnam-timezone', collection: 'care_tasks', documentId: task._id,
          originalsBase64: { dueAt: Buffer.from(task.dueAt).toString('base64') }, createdAt: new Date(),
        });
        await db.collection('care_tasks').updateOne({ _id: task._id }, { $set: {
          dueAt, ...(task.status !== 'done' ? { status: Date.parse(dueAt) < Date.now() ? 'overdue' : 'due' } : {}),
          dateRepairedAt: new Date().toISOString(),
        } });
      }
    }
    console.log(JSON.stringify({ apply, documents, fields, legacyDates, localDateTimes }));
  } finally { await client.close(); }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
