// Read-only production checks for reduced payloads, report validation and scope enforcement.
async function main() {
  const { MongoClient } = await import('mongodb');
  const { createHmac } = await import('node:crypto');
  const client = new MongoClient(process.env.MONGODB_URI); await client.connect();
  try {
    const db = client.db(process.env.MONGODB_DB || 'nichiei_crm');
    const assert = (value, code) => { if (!value) throw new Error(code); };
    const session = user => {
      const h = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url'), iat = Math.floor(Date.now() / 1000);
      const p = Buffer.from(JSON.stringify({ id: user.id, sub: user.id, name: user.name, email: user.email,
        role: user.role, sessionVersion: user.sessionVersion || 0, iat, exp: iat + 300 })).toString('base64url');
      return 'nichiei_session=' + h + '.' + p + '.' + createHmac('sha256', process.env.SESSION_SECRET).update(h + '.' + p).digest('base64url');
    };
    for (const role of ['super_admin', 'sales']) {
      const user = await db.collection('users').findOne({ active: true, role }); assert(user, 'ROLE_MISSING');
      const cookie = session(user);
      const get = path => fetch('http://127.0.0.1:3000' + path, { headers: { cookie }, signal: AbortSignal.timeout(30_000) });
      const response = await get('/api/form-options?kind=care'); assert(response.ok, 'FORM_OPTIONS_FAILED');
      const options = await response.json();
      assert(options.loadOrdersOnDemand === true && options.orders.length === 0, 'BULK_ORDER_PAYLOAD_STILL_PRESENT');
      assert(options.customers.every(customer => Object.keys(customer).every(key => ['id', 'name', 'phone', 'owner'].includes(key))), 'EXCESS_CUSTOMER_FIELDS');
      assert(role !== 'sales' || options.customers.every(customer => customer.owner === user.name), 'CUSTOMER_SCOPE_LEAK');
      if (options.customers.length) {
        const id = options.customers[0].id;
        const selected = await get('/api/form-options?kind=care&customerId=' + encodeURIComponent(id));
        assert(selected.ok, 'SELECTED_ORDERS_FAILED');
        const orders = (await selected.json()).orders;
        assert(orders.every(order => order.customerId === id && Object.keys(order).every(key => ['id', 'code', 'customerId', 'orderDate', 'products'].includes(key))), 'ORDER_SCOPE_OR_PAYLOAD_ERROR');
      }
      if (role === 'sales') {
        const outsider = await db.collection('customers').findOne({ owner: { $ne: user.name } }, { projection: { id: 1 } });
        if (outsider) assert((await get('/api/form-options?kind=care&customerId=' + encodeURIComponent(outsider.id))).status === 404, 'OUTSIDE_CUSTOMER_ORDERS_NOT_BLOCKED');
      }
      assert((await get('/customers?q=' + encodeURIComponent('('))).ok, 'LITERAL_SEARCH_CRASHED');
      assert((await get('/api/reports/export?from=2026-02-31&to=2026-03-01')).status === 400, 'INVALID_EXPORT_DATE_ACCEPTED');
      const invalid = await get('/reports?from=2026-11-20&to=2026-11-01');
      assert(invalid.ok && (await invalid.text()).includes('Khoảng ngày không hợp lệ'), 'INVALID_REPORT_RANGE_CRASHED');
      console.log(JSON.stringify({ role, minimalFormPayload: true, selectedCustomerOrders: true,
        scopedAccess: true, literalSearch: true, invalidReportHandled: true, readOnly: true }));
    }
  } finally { await client.close(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
