/**
 * Full functionality audit for lms.sevenfincorp.com
 * Credentials: sagar@sevenfincorp.email / pass@123
 * Run: PLAYWRIGHT_TEST_BASE_URL=https://lms.sevenfincorp.com npx playwright test e2e/audit-production.spec.ts -c playwright.audit.config.ts
 */

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const AUDIT_EMAIL = 'sagar@sevenfincorp.email';
const AUDIT_PASSWORD = 'pass@123';

type RouteStatus = 'ok' | 'redirect' | 'error' | 'unauthorized' | 'blank';
interface RouteResult {
  route: string;
  status: RouteStatus;
  note?: string;
}
interface LinkResult {
  from: string;
  link: string;
  status: 'ok' | 'broken' | 'placeholder';
  note?: string;
}

test.describe.serial('Production audit – lms.sevenfincorp.com', () => {
  const routeResults: RouteResult[] = [];
  const linkResults: LinkResult[] = [];
  let userRole = '';

  function reportRoute(route: string, status: RouteStatus, note?: string) {
    routeResults.push({ route, status, note });
  }
  function reportLink(from: string, link: string, status: 'ok' | 'broken' | 'placeholder', note?: string) {
    linkResults.push({ from, link, status, note });
  }

  function writeReport(suffix = '') {
    const flagged: string[] = [];
    routeResults.forEach((r) => {
      if (r.status === 'error' || r.status === 'blank') flagged.push(`Route ${r.route}: ${r.status}${r.note ? ` (${r.note})` : ''}`);
    });
    linkResults.forEach((l) => {
      if (l.status === 'broken' || l.status === 'placeholder') flagged.push(`Link ${l.from} → ${l.link}: ${l.status}${l.note ? ` (${l.note})` : ''}`);
    });
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
  }

  test('Full audit: login, routes, links, report', async ({ page }) => {
    test.setTimeout(240000);
    const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'https://lms.sevenfincorp.com';

    await page.goto(`${baseURL}/login`, { waitUntil: 'load', timeout: 60000 });
    const emailInput = page.getByTestId('login-username').or(page.getByPlaceholder(/enter your email/i)).first();
    await emailInput.waitFor({ state: 'visible', timeout: 15000 });
    const passwordInput = page.getByTestId('login-password').or(page.getByPlaceholder(/password/i)).first();
    await emailInput.fill(AUDIT_EMAIL);
    await passwordInput.fill(AUDIT_PASSWORD);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForURL(/\/(dashboard|applications|login)/, { timeout: 20000 });

    if (page.url().includes('/login')) {
      const err = await page.locator('.login-error, [role="alert"]').first().textContent().catch(() => 'Unknown');
      reportRoute('POST /login', 'error', String(err));
    } else {
      reportRoute('/login', 'ok');
      await page.waitForLoadState('networkidle');
      const roleEl = page.locator('aside p').last();
      const roleText = (await roleEl.textContent())?.trim() || '';
      const roleMap: Record<string, string> = { 'Key Account Manager': 'kam', 'Client': 'client', 'Credit Team': 'credit_team', 'NBFC Partner': 'nbfc' };
      userRole = roleMap[roleText] || roleText.toLowerCase().replace(/\s+/g, '_') || 'unknown';
      reportRoute('/dashboard', 'ok', `Role: ${userRole} (${roleText})`);
    }

    const routes: { path: string; expectUnauthorized?: boolean }[] = [
      { path: '/' },
      { path: '/dashboard' },
      { path: '/applications' },
      { path: '/applications/new', expectUnauthorized: userRole !== 'client' },
      { path: '/ledger', expectUnauthorized: !['client', 'credit_team'].includes(userRole) },
      { path: '/clients', expectUnauthorized: !['kam', 'credit_team'].includes(userRole) },
      { path: '/profile' },
      { path: '/settings' },
      { path: '/reports' },
      { path: '/form-configuration', expectUnauthorized: !['credit_team', 'admin'].includes(userRole) },
      { path: '/unauthorized' },
      { path: '/forgot-password' },
      { path: '/foo' },
    ];

    for (const { path: routePath, expectUnauthorized } of routes) {
      await page.goto(`${baseURL}${routePath}`, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
      await page.waitForLoadState('domcontentloaded');
      const url = page.url();
      const isRedirect = routePath !== '/' && routePath !== '/foo' && !url.replace(/\/$/, '').endsWith(routePath);
      if (routePath === '/' && url.includes('/dashboard')) {
        reportRoute('/', 'redirect', '→ /dashboard');
        continue;
      }
      if (routePath === '/foo') {
        reportRoute('/foo', url.includes('/dashboard') ? 'redirect' : 'ok', url.includes('/dashboard') ? '→ /dashboard (catch-all)' : url);
        continue;
      }
      if (routePath === '/forgot-password') {
        reportRoute(routePath, url.includes('forgot-password') ? 'ok' : 'redirect', url.includes('forgot-password') ? undefined : `→ ${url}`);
        continue;
      }
      const hasUnauthorized = await page.getByText(/unauthorized|don't have permission/i).first().isVisible().catch(() => false);
      const hasErrorToast = await page.locator('[role="alert"]').first().isVisible().catch(() => false);
      const hasMain = await page.locator('main').first().isVisible().catch(() => false);
      const hasDashboard = await page.locator('[class*="dashboard"], [class*="Dashboard"]').first().isVisible().catch(() => false);
      const hasContent = hasMain || hasDashboard;
      if (expectUnauthorized && hasUnauthorized) {
        reportRoute(routePath, 'unauthorized', 'expected for this role');
      } else if (hasErrorToast && routePath.includes('applications')) {
        reportRoute(routePath, 'error', 'UI error/toast');
      } else if (hasContent || (url.includes(routePath) && !hasUnauthorized)) {
        reportRoute(routePath, 'ok');
      } else if (isRedirect) {
        reportRoute(routePath, 'redirect', `→ ${url}`);
      } else {
        reportRoute(routePath, 'blank', url);
      }
    }
    writeReport('(after routes)');

    await page.goto(`${baseURL}/login`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    const emailInput2 = page.getByTestId('login-username').or(page.getByPlaceholder(/enter your email/i)).first();
    const passwordInput2 = page.getByTestId('login-password').or(page.getByPlaceholder(/password/i)).first();
    await emailInput2.fill(AUDIT_EMAIL);
    await passwordInput2.fill(AUDIT_PASSWORD);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForURL(/\/(dashboard|applications)/, { timeout: 20000 });
    if (page.url().includes('/login')) {
      fs.writeFileSync(
        path.join(process.cwd(), 'AUDIT_REPORT.md'),
        `# LMS Audit Report\n\nLogin failed; route/link audit skipped.\n\nRoute results:\n${routeResults.map((r) => `- ${r.route}: ${r.status}${r.note ? ` (${r.note})` : ''}`).join('\n')}`,
        'utf8'
      );
      return;
    }
    await page.waitForLoadState('domcontentloaded');

    const sidebarButtons = page.locator('aside button, nav button').filter({ hasText: /^(Dashboard|Applications|Ledger|Clients|Reports|Settings)$/ });
    const navCount = Math.min(await sidebarButtons.count(), 5);
    for (let i = 0; i < navCount; i++) {
      const btn = sidebarButtons.nth(i);
      const text = (await btn.textContent())?.trim() || '';
      await btn.click();
      await page.waitForLoadState('domcontentloaded');
      const url = page.url();
      const ok = !url.includes('/login') && (await page.locator('main').first().isVisible().catch(() => false));
      reportLink('Sidebar', text, ok ? 'ok' : 'broken', url);
    }

    await page.goto(`${baseURL}/dashboard`, { waitUntil: 'domcontentloaded' });
    const quickButtons = page.locator('main button').filter({ hasText: /View all|New Application|Applications|Clients|Ledger|Form Configuration|Configure Client Forms/ });
    const qCount = await quickButtons.count();
    for (let i = 0; i < Math.min(qCount, 3); i++) {
      const text = (await quickButtons.nth(i).textContent())?.trim() || '';
      await quickButtons.nth(i).click();
      await page.waitForLoadState('domcontentloaded');
      const url = page.url();
      const ok = url.includes('/applications') || url.includes('/clients') || url.includes('/ledger') || url.includes('/form-configuration');
      reportLink('Dashboard', text, ok ? 'ok' : 'broken', url);
      await page.goto(`${baseURL}/dashboard`, { waitUntil: 'domcontentloaded' });
    }

    await page.goto(`${baseURL}/login`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    const forgotLink = page.locator('a:has-text("Forgot password")').first();
    if (await forgotLink.isVisible({ timeout: 2000 })) {
      await forgotLink.click();
      await page.waitForLoadState('domcontentloaded');
      reportLink('Login', 'Forgot password?', page.url().includes('forgot-password') ? 'ok' : 'broken');
    }

    await page.goto(`${baseURL}/dashboard`, { waitUntil: 'domcontentloaded' });
    const footerPrivacy = page.locator('footer a:has-text("Privacy Policy")').first();
    if (await footerPrivacy.isVisible({ timeout: 2000 })) {
      page.once('dialog', (d) => d.accept());
      await footerPrivacy.click();
      await page.waitForTimeout(300);
      reportLink('Footer', 'Privacy Policy', 'placeholder', 'Shows "Coming soon!" alert');
    }

    writeReport();
  });
});
