/**
 * Diagnose why test@rxil.com cannot login.
 * 1. Fetches User Accounts from n8n GET useraccount
 * 2. Finds test@rxil.com and checks Password format (bcrypt?)
 * 3. Tests bcrypt.compare(pass@123, storedHash)
 * Run: cd backend && node scripts/diagnose-nbfc-login.js
 */
import fetch from 'node-fetch';
import bcrypt from 'bcryptjs';

const N8N_BASE = process.env.N8N_BASE_URL || 'https://fixrrahul.app.n8n.cloud';
const GET_USER_ACCOUNTS = `${N8N_BASE}/webhook/useraccount`;
const EMAIL = process.env.NBFC_EMAIL || 'test@rxil.com';
const PASSWORD = process.env.NBFC_PASSWORD || 'pass@123';

async function main() {
  console.log('=== NBFC Login Diagnostic ===\n');
  console.log('Looking for:', EMAIL);
  console.log('');

  const res = await fetch(GET_USER_ACCOUNTS);
  const data = await res.json();
  const arr = Array.isArray(data) ? data : (data && data['User Accounts']) || [];
  const records = Array.isArray(arr) ? arr : [];

  function getUsername(u) {
    return (u.Username ?? u.username ?? u.fields?.Username ?? u.fields?.username ?? '').toString().trim().toLowerCase();
  }
  function getField(u, key) {
    return (u[key] ?? u[key?.toLowerCase()] ?? u.fields?.[key] ?? u.fields?.[key?.replace(/\s+/g, ' ')] ?? '').toString();
  }

  const user = records.find((u) => getUsername(u) === EMAIL.toLowerCase());
  if (!user) {
    console.log('User NOT FOUND in User Accounts.');
    console.log('Total records:', records.length);
    console.log('Usernames:', records.slice(0, 5).map((u) => getUsername(u) || '(empty)').join(', '));
    process.exit(1);
  }

  const pw = getField(user, 'Password') || getField(user, 'password') || getField(user, 'PIN') || getField(user, 'pin') || '';
  const status = getField(user, 'Account Status') || getField(user, 'accountStatus') || '?';
  const role = getField(user, 'Role') || getField(user, 'role') || '?';

  console.log('User found:');
  console.log('  Username:', getUsername(user) || getField(user, 'Username'));
  console.log('  Role:', role);
  console.log('  Account Status:', status);
  console.log('  Password length:', pw ? pw.length : 0);
  console.log('  Password starts with:', pw ? pw.substring(0, 7) : '(empty)');
  console.log('  Is bcrypt format?:', /^\$2[aby]?\$\d+\$/.test(pw));
  console.log('');

  if (status !== 'Active') {
    console.log('FAIL: Account Status is not Active. Login will be rejected.');
    process.exit(1);
  }

  if (!pw || typeof pw !== 'string') {
    console.log('FAIL: No password/hash stored.');
    process.exit(1);
  }

  const isValid = await bcrypt.compare(PASSWORD, pw);
  if (isValid) {
    console.log('bcrypt.compare(pass@123, storedHash): OK - password matches');
    console.log('Login should work. Try clearing backend cache or wait 5 min.');
    process.exit(0);
  }

  console.log('bcrypt.compare(pass@123, storedHash): FAILED');
  console.log('The stored value is not a valid bcrypt hash for pass@123.');
  console.log('Possible causes: n8n adduser stored plaintext, or different hash.');
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
