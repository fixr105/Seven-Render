/**
 * Create a single NBFC user (User Account + NBFC Partners profile)
 * Sends bcrypt hash as PIN - n8n adduser expects PIN (not Password). Auth reads both.
 *
 * Usage:
 *   node scripts/create-nbfc-user.js
 *   # Uses: NBFC_EMAIL (default test@rxil.com), NBFC_PASSWORD (default pass@123), NBFC_NAME (default RXIL)
 *
 * Fix existing user's password (if double-hashed):
 *   node scripts/create-nbfc-user.js --fix-password
 *
 * Or with env vars:
 *   NBFC_EMAIL=other@nbfc.com NBFC_PASSWORD=secret123 NBFC_NAME="ABC Finance" node scripts/create-nbfc-user.js
 */

import fetch from 'node-fetch';
import bcrypt from 'bcryptjs';

const N8N_BASE = process.env.N8N_BASE_URL || 'https://fixrrahul.app.n8n.cloud';
const N8N_ADD_USER_URL = process.env.N8N_POST_ADD_USER_URL || `${N8N_BASE}/webhook/adduser`;
const N8N_POST_NBFC_PARTNERS_URL = process.env.N8N_POST_NBFC_PARTNERS_URL || `${N8N_BASE}/webhook/NBFCPartners`;
const N8N_GET_USER_ACCOUNTS = process.env.N8N_GET_USER_ACCOUNTS_URL || `${N8N_BASE}/webhook/useraccount`;

const email = process.env.NBFC_EMAIL || 'test@rxil.com';
const password = process.env.NBFC_PASSWORD || 'pass@123';
const name = process.env.NBFC_NAME || 'RXIL';

function getUsername(u) {
  return (u.Username ?? u.username ?? u.fields?.Username ?? u.fields?.username ?? '').toString().trim().toLowerCase();
}

function getField(u, key) {
  return u[key] ?? u[key.toLowerCase()] ?? u.fields?.[key] ?? u.fields?.[key.replace(/\s+/g, ' ')] ?? '';
}

async function userExists(emailToCheck) {
  try {
    const res = await fetch(N8N_GET_USER_ACCOUNTS);
    const data = await res.json();
    const arr = Array.isArray(data) ? data : (data && data['User Accounts']) || [];
    const records = Array.isArray(arr) ? arr : [];
    return records.some((u) => getUsername(u) === emailToCheck.toLowerCase());
  } catch (error) {
    console.warn(`Could not check existing users: ${error.message}. Proceeding to create.`);
    return false;
  }
}

async function getExistingUser(emailToCheck) {
  try {
    const res = await fetch(N8N_GET_USER_ACCOUNTS);
    const data = await res.json();
    const arr = Array.isArray(data) ? data : (data && data['User Accounts']) || [];
    const records = Array.isArray(arr) ? arr : [];
    return records.find((u) => getUsername(u) === emailToCheck.toLowerCase()) || null;
  } catch (error) {
    return null;
  }
}

async function fixPassword() {
  const existing = await getExistingUser(email);
  if (!existing) {
    console.error('User not found:', email);
    process.exit(1);
  }
  const recordId = existing.id;
  console.log('Updating password for', email, '(record:', recordId, ')');
  const hashedPassword = await bcrypt.hash(password, 10);
  const updateData = {
    id: recordId,
    Username: email.toLowerCase(),
    PIN: hashedPassword, // adduser expects PIN, not Password
    Role: getField(existing, 'Role') || 'nbfc',
    'Associated Profile': getField(existing, 'Associated Profile') || name,
    'Account Status': getField(existing, 'Account Status') || 'Active',
  };
  const res = await fetch(N8N_ADD_USER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updateData),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error('Failed to update password:', err);
    process.exit(1);
  }
  console.log('Password updated (bcrypt hash). You can now login with', email, '/', password);
}

async function main() {
  const fixPw = process.argv.includes('--fix-password');
  if (fixPw) {
    await fixPassword();
    return;
  }

  console.log('Creating NBFC profile:', email);

  if (await userExists(email)) {
    console.log('User already exists. To fix password, run: node scripts/create-nbfc-user.js --fix-password');
    process.exit(0);
  }

  const userId = `USER-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const hashedPassword = await bcrypt.hash(password, 10);

  const userAccountData = {
    id: userId,
    Username: email.toLowerCase(),
    PIN: hashedPassword, // adduser expects PIN, not Password
    Role: 'nbfc',
    'Associated Profile': name,
    'Last Login': '',
    'Account Status': 'Active',
  };

  console.log('Creating user account...');
  const userRes = await fetch(N8N_ADD_USER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userAccountData),
  });

  if (!userRes.ok) {
    const err = await userRes.json().catch(() => ({}));
    console.error('Failed to create user account:', err);
    process.exit(1);
  }
  console.log('User account created.');

  const nbfcData = {
    id: userId,
    'Lender ID': userId,
    'Lender Name': name,
    'Contact Person': name,
    'Contact Email/Phone': email,
    'Address/Region': '',
    Active: 'True',
  };

  console.log('Creating NBFC Partners profile...');
  const nbfcRes = await fetch(N8N_POST_NBFC_PARTNERS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(nbfcData),
  });

  if (!nbfcRes.ok) {
    const err = await nbfcRes.json().catch(() => ({}));
    console.error('Failed to create NBFC Partners profile:', err);
    process.exit(1);
  }
  console.log('NBFC Partners profile created.');

  console.log('\nNBFC profile created successfully.');
  console.log('Login: ' + email + ' / ' + password);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
