// Run inside the CRM container. Never print tokens, passwords or provider keys.
const base = process.env.RESET_TEST_BASE || 'http://127.0.0.1:3000';
const assert = (condition, code) => { if (!condition) throw new Error(code); };
async function main() {
  const { MongoClient } = await import('mongodb');
  const { createHash, createDecipheriv, randomBytes } = await import('node:crypto');
  const client = new MongoClient(process.env.MONGODB_URI); await client.connect();
  const db = client.db(process.env.MONGODB_DB || 'nichiei_crm');
  let id = '';
  try {
    const row = await db.collection('settings').findOne({ id: 'integrations' });
    const [iv, tag, data] = row.payload.split('.');
    const decrypt = createDecipheriv('aes-256-gcm', createHash('sha256').update(process.env.SESSION_SECRET).digest(), Buffer.from(iv, 'base64'));
    decrypt.setAuthTag(Buffer.from(tag, 'base64'));
    const config = JSON.parse(Buffer.concat([decrypt.update(Buffer.from(data, 'base64')), decrypt.final()]).toString());
    const email = config.emailTestTo;
    assert(config.resendApiKey && email, 'EMAIL_CONFIG_MISSING');
    assert(!await db.collection('users').findOne({ email }), 'TEST_RECIPIENT_ALREADY_HAS_ACCOUNT');
    const password = randomBytes(24).toString('base64url');
    const adminLogin = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: process.env.RESET_TEST_ADMIN_EMAIL || 'admin@nichiei.vn', password: process.env.RESET_TEST_ADMIN_PASSWORD || 'Nichiei@2026' }) });
    assert(adminLogin.ok, 'ADMIN_LOGIN_FAILED');
    const adminCookie = adminLogin.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ');
    const created = await fetch(base + '/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: adminCookie }, body: JSON.stringify({ name: 'Email reset smoke', email, role: 'sales', password }) });
    assert(created.ok, 'TEST_ACCOUNT_CREATE_FAILED');
    id = (await created.json()).data.id;
    const login = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    assert(login.ok, 'TEST_LOGIN_FAILED');
    const temporaryCookie = login.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ');
    const changed = await fetch(base + '/api/auth/change-password', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: temporaryCookie }, body: JSON.stringify({ currentPassword: password, newPassword: password + 'A' }) });
    assert(changed.ok, 'INITIAL_CHANGE_FAILED');
    const oldCookie = changed.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ');
    const sent = await fetch(base + '/api/auth/password-reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
    assert(sent.ok, 'RESET_REQUEST_FAILED');
    const account = await db.collection('users').findOne({ id });
    assert(account.resetTokenHash, 'RESET_EMAIL_FAILED');
    // Provider API inspection stays entirely inside this process.
    const headers = { Authorization: `Bearer ${config.resendApiKey}` };
    let token, providerId;
    for (let attempt = 0; attempt < 5 && !token; attempt++) {
      if (attempt) await new Promise((resolve) => setTimeout(resolve, 2000));
      const list = await fetch('https://api.resend.com/emails', { headers });
      assert(list.ok, 'RESEND_READ_PERMISSION_MISSING');
      for (const item of (await list.json()).data || []) {
        if (!item.to?.includes(email) || !item.subject?.includes('CRM')) continue;
        const response = await fetch(`https://api.resend.com/emails/${item.id}`, { headers });
        if (!response.ok) continue;
        const detail = await response.json();
        const match = String(detail.text || '').match(/reset-password#([a-f0-9]{64})/);
        if (match && createHash('sha256').update(match[1]).digest('hex') === account.resetTokenHash) { token = match[1]; providerId = item.id; break; }
      }
    }
    assert(token, 'RESET_EMAIL_NOT_FOUND');
    const newPassword = randomBytes(24).toString('base64url');
    const reset = await fetch(base + '/api/auth/password-reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password: newPassword }) });
    assert(reset.ok, 'RESET_CONSUME_FAILED');
    const replay = await fetch(base + '/api/auth/password-reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password: newPassword }) });
    assert(replay.status === 400, 'TOKEN_REPLAY_ACCEPTED');
    const stale = await fetch(base + '/api/customers', { headers: { Cookie: oldCookie } });
    assert([401, 403].includes(stale.status), 'OLD_SESSION_NOT_REVOKED');
    const again = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: newPassword }) });
    assert(again.ok, 'NEW_PASSWORD_LOGIN_FAILED');
    const expired = randomBytes(32).toString('hex');
    await db.collection('users').updateOne({ id }, { $set: { resetTokenHash: createHash('sha256').update(expired).digest('hex'), resetExpiresAt: new Date(Date.now() - 1000) } });
    const denied = await fetch(base + '/api/auth/password-reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: expired, password: newPassword }) });
    assert(denied.status === 400, 'EXPIRED_TOKEN_ACCEPTED');
    const delivery = await fetch(`https://api.resend.com/emails/${providerId}`, { headers });
    const state = await delivery.json();
    console.log(JSON.stringify({ resetEmailAccepted: true, tokenSingleUse: true, expiredTokenRejected: true, oldSessionRevoked: true, newLoginWorks: true, delivery: state.last_event || 'accepted' }));
  } finally {
    if (id) {
      await db.collection('users').deleteOne({ id });
      await db.collection('login_events').deleteMany({ userId: id });
    }
    await client.close();
  }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
