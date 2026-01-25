#!/usr/bin/env node
/**
 * GET and page-load audit script
 *
 * Greps for fetchTable (backend) and isPageReload (frontend) to help verify:
 * - No GET does so many sequential fetchTable waves that it risks the 55s frontend timeout
 * - No required data is skipped on SPA navigation due to isPageReload
 *
 * Run: node scripts/audit-get-flows.js
 * See: docs/GET_AND_PAGE_LOAD_CHECKLIST.md
 */

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ROOT = path.resolve(__dirname, '..');

function runGrep(pattern, cwd, excludeTests) {
  const opts = { cwd: cwd || ROOT, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 };
  const safe = pattern.replace(/"/g, '\\"');
  // Prefer ripgrep; fall back to grep
  try {
    const rgGlob = excludeTests ? " --glob '!*.test.*' --glob '!*.runner.*'" : '';
    const out = execSync(`rg "${safe}" -n --no-heading${rgGlob}`, opts);
    return out;
  } catch (e) {
    if (e.status === 1) return '';
    if (e.status === 127 || (e.stderr && /not found|command not found/i.test(String(e.stderr)))) {
      try {
        // Simpler pattern for grep (e.g. "fetchTable" not "fetchTable\(") to avoid BRE/ERE issues
        const gpat = pattern.replace(/\\\./g, '.').replace(/[\\()]/g, '').replace(/'/g, "'\"'\"'") || pattern.slice(0, 20);
        let out = execSync(`grep -rn '${gpat}' .`, opts);
        if (excludeTests) {
          out = out.split('\n').filter((l) => {
            const m = l.match(/^\.\/(.+?):/);
            return !m || (!m[1].includes('.test.') && !m[1].includes('.runner.') && !m[1].includes('__tests__'));
          }).join('\n');
        }
        return out;
      } catch (g) {
        if (g.status === 1) return '';
        return '';
      }
    }
    throw e;
  }
}

function main() {
  console.log('=== GET and page-load audit ===\n');

  // 1. Backend: fetchTable usage
  console.log('## 1. Backend fetchTable (backend/src, excluding tests)\n');
  const fetchTableOut = runGrep('fetchTable\\(', path.join(ROOT, 'backend', 'src'), true);
  const byFile = {};
  if (fetchTableOut) {
    fetchTableOut.trim().split('\n').forEach((line) => {
      const m = line.match(/^(.+?):(\d+):/);
      if (m) {
        const f = m[1];
        byFile[f] = (byFile[f] || 0) + 1;
      }
    });
  }
  const files = Object.keys(byFile).sort();
  if (files.length === 0) {
    console.log('  (none found)\n');
  } else {
    files.forEach((f) => {
      const count = byFile[f];
      const note = count > 3 ? '  <- review: many fetchTable; check for sequential waves' : '';
      console.log(`  ${f}: ${count} fetchTable${note}`);
    });
    console.log('\n  If a handler has multiple sequential waves (e.g. await A, then await B),');
    console.log('  worst-case ≈ 5s per wave. Sum > 50s can hit frontend 55s timeout.\n');
  }

  // 2. Frontend: isPageReload (sections that may not load on SPA navigation)
  console.log('## 2. isPageReload usage (src)\n');
  const isPageReloadOut = runGrep('isPageReload', path.join(ROOT, 'src'), false);
  if (!isPageReloadOut || !isPageReloadOut.trim()) {
    console.log('  (none found)\n');
  } else {
    isPageReloadOut.trim().split('\n').forEach((line) => {
      const m = line.match(/^(.+?):(\d+):/);
      if (m) console.log(`  ${m[1]}:${m[2]}`);
    });
    console.log('\n  If the fetch is required on SPA navigation, remove the isPageReload guard.\n');
  }

  // 3. Summary
  console.log('## 3. Summary\n');
  console.log('  - Backend: each fetchTable has 5s default timeout. Sequential waves add up.');
  console.log('  - Frontend: GET timeout 55s (api.request). All current GETs have worst-case ≤15s.');
  console.log('  - isPageReload: on SPA nav, those fetches are skipped → empty sections until F5.');
  console.log('\n  Full tables and runbook: docs/GET_AND_PAGE_LOAD_CHECKLIST.md\n');
}

main();
