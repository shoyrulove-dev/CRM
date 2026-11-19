/* eslint-disable @typescript-eslint/no-require-imports -- Offline server-module loader. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, deps = {}, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', 'src/lib', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, { exports, Date, Buffer, process: { env: {} }, require: name => {
    if (name in deps) return deps[name];
    if (name === 'server-only') return {};
    throw new Error(`Unexpected dependency ${name}`);
  }, ...globals });
  return exports;
}
const month = load('month-range.ts'), query = load('query-utils.ts');
const reports = load('report-filters.ts', { './month-range': month });
const checkpoint = load('haravan-sync-state.ts');
const entity = load('entity-id.ts', { 'node:crypto': require('node:crypto') });
const plain = value => JSON.parse(JSON.stringify(value));
test('new entity IDs do not wrap every 1,000,000 milliseconds or collide within a millisecond', () => {
  const ids = new Set(Array.from({ length: 5000 }, () => entity.createEntityId('KH')));
  assert.equal(ids.size, 5000);
  assert.ok([...ids].every(id => /^KH-[a-f0-9-]{36}$/.test(id)));
});
test('literal search escapes regex operators and bounds query size', () => {
  for (const text of ['(', '[', '.*', 'a+b', 'name?', '\\']) {
    const regex = new RegExp(query.escapeSearch(text));
    assert.ok(regex.test(text));
    if (text === '.*') assert.ok(!regex.test('unrelated'));
  }
  assert.equal(query.escapeSearch('x'.repeat(300)).length, 200);
});
test('reports use Vietnam day boundaries and reject invalid/reversed periods', () => {
  assert.equal(reports.reportDay('2026-10-05T17:00:00.000Z'), '2026-10-06');
  assert.ok(reports.reportInRange('2026-10-05T17:00:00.000Z', '2026-10-06', '2026-10-06'));
  assert.equal(reports.reportInRange('bad', '2026-10-06'), false);
  assert.equal(reports.reportPeriod('2026-02-31', '2026-03-01'), null);
  assert.equal(reports.reportPeriod('2026-11-20', '2026-11-01'), null);
  assert.deepEqual(plain(reports.reportPeriod(undefined, undefined, new Date('2026-11-18T18:00:00Z'))), {
    from: '2026-11-01', to: '2026-11-19', previousFrom: '2026-10-13', previousTo: '2026-10-31',
  });
});
test('incremental checkpoint resumes same filter instead of changing dataset at page 11', () => {
  const start = '2026-11-19T00:00:00Z';
  const first = checkpoint.haravanSyncState({ complete: true, mappingVersion: 5, lastSuccessAt: start }, '2026-11-19T01:00:00Z');
  assert.equal(first.incremental, true); assert.equal(first.customerPage, 1);
  const next = checkpoint.haravanSyncState({ complete: false, mappingVersion: 5,
    checkpointVersion: 1, cycleMappingVersion: 5, cycleIncremental: true,
    cycleStartedAt: first.cycleStartedAt, cycleUpdatedAtMin: first.updatedAtMin,
    customerPage: 11, orderPage: 21 }, '2026-11-19T02:00:00Z');
  assert.equal(next.customerPage, 11); assert.equal(next.orderPage, 21);
  assert.equal(next.updatedAtMin, first.updatedAtMin); assert.equal(next.cycleStartedAt, first.cycleStartedAt);
});
test('legacy/mapping changes restart from page 1; invalid timestamps do not crash sync', () => {
  for (const previous of [{ complete: false, customerPage: 91, mappingVersion: 5 },
    { complete: true, mappingVersion: 4, customerPage: 91, lastSuccessAt: '2026-11-01' },
    { complete: true, mappingVersion: 5, lastSuccessAt: 'bad' }]) {
    const state = checkpoint.haravanSyncState(previous, '2026-11-19T00:00:00Z');
    assert.equal(state.customerPage, 1); assert.equal(state.incremental, false); assert.equal(state.updatedAtMin, undefined);
  }
});
const admin = { id: 'a', role: 'admin', name: 'Admin' }, sale = { id: 's', role: 'sales', name: 'Sale A' };
function matches(doc, filter) {
  return Object.entries(filter).every(([key, value]) => {
    if (key === '$or') return value.some(branch => matches(doc, branch));
    if (value && typeof value === 'object') return Object.entries(value).every(([op, operand]) => {
      if (op === '$in') return operand.includes(doc[key]);
      if (op === '$ne') return doc[key] !== operand;
      throw new Error(`Unknown operator ${op}`);
    });
    return doc[key] === value;
  });
}
function fixture() {
  const data = {
    customers: [{ id: 'mine', name: 'A', phone: '0901234567', owner: 'Sale A', secretNote: 'private' },
      { id: 'other', name: 'B', phone: '0907654321', owner: 'Sale B' }],
    care_tasks: [{ id: 't1', owner: 'Sale A', dueAt: '2026-11-01', status: 'due', note: 'large payload' }, { id: 't2', owner: 'Sale B' }],
    care_activities: [{ id: 'c1', customerId: 'mine', employee: 'Sale B', occurredAt: '2026-11-01', result: 'ok', note: 'large note' }, { id: 'c2', customerId: 'other', employee: 'Sale B' }],
    orders: [{ id: 'o1', code: '#1', customerId: 'mine', orderDate: '2026-11-01', owner: 'Sale A', salesperson: 'Sale A', products: [{ sku: 'P' }], raw: 'large raw' },
      { id: 'o2', code: '#2', customerId: 'other', owner: 'Sale B', salesperson: 'Sale B', products: [] }],
    service_tickets: [{ id: 'p1', owner: 'Sale A' }, { id: 'p2', owner: 'Sale B' }],
  };
  const reads = [];
  const project = (row, projection) => Object.values(projection).some(v => v === 1)
    ? Object.fromEntries(Object.entries(row).filter(([key]) => projection[key] === 1)) : { ...row };
  const db = { collection: name => ({
    find: (filter = {}, options = {}) => {
      reads.push({ name, filter: plain(filter), projection: options.projection || {} });
      const cursor = { toArray: async () => data[name].filter(row => matches(row, filter)).map(row => project(row, options.projection || {})), sort: () => cursor };
      return cursor;
    },
    findOne: async (filter, options = {}) => {
      const row = data[name].find(row => matches(row, filter)); return row ? project(row, options.projection || {}) : null;
    },
  }) };
  const mongodb = { hasDatabase: () => true, getDatabase: async () => db };
  const store = load('data-store.ts', { './demo-data': { customers: data.customers, tasks: [], activities: [], orders: [], tickets: [] },
    './mongodb': mongodb, './month-range': month, './query-utils': query });
  const forms = load('form-options.ts', { './data-store': store, './mongodb': mongodb,
    './session': { canSeeAll: user => ['admin', 'super_admin'].includes(user.role) }, './demo-data': { customers: [], orders: [] } });
  return { store, forms, reads, data, mongodb };
}
test('report summary excludes unused ticket collection and heavy nested fields', async () => {
  const { store, reads } = fixture();
  const data = await store.getReportData(admin, { summary: true, sections: ['customers', 'tasks', 'activities', 'orders'] });
  assert.equal(data.orders.length, 2); assert.equal(data.orders[0].products, undefined);
  assert.equal(data.tasks[0].note, undefined); assert.equal(data.customers[0].secretNote, undefined);
  assert.ok(!reads.some(read => read.name === 'service_tickets'));
});
test('sales report scope is pushed into Mongo instead of reading other staff data', async () => {
  const { store, reads } = fixture(); const data = await store.getReportData(sale);
  assert.deepEqual(Array.from(data.customers, row => row.id), ['mine']);
  assert.deepEqual(Array.from(data.orders, row => row.id), ['o1']);
  assert.deepEqual(Array.from(data.activities, row => row.id), ['c1']);
  assert.ok(reads.every(read => Object.keys(read.filter).length > 0));
});
test('template-specific report reads skip irrelevant collections', async () => {
  const { store, reads } = fixture(); const data = await store.getReportData(admin, { sections: ['tickets'] });
  assert.equal(data.tickets.length, 2); assert.equal(data.orders.length, 0);
  assert.deepEqual(reads.map(read => read.name), ['service_tickets']);
});
test('form options return minimal customer fields and only authorized selected customer orders', async () => {
  const { forms, reads } = fixture();
  const customers = await forms.getFormCustomers(sale);
  assert.equal(customers.length, 1); assert.equal(customers[0].secretNote, undefined);
  const orders = await forms.getFormCustomerOrders(sale, 'mine');
  assert.equal(orders.length, 1); assert.equal(orders[0].id, 'o1'); assert.equal(orders[0].raw, undefined);
  assert.equal(await forms.getFormCustomerOrders(sale, 'other'), null);
  assert.equal((await forms.getFormCustomerOrders(admin, 'other')).length, 1);
  assert.ok(!reads.some(read => ['care_tasks', 'care_activities', 'service_tickets'].includes(read.name)));
});
test('production user reads/login cannot recreate known-password demo accounts', async () => {
  let mutations = 0;
  const users = load('users.ts', {
    bcryptjs: { compare: async () => false, hash: async () => { mutations++; return 'hash'; } },
    './data-store': { collections: { users: 'users' }, ensureIndexes: async () => { mutations++; } },
    './mongodb': { hasDatabase: () => true, getDatabase: async () => ({ collection: () => ({ findOne: async () => null, updateOne: async () => { mutations++; } }) }) },
  }, { process: { env: { NODE_ENV: 'production', ALLOW_DEMO_USERS: 'true' } } });
  await users.ensureDefaultUsers();
  assert.equal(await users.authenticateUser('admin@nichiei.vn', 'invalid'), null);
  assert.equal(mutations, 0);
});
