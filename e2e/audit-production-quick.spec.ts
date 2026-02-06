/**
 * Quick production audit: login + key routes + write report only.
 * Run: PLAYWRIGHT_TEST_BASE_URL=https://lms.sevenfincorp.com npx playwright test e2e/audit-production-quick.spec.ts -c playwright.audit.config.ts
 */

import { test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const AUDIT_EMAIL = 'sagar@sevenfincorp.email';
const AUDIT_PASSWORD = 'pass@123';

test('Quick audit: login, key routes, report', async ({ page }) => {
  test.setTimeout(180000);
  const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'https://lms.sevenfincorp.com';
  const routeResults: { route: string; status: string; note?: string }[] = [];
  const linkResults: { from: string; link: string; status: string; note?: string }[] = [];
  let userRole = '';

  await page.goto(`${baseURL}/login`, { waitUntil: 'load', timeout: 20000 });
  const emailInput = page.getByTestId('login-username').or(page.getByPlaceholder(/enter your email/i)).first();
  await emailInput.waitFor({ state: 'visible', timeout: 15000 });
  await emailInput.fill(AUDIT_EMAIL);
  await page.getByTestId('login-password').or(page.getByPlaceholder(/password/i)).first().fill(AUDIT_PASSWORD);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL(/\/(dashboard|applications|login)/, { timeout: 20000 });

  if (page.url().includes('/login')) {
    const err = await page.locator('.login-error, [role="alert"]').first().textContent().catch(() => 'Unknown');
    routeResults.push({ route: 'POST /login', status: 'error', note: String(err) });
  } else {
    routeResults.push({ route: '/login', status: 'ok' });
    await page.waitForLoadState('domcontentloaded');
    const roleEl = page.locator('aside p').last();
    const roleText = (await roleEl.textContent())?.trim() || '';
    const roleMap: Record<string, string> = { 'Key Account Manager': 'kam', 'Client': 'client', 'Credit Team': 'credit_team', 'NBFC Partner': 'nbfc' };
    userRole = roleMap[roleText] || roleText.toLowerCase().replace(/\s+/g, '_') || 'unknown';
    routeResults.push({ route: '/dashboard', status: 'ok', note: `Role: ${userRole} (${roleText})` });
  }

  const keyRoutes = ['/', '/applications', '/clients', '/profile', '/forgot-password', '/foo'];
  for (const routePath of keyRoutes) {
    await page.goto(`${baseURL}${routePath}`, { waitUntil: 'domcontentloaded', timeout: 8000 }).catch(() => {});
    const url = page.url();
    if (routePath === '/' && url.includes('/dashboard')) {
      routeResults.push({ route: '/', status: 'redirect', note: '→ /dashboard' });
      continue;
    }
    if (routePath === '/foo') {
      routeResults.push({ route: '/foo', status: url.includes('/dashboard') ? 'redirect' : 'ok', note: url.includes('/dashboard') ? '→ /dashboard (catch-all)' : url });
      continue;
    }
    if (routePath === '/forgot-password') {
      routeResults.push({ route: routePath, status: url.includes('forgot-password') ? 'ok' : 'redirect', note: url.includes('forgot-password') ? undefined : `→ ${url}` });
      continue;
    }
    const hasUnauthorized = await page.getByText(/unauthorized|don't have permission/i).first().isVisible().catch(() => false);
    const hasMain = await page.locator('main').first().isVisible().catch(() => false);
    if (hasUnauthorized) routeResults.push({ route: routePath, status: 'unauthorized' });
    else if (hasMain || url.includes(routePath)) routeResults.push({ route: routePath, status: 'ok' });
    else routeResults.push({ route: routePath, status: 'redirect', note: url });
  }

  const writeReport = (suffix = '') => {
    const flagged: string[] = [];
    routeResults.forEach((r) => { if (r.status === 'error' || r.status === 'blank') flagged.push(`Route ${r.route}: ${r.status}${r.note ? ` (${r.note})` : ''}`); });
    linkResults.forEach((l) => { if (l.status === 'broken' || l.status === 'placeholder') flagged.push(`Link ${l.from} → ${l.link}: ${l.status}${l.note ? ` (${l.note})` : ''}`); });
    const report = `# LMS Functionality Audit Report${suffix ? ` ${suffix}` : ''}

**Target:** https://lms.sevenfincorp.com  
**User:** ${AUDIT_EMAIL}  
**Role observed:** ${userRole}  
**Date:** ${new Date().toISOString().slice(0, 10)}

## 1. Route coverage

| Route | Status | Note |
|-------|--------|------|
${routeResults.map((r) => `| ${r.route} | ${r.status} | ${r.note || '-'} |`).join('\n')}

## 2. In-app links tested

| From | Link | Status | Note |
|------|------|--------|------|
${linkResults.map((l) => `| ${l.from} | ${l.link} | ${l.status} | ${l.note || '-'} |`).join('\n')}

## 3. Flagged items

${flagged.length ? flagged.map((f) => `- ${f}`).join('\n') : '- None (from this run).'}

## 4. Pre-audit findings (from plan)

- **Footer:** Privacy Policy, Terms of Service, Support are placeholders (href="#", alert "Coming soon!") – non-functional.
- **Form Configuration:** Not in sidebar for KAM; only via KAM Dashboard button.
- **Catch-all:** Invalid paths redirect to /dashboard (no dedicated 404 page).
`;
    fs.writeFileSync(path.join(process.cwd(), 'AUDIT_REPORT.md'), report, 'utf8');
  };

  writeReport('(after routes)');

  try {
    await page.goto(`${baseURL}/login`, { waitUntil: 'domcontentloaded', timeout: 6000 });
    const forgotLink = page.locator('a:has-text("Forgot password")').first();
    if (await forgotLink.isVisible({ timeout: 1500 })) {
      await forgotLink.click();
      await page.waitForLoadState('domcontentloaded');
      linkResults.push({ from: 'Login', link: 'Forgot password?', status: page.url().includes('forgot-password') ? 'ok' : 'broken' });
    }
  } catch (_) {}

  try {
    await page.goto(`${baseURL}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 6000 });
    const footerPrivacy = page.locator('footer a:has-text("Privacy Policy")').first();
    if (await footerPrivacy.isVisible({ timeout: 1500 })) {
      page.once('dialog', (d) => d.accept());
      await footerPrivacy.click();
      await page.waitForTimeout(150);
      linkResults.push({ from: 'Footer', link: 'Privacy Policy', status: 'placeholder', note: 'Shows "Coming soon!" alert' });
    }
  } catch (_) {}

  writeReport();
});
