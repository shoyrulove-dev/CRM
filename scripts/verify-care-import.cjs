// Production smoke check: preview only, never confirm/import customer history.
async function main() {
  const { MongoClient } = await import('mongodb');
  const { createHmac } = await import('node:crypto');
  const client = new MongoClient(process.env.MONGODB_URI); await client.connect();
  let batchId;
  try {
    const db = client.db(process.env.MONGODB_DB || 'nichiei_crm');
    const admin = await db.collection('users').findOne({ active: true, role: { $in: ['super_admin', 'admin'] } });
    const sale = await db.collection('users').findOne({ active: true, role: 'sales' });
    if (!admin || !sale) throw new Error('TEST_ROLES_MISSING');
    const cookie = user => {
      const iat = Math.floor(Date.now() / 1000);
      const header = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify({ id: user.id, sub: user.id,
        name: user.name, email: user.email, role: user.role,
        sessionVersion: user.sessionVersion || 0, iat, exp: iat + 120,
      })).toString('base64url');
      const signature = createHmac('sha256', process.env.SESSION_SECRET).update(header + '.' + payload).digest('base64url');
      return 'nichiei_session=' + header + '.' + payload + '.' + signature;
    };
    const base = 'http://127.0.0.1:3000';
    const adminCookie = await cookie(admin), saleCookie = await cookie(sale);
    const before = await db.collection('care_activities').countDocuments({ source: 'excel-import' });
    const assert = (value, message) => { if (!value) throw new Error(message); };
    for (const method of ['GET', 'POST', 'PUT']) {
      const response = await fetch(base + '/api/activities/import', { method, headers: { cookie: saleCookie } });
      assert(response.status === 403, 'SALES_IMPORT_NOT_BLOCKED');
    }
    const template = await fetch(base + '/api/activities/import', { headers: { cookie: adminCookie } });
    assert(template.ok && template.headers.get('content-type').includes('spreadsheet'), 'TEMPLATE_FAILED');
    const data = JSON.parse(process.env.CARE_IMPORT_SMOKE_INPUT || '{}');
    if (!data.fileBase64) throw new Error('SAMPLE_FILE_MISSING');
    const form = new FormData(); form.set('file', new Blob([Buffer.from(data.fileBase64, 'base64')],
      { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'sample.xlsx');
    const preview = await fetch(base + '/api/activities/import', { method: 'POST', headers: { cookie: adminCookie }, body: form });
    const json = await preview.json();
    assert(preview.ok, 'PREVIEW_FAILED'); batchId = json.data.batchId;
    assert(json.data.rows.length === 1 && json.data.rows[0].customerId && json.data.rows[0].status === 'warning', 'PREVIEW_MATCH_FAILED');
    const customers = await fetch(base + '/customers', { headers: { cookie: adminCookie } });
    assert(customers.ok && (await customers.text()).includes('Import Excel CSKH'), 'ADMIN_BUTTON_MISSING');
    const after = await db.collection('care_activities').countDocuments({ source: 'excel-import' });
    assert(before === after, 'PREVIEW_WROTE_ACTIVITIES');
    console.log(JSON.stringify({ adminButton: true, templateDownload: true, salesDeniedAllMethods: true,
      previewRows: json.data.rows.length, phoneMatched: true, sampleNeedsAcknowledgment: true,
      importedHistoryUnchanged: true, confirmedAnyRows: false }));
  } finally {
    if (batchId) await client.db(process.env.MONGODB_DB || 'nichiei_crm').collection('care_import_batches').deleteOne({ id: batchId });
    await client.close();
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
