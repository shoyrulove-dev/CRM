/* eslint-disable @typescript-eslint/no-require-imports -- Isolated CommonJS server-module test loader. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const ExcelJS = require('exceljs');
function load(file, deps) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, { exports, Date, Buffer, require: name => {
    if (name in deps) return deps[name];
    if (name === 'node:crypto') return require('node:crypto');
    if (name === 'exceljs') return ExcelJS;
    if (name === 'server-only') return {};
    throw new Error(`Unexpected dependency: ${name}`);
  } });
  return exports;
}
const parser = load('care-import-parser.ts', {});
const admin = { id: 'admin-test', role: 'admin', name: 'Admin', email: 'admin@example.test' };
const sample = ['Khách kiểm thử', '0901234567', 2, 46301, 'Sale A', 'Nhắn tin Zalo', 'Zalo',
  'Chăm sóc khách trung thành', 'Liên lạc được', 'Đang dùng - hài lòng', 'Chưa dùng hết', 46074, '', 'Đúng', 5, '', 'Ghi chú kiểm thử'];
async function workbook(rows = [sample], { headers = parser.CARE_IMPORT_HEADERS, date1904 = false } = {}) {
  const book = new ExcelJS.Workbook(); book.properties.date1904 = date1904;
  const sheet = book.addWorksheet('Chi tiết chăm sóc'); sheet.addRow(Array.from(headers));
  rows.forEach(row => sheet.addRow(row));
  return Buffer.from(await book.xlsx.writeBuffer());
}
test('Vietnam phone normalization preserves leading zero and rejects ambiguous/malformed inputs', () => {
  for (const value of ['0901234567', '+84 901 234 567', '0084 901234567', '090.123.4567']) assert.equal(parser.normalizeImportPhone(value), '0901234567');
  for (const value of ['901234567', 'abc0901234567', '123', '']) assert.equal(parser.normalizeImportPhone(value), '');
});
test('dates support serial, 1904, VN date, date-only and reject bad calendar dates', () => {
  assert.equal(parser.parseImportDate(46301).iso, '2026-10-05T17:00:00.000Z');
  assert.equal(parser.parseImportDate('06/10/2026 15:30').iso, '2026-10-06T08:30:00.000Z');
  assert.equal(parser.parseImportDate('2026-10-06').dateOnly, true);
  assert.equal(parser.parseImportDate(44839, true).iso, parser.parseImportDate(46301).iso);
  for (const value of ['31/02/2026', '06/13/2026', '2026-00-01', '06/10/2026 25:00', '2026-02-31T00:00:00Z', 60]) assert.equal(parser.parseImportDate(value), null);
});
test('17-column sample parses serial dates, channel, blank booleans, warnings and empty trailing row', async () => {
  const rows = await parser.parseCareWorkbook(await workbook([sample, Array(17).fill('')]));
  assert.equal(rows.length, 1); const row = rows[0];
  assert.equal(row.data.channel, 'Zalo'); assert.equal(row.data.careAttempt, 2);
  assert.equal(row.data.satisfaction, 5); assert.equal(row.data.adverseReaction, undefined);
  assert.equal(row.data.productEndDate, '2026-02-21'); assert.equal(row.data.dueOffsetDays, 227);
  assert.equal(row.data.repurchaseTimely, undefined); assert.equal(row.errors.length, 0); assert.ok(row.warnings.length);
});
test('schema, formulas, invalid phones, unknown channel and score are validated', async () => {
  await assert.rejects(parser.parseCareWorkbook(await workbook([sample], { headers: ['wrong'] })));
  const bad = [...sample]; bad[1] = 'bad'; bad[5] = 'Unknown'; bad[14] = 6;
  bad[16] = { formula: '1+1', result: 2 };
  const [row] = await parser.parseCareWorkbook(await workbook([bad]));
  assert.ok(row.errors.length >= 4);
  const missingZero = [...sample]; missingZero[1] = 901234567;
  const [fixed] = await parser.parseCareWorkbook(await workbook([missingZero]));
  assert.equal(fixed.phone, '0901234567'); assert.ok(fixed.warnings.some(w => w.includes('số 0')));
});
test('rejects invalid/oversized archives and excessive row count', async () => {
  await assert.rejects(parser.parseCareWorkbook(Buffer.from('not-an-xlsx')));
  await assert.rejects(parser.parseCareWorkbook(Buffer.alloc(parser.MAX_IMPORT_BYTES + 1)));
  await assert.rejects(parser.parseCareWorkbook(await workbook(Array.from({ length: 501 }, () => sample))));
});
function matches(doc, filter) {
  return Object.entries(filter).every(([key, value]) => {
    if (key === '$or') return value.some(branch => matches(doc, branch));
    if (!value || typeof value !== 'object' || value instanceof Date) return doc[key] === value;
    return Object.entries(value).every(([op, expected]) => {
      if (op === '$in') return expected.includes(doc[key]);
      if (op === '$gt') return doc[key] > expected;
      if (op === '$lte') return doc[key] <= expected;
      throw new Error(`Unexpected operator ${op}`);
    });
  });
}
function fixture({ duplicatePhone = false, activities = [], active = true } = {}) {
  const customer = { id: 'KH-A', name: sample[0], phone: '+84901234567', owner: 'Sale A', lastCare: '2026-11-10', nextCare: '2026-12-01', loyaltyPoints: 151 };
  const data = { customers: [customer], users: [{ id: 'sale-a', name: 'Sale A', active }], care_activities: activities, care_import_batches: [] };
  if (duplicatePhone) data.customers.push({ ...customer, id: 'KH-B' });
  const touched = [];
  const db = { collection: name => ({
    createIndex: async () => {},
    find: (filter = {}) => ({ toArray: async () => structuredClone(data[name].filter(doc => matches(doc, filter))) }),
    findOne: async filter => structuredClone(data[name].find(doc => matches(doc, filter)) || null),
    insertOne: async doc => { data[name].push(structuredClone(doc)); touched.push(name); },
    updateOne: async (filter, update, options = {}) => {
      let doc = data[name].find(doc => matches(doc, filter)); let inserted = false;
      if (!doc && options.upsert) { doc = { ...filter, ...structuredClone(update.$setOnInsert) }; data[name].push(doc); inserted = true; }
      if (doc) { Object.assign(doc, update.$set); for (const key of Object.keys(update.$unset || {})) delete doc[key]; }
      touched.push(name); return { upsertedCount: inserted ? 1 : 0 };
    },
    findOneAndUpdate: async (filter, update) => {
      const doc = data[name].find(doc => matches(doc, filter)); if (!doc) return null;
      Object.assign(doc, update.$set); return structuredClone(doc);
    },
  }) };
  const engine = load('care-import.ts', {
    './data-store': { collections: { customers: 'customers', users: 'users', careActivities: 'care_activities' } },
    './mongodb': { getDatabase: async () => db }, './audit': { writeAudit: async () => touched.push('audit') },
    './care-import-parser': parser,
  });
  return { engine, data, touched, customer };
}
test('only admins can import; unique phone resolves without changing customer data', async () => {
  const { engine, data, touched } = fixture();
  assert.equal(engine.isCareImportAdmin(admin), true); assert.equal(engine.isCareImportAdmin(null), false);
  assert.equal(engine.isCareImportAdmin({ ...admin, role: 'sales' }), false);
  await assert.rejects(engine.previewCareImport(await workbook(), 'test.xlsx', { ...admin, role: 'sales' }));
  const preview = await engine.previewCareImport(await workbook(), 'test.xlsx', admin);
  assert.equal(preview.rows[0].customerId, 'KH-A'); assert.equal(preview.rows[0].status, 'warning');
  assert.equal(data.care_activities.length, 0); assert.deepEqual(touched, ['care_import_batches']);
});
test('missing or duplicate customer phones and inactive employee are blocked', async () => {
  for (const options of [{ duplicatePhone: true }, { active: false }]) {
    const { engine } = fixture(options); const preview = await engine.previewCareImport(await workbook(), 'test.xlsx', admin);
    assert.equal(preview.rows[0].status, 'error');
    await assert.rejects(engine.commitCareImport(preview.batchId, [2], true, admin));
  }
  const { engine } = fixture(); const missing = [...sample]; missing[1] = '0909999999';
  assert.equal((await engine.previewCareImport(await workbook([missing]), 'test.xlsx', admin)).rows[0].status, 'error');
});
test('confirmation requires warning acknowledgment; commit and replay do not touch customer or schedules', async () => {
  const { engine, data, customer, touched } = fixture(); const before = structuredClone(customer);
  const preview = await engine.previewCareImport(await workbook(), 'test.xlsx', admin);
  await assert.rejects(engine.commitCareImport(preview.batchId, [2], false, admin));
  await assert.rejects(engine.commitCareImport(preview.batchId, [2], true, { ...admin, id: 'other-admin' }));
  const first = await engine.commitCareImport(preview.batchId, [2], true, admin);
  assert.equal(first.inserted, 1); assert.equal(data.care_activities[0].source, 'excel-import');
  assert.equal(data.care_activities[0].sourceRow, 2); assert.equal(data.care_activities[0].careAttempt, 2);
  assert.deepEqual(customer, before); assert.ok(!touched.includes('customers'));
  assert.equal((await engine.commitCareImport(preview.batchId, [2], true, admin)).inserted, 0);
  assert.equal(data.care_activities.length, 1);
  const again = await engine.previewCareImport(await workbook(), 'renamed.xlsx', admin);
  assert.equal(again.rows[0].status, 'duplicate');
});
test('duplicates within file and preexisting manual histories are not imported twice', async () => {
  const { engine } = fixture();
  const preview = await engine.previewCareImport(await workbook([sample, sample]), 'test.xlsx', admin);
  assert.equal(preview.rows[1].status, 'duplicate');
  const parsed = await parser.parseCareWorkbook(await workbook());
  const existing = { ...parsed[0].data, customerId: 'KH-A', occurredAt: '2026-10-06T04:00:00Z' };
  const second = fixture({ activities: [existing] });
  assert.equal((await second.engine.previewCareImport(await workbook(), 'test.xlsx', admin)).rows[0].status, 'duplicate');
});
test('expired or changed customer snapshots cannot be committed', async () => {
  const { engine, data } = fixture();
  const preview = await engine.previewCareImport(await workbook(), 'test.xlsx', admin);
  data.customers[0].owner = 'Other Sale';
  await assert.rejects(engine.commitCareImport(preview.batchId, [2], true, admin));
  data.customers[0].owner = 'Sale A'; data.care_import_batches[0].expiresAt = new Date(0);
  await assert.rejects(engine.commitCareImport(preview.batchId, [2], true, admin));
});
