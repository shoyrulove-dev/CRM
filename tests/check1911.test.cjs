/* eslint-disable @typescript-eslint/no-require-imports -- Offline tests for server modules. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
function load(file, deps = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/' + file + '.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, Date, Object, Math, Number, String, Map, Set, console, require: name => name === 'server-only' ? {} : name in deps ? deps[name] : require(name) });
  return exports;
}
const recurrence = load('care-recurrence');
test('calendar recurrence clamps month end and restores original day; weekly quarterly yearly custom', () => {
  const next = recurrence.nextCareDate;
  assert.equal(next('2026-01-31T02:00:00Z', 'monthly', 7, 31), '2026-02-28T02:00:00.000Z');
  assert.equal(next('2026-02-28T02:00:00Z', 'monthly', 7, 31), '2026-03-31T02:00:00.000Z');
  assert.equal(next('2026-01-31T02:00:00Z', 'quarterly'), '2026-04-30T02:00:00.000Z');
  assert.equal(next('2024-02-29T02:00:00Z', 'yearly'), '2025-02-28T02:00:00.000Z');
  assert.equal(next('2026-01-01T17:00:00Z', 'weekly'), '2026-01-08T17:00:00.000Z');
  assert.equal(next('2026-01-01T17:00:00Z', 'custom', 10), '2026-01-11T17:00:00.000Z');
  assert.equal(next('2026-01-01T17:00:00Z', 'none'), null);
});
test('period retention never mixes lifetime customers with monthly orders', () => {
  const month = load('month-range'), filters = load('report-filters', { './month-range': month });
  const { retentionMetrics } = load('retention-metrics', { './report-filters': filters });
  const order = (id, date, kind = 'Mua mới', status = 'Mua hàng', total = 100) => ({ customerId: id, orderDate: date, purchaseType: kind, status, total });
  const result = retentionMetrics([order('old', '2025-01-01'), order('repeat', '2025-01-01'), order('repeat', '2026-11-01', 'Mua lại'), order('new', '2026-11-02'), order('cancel', '2026-11-02', 'Mua lại', 'Hủy'), order('future', '2027-01-01')], '2026-11-01', '2026-11-30');
  assert.equal(result.customersWithOrders, 2); assert.equal(result.multiBuyers, 1); assert.equal(result.repurchaseRate, 0.5); assert.equal(result.repurchaseRevenue, 100);
  assert.equal(result.cumulativeBuyers, 3); assert.equal(result.cumulativeRepeat, 1);
});
function programFixture(size = 1201) {
  const ids = Array.from({ length: size }, (_, i) => 'KH-' + i);
  const program = { id: 'p', status: 'active', nextDueAt: new Date().toISOString(), customerIds: ids, targetCount: size, cursor: 0, created: 0, skipped: 0, purpose: 'Test', channel: 'Zalo', recurrence: 'none', assignToCustomerOwner: true, occurrence: 1 };
  const tasks = new Map(); let fail = false;
  const db = { collection: name => name === 'care_programs' ? {
    findOneAndUpdate: async () => {
      if (program.status !== 'active' || program.leaseUntil > new Date() || Date.parse(program.nextDueAt) > Date.now() + 30 * 86400000) return null;
      return { ...program };
    },
    updateOne: async (_q, op) => { Object.assign(program, op.$set || {}); for (const key of Object.keys(op.$unset || {})) delete program[key]; },
  } : name === 'customers' ? { find: q => ({ project: () => ({ toArray: async () => q.id.$in.map((id, index) => ({ id, name: id, phone: '', owner: index % 2 ? 'Sale' : 'CSKH' })) }) }) }
    : { bulkWrite: async ops => { let upsertedCount = 0; for (const op of ops) { const task = op.updateOne.update.$setOnInsert; if (!tasks.has(task.id)) { tasks.set(task.id, task); upsertedCount++; } if (fail) { fail = false; throw new Error('partial network failure'); } } return { upsertedCount }; } } };
  const module = load('care-programs', { 'node:crypto': require('node:crypto'), './mongodb': { getDatabase: async () => db }, './data-store': { collections: { customers: 'customers', careTasks: 'tasks' } }, './care-recurrence': recurrence });
  return { program, tasks, run: () => module.processCareProgram('p'), failOnce: () => { fail = true; } };
}
test('bulk processes more than 1000 customers in bounded batches with correct owners and no duplicates', async () => {
  const f = programFixture(); let runs = 0;
  while (f.program.status === 'active' && runs++ < 10) { const result = await f.run(); assert.ok(result.processed <= 200); }
  assert.equal(f.tasks.size, 1201); assert.equal(f.program.status, 'completed'); assert.equal(f.program.cursor, 1201);
  assert.ok([...f.tasks.values()].some(x => x.owner === 'Sale')); assert.ok([...f.tasks.values()].some(x => x.owner === 'CSKH'));
  await f.run(); assert.equal(f.tasks.size, 1201);
});
test('partial batch retries idempotently; paused and future programs do not generate tasks', async () => {
  const f = programFixture(10); f.failOnce(); await assert.rejects(f.run()); assert.equal(f.program.cursor, 0);
  await f.run(); assert.equal(f.tasks.size, 10);
  const paused = programFixture(5); paused.program.status = 'paused'; await paused.run(); assert.equal(paused.tasks.size, 0);
  paused.program.status = 'active'; paused.program.nextDueAt = '2099-01-01T00:00:00Z'; await paused.run(); assert.equal(paused.tasks.size, 0);
});
