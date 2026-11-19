/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS loader isolates server modules for offline tests. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, dependencies = {}, globals = {}) {
  const exports = {};
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', file), 'utf8');
  const context = { exports, URL, AbortSignal, Date, Response,
    setTimeout: (callback) => setImmediate(callback), clearTimeout: clearImmediate,
    require: name => {
      if (name in dependencies) return dependencies[name];
      if (name === 'server-only') return {};
      throw new Error(`Unexpected dependency ${name}`);
    }, ...globals };
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context);
  return exports;
}
const detail = (id = '123', points = 151) => ({ customer: { id,
  membership: { name: 'VIP', reward_point_amount: points, reward_expire_date: '2027-12-31T00:00:00Z' } } });
const json = value => JSON.parse(JSON.stringify(value));

test('maps verified V2 fields and numeric strings; retains zero', () => {
  const { parseHaravanLoyalty: parse } = load('haravan-loyalty-api.ts');
  assert.deepEqual(json(parse(detail(), '123')), {
    membershipTier: 'VIP', loyaltyPoints: 151, loyaltyExpiresAt: '2027-12-31T00:00:00Z',
  });
  assert.equal(parse(detail('123', '54'), '123').loyaltyPoints, 54);
  assert.equal(parse(detail('123', 0), '123').loyaltyPoints, 0);
  const payload = detail(); payload.customer.membership.reward_expire_date = null;
  assert.equal(parse(payload, '123').loyaltyExpiresAt, null);
  payload.customer.membership.name = null;
  assert.equal(parse(payload, '123').membershipTier, '');
});

test('rejects wrong customer, missing membership and malformed values', () => {
  const { parseHaravanLoyalty: parse } = load('haravan-loyalty-api.ts');
  for (const payload of [null, {}, { customer: { id: '123' } },
    { customer: { id: '123', membership: null } }, detail('456')]) {
    assert.throws(() => parse(payload, '123'));
  }
  for (const amount of [null, undefined, '', ' ', true, {}, 'NaN', Infinity]) {
    const payload = detail(); payload.customer.membership.reward_point_amount = amount;
    assert.throws(() => parse(payload, '123'));
  }
  for (const name of ['', ' ', undefined, 12]) {
    const payload = detail(); payload.customer.membership.name = name;
    assert.throws(() => parse(payload, '123'));
  }
  const payload = detail(); payload.customer.membership.reward_expire_date = 'invalid-date';
  assert.throws(() => parse(payload, '123'));
});

test('uses detail endpoint, saved Bearer token, no cache; rejects synthetic IDs', async () => {
  let calls = 0;
  const api = load('haravan-loyalty-api.ts', {}, { fetch: async (url, options) => {
    calls++;
    assert.equal(url, 'https://apis.haravan.com/com/v2/customers/123.json');
    assert.equal(options.headers.authorization, 'Bearer existing-test-token');
    assert.equal(options.cache, 'no-store');
    assert.ok(options.signal);
    return Response.json(detail());
  } });
  await api.fetchHaravanLoyalty('existing-test-token', '123', new AbortController().signal);
  await assert.rejects(api.fetchHaravanLoyalty('x', 'order-123', new AbortController().signal));
  assert.equal(calls, 1);
});

for (const status of [401, 403, 404, 422]) {
  test(`does not retry HTTP ${status}`, async () => {
    let calls = 0;
    const api = load('haravan-loyalty-api.ts', {}, { fetch: async () => {
      calls++; return new Response('', { status });
    } });
    await assert.rejects(api.fetchHaravanLoyalty('x', '123', new AbortController().signal),
      error => error.status === status && !error.message.includes('Bearer'));
    assert.equal(calls, 1);
  });
}

test('retries 429/5xx before succeeding and respects retry cap', async () => {
  let calls = 0;
  const api = load('haravan-loyalty-api.ts', {}, { fetch: async () => {
    calls++;
    return calls <= 2 ? new Response('', { status: calls === 1 ? 429 : 503,
      headers: { 'Retry-After': '0' } }) : Response.json(detail());
  } });
  assert.equal((await api.fetchHaravanLoyalty('x', '123', new AbortController().signal)).loyaltyPoints, 151);
  assert.equal(calls, 3);
  calls = 0;
  const failing = load('haravan-loyalty-api.ts', {}, { fetch: async () => {
    calls++; return new Response('', { status: 503 });
  } });
  await assert.rejects(failing.fetchHaravanLoyalty('x', '123', new AbortController().signal));
  assert.equal(calls, 3);
});

test('does not retry earlier than a long Retry-After and honors cancellation', async () => {
  let calls = 0;
  const api = load('haravan-loyalty-api.ts', {}, { fetch: async () => {
    calls++; return new Response('', { status: 429, headers: { 'Retry-After': '120' } });
  } });
  await assert.rejects(api.fetchHaravanLoyalty('x', '123', new AbortController().signal));
  assert.equal(calls, 1);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(api.fetchHaravanLoyalty('x', '123', controller.signal));
  assert.equal(calls, 1);
});

// Small in-memory Mongo substitute: no DB or network is used by these tests.
function matches(doc, filter) {
  return Object.entries(filter).every(([key, condition]) => {
    if (key === '$or') return condition.some(branch => matches(doc, branch));
    const value = doc[key];
    if (!condition || typeof condition !== 'object') return value === condition;
    return Object.entries(condition).every(([op, operand]) => {
      if (op === '$exists') return (value !== undefined) === operand;
      if (op === '$lte') return value !== undefined && value <= operand;
      if (op === '$type') return typeof value === operand;
      if (op === '$regex') return operand.test(String(value));
      throw new Error(`Unexpected operator ${op}`);
    });
  });
}
function harness(docs, fetchDetail, { busy = false } = {}) {
  const state = { docs, settings: {}, released: false };
  const customers = {
    countDocuments: async filter => docs.filter(doc => matches(doc, filter)).length,
    find: filter => {
      const rows = docs.filter(doc => matches(doc, filter));
      const cursor = { sort: () => cursor, limit: count => { rows.splice(count); return cursor; },
        project: () => cursor, toArray: async () => rows };
      return cursor;
    },
    updateOne: async (filter, update) => {
      const doc = docs.find(doc => matches(doc, filter));
      assert.ok(doc); Object.assign(doc, update.$set);
      for (const key of Object.keys(update.$unset || {})) delete doc[key];
      return { modifiedCount: 1 };
    },
  };
  const settings = { findOne: async () => state.settings,
    updateOne: async (_filter, update) => Object.assign(state.settings, update.$set) };
  const locks = { findOneAndUpdate: async () => {
    if (busy) throw Object.assign(new Error('duplicate'), { code: 11000 });
  }, deleteOne: async () => { state.released = true; } };
  const api = load('haravan-loyalty-api.ts');
  const db = { collection: name => ({ customers, settings, job_locks: locks })[name] };
  const worker = load('haravan-loyalty-sync.ts', {
    'node:crypto': require('node:crypto'),
    './data-store': { collections: { customers: 'customers', settings: 'settings', jobLocks: 'job_locks' } },
    './mongodb': { hasDatabase: () => true, getDatabase: async () => db },
    './integration-config': { getIntegrationConfig: async () => ({ haravanAccessToken: 'stored-test-token' }) },
    './haravan-loyalty-api': { ...api, fetchHaravanLoyalty: fetchDetail },
  });
  return { worker, state, api };
}

test('worker writes only loyalty fields, preserves CRM ownership and skips synthetic IDs', async () => {
  const docs = [{ _id: 'a', haravanId: '123', owner: 'Sale A', segment: 'Trung thành',
    loyaltyPoints: 151, loyaltySyncError: 'old' }, { _id: 'b', haravanId: 'order-456' }];
  let calls = 0;
  const { worker, state } = harness(docs, async (token, id) => {
    calls++; assert.equal(token, 'stored-test-token'); assert.equal(id, '123');
    return { membershipTier: 'VIP', loyaltyPoints: 0, loyaltyExpiresAt: null };
  });
  const result = await worker.syncHaravanLoyalty();
  assert.equal(calls, 1); assert.equal(result.updated, 1); assert.equal(result.missing, 0);
  assert.equal(docs[0].loyaltyPoints, 0); assert.equal(docs[0].owner, 'Sale A');
  assert.equal(docs[0].segment, 'Trung thành'); assert.equal(docs[0].loyaltySyncError, undefined);
  assert.ok(docs[0].loyaltySyncedAt); assert.ok(state.released);
  await worker.syncHaravanLoyalty(); assert.equal(calls, 1);
});

test('failed detail reads preserve previous membership/points/timestamp and defer retry', async () => {
  const docs = [{ _id: 'a', haravanId: '123', membershipTier: 'VIP', loyaltyPoints: 54,
    loyaltySyncedAt: '2026-11-01T00:00:00Z' }];
  const { worker, state } = harness(docs, async () => { throw new Error('missing membership'); });
  const result = await worker.syncHaravanLoyalty();
  assert.equal(result.failed, 1); assert.equal(result.status, 'partial');
  assert.equal(docs[0].loyaltyPoints, 54); assert.equal(docs[0].membershipTier, 'VIP');
  assert.equal(docs[0].loyaltySyncedAt, '2026-11-01T00:00:00Z');
  assert.ok(docs[0].loyaltyNextSyncAt > new Date().toISOString()); assert.ok(state.released);
});

test('busy worker does not make provider calls or release another owner lock', async () => {
  const { worker, state } = harness([{ _id: 'a', haravanId: '123' }], async () => {
    assert.fail('provider must not be called');
  }, { busy: true });
  assert.equal((await worker.syncHaravanLoyalty()).busy, true);
  assert.equal(state.released, false);
});

test('continues after a customer-specific 422 but halts on auth/quota errors', async () => {
  for (const status of [422, 401, 403, 429]) {
    const docs = [{ _id: 'a', haravanId: '123' }, { _id: 'b', haravanId: '456' }];
    let calls = 0;
    const fixture = harness(docs, async () => {
      calls++;
      if (calls === 1) throw new fixture.api.HaravanLoyaltyHttpError(status);
      return { membershipTier: 'VIP', loyaltyPoints: 1, loyaltyExpiresAt: null };
    });
    const result = await fixture.worker.syncHaravanLoyalty();
    assert.equal(result.failed, 1);
    assert.equal(result.updated, status === 422 ? 1 : 0);
    assert.equal(result.halted, status !== 422);
    assert.equal(calls, status === 422 ? 2 : 1);
  }
});

test('50-customer limit and fresh V1-independent refresh selection', async () => {
  const docs = Array.from({ length: 51 }, (_, i) => ({ _id: String(i), haravanId: String(i + 1) }));
  let calls = 0;
  const { worker } = harness(docs, async () => {
    calls++; return { membershipTier: 'VIP', loyaltyPoints: 1, loyaltyExpiresAt: null };
  });
  assert.equal((await worker.syncHaravanLoyalty()).updated, 50);
  assert.equal(calls, 50);
  assert.equal((await worker.syncHaravanLoyalty()).updated, 1);
  docs[0].loyaltyNextSyncAt = '2020-01-01T00:00:00Z';
  assert.equal((await worker.syncHaravanLoyalty()).updated, 1);
});
