# Test Setup Guide

This document explains how to run tests for the Seven Dashboard project.

## Test Infrastructure

The project uses three test frameworks:

1. **Jest** - Backend API tests (Node.js/Express/TypeScript)
2. **Vitest** - Frontend component tests (React/TypeScript)
3. **Playwright** - End-to-end tests (Browser automation)

---

## Backend Tests (Jest)

### Setup

Backend tests use Jest with TypeScript support via `ts-jest`.

**Location:** `backend/`

**Configuration:** `backend/jest.config.js`

### Running Tests

```bash
# Run all backend tests
cd backend
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Test File Structure

Backend tests should be placed in:
- `backend/src/**/__tests__/*.test.ts`
- `backend/src/**/*.test.ts`
- `backend/src/**/*.spec.ts`

### Example Test

```typescript
import { describe, it, expect } from '@jest/globals';

describe('MyController', () => {
  it('should do something', () => {
    expect(true).toBe(true);
  });
});
```

---

## Frontend Tests (Vitest)

### Setup

Frontend tests use Vitest, which integrates seamlessly with Vite.

**Location:** Root directory (`src/`)

**Configuration:** `vite.config.ts` (test section)

**Setup File:** `src/test/setup.ts`

### Running Tests

```bash
# Run all frontend tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

### Test File Structure

Frontend tests should be placed in:
- `src/**/*.test.{ts,tsx}`
- `src/**/*.spec.{ts,tsx}`

### Example Test

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

---

## End-to-End Tests (Playwright)

### Setup

E2E tests use Playwright for browser automation.

**Location:** `e2e/`

**Configuration:** `playwright.config.ts`

### Running Tests

```bash
# Run all E2E tests (from project root)
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui

# Run E2E tests in headed mode (see browser)
npm run test:e2e:headed
```

### Test File Structure

E2E tests should be placed in:
- `e2e/**/*.spec.ts`

### Example Test

```typescript
import { test, expect } from '@playwright/test';

test('user can login', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[name="email"]', 'test@example.com');
  await page.fill('input[name="password"]', 'password123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/dashboard');
});
```

### Prerequisites

Before running E2E tests, ensure:
1. Frontend dev server is running (`npm run dev`)
2. Backend dev server is running (`cd backend && npm run dev`)

Playwright will automatically start these servers if they're not running.

---

## Test Scripts Summary

### Backend (`backend/package.json`)

| Script | Command | Description |
|--------|---------|-------------|
| `test` | `jest` | Run all backend tests |
| `test:watch` | `jest --watch` | Run tests in watch mode |
| `test:coverage` | `jest --coverage` | Run tests with coverage report |

### Frontend (`package.json`)

| Script | Command | Description |
|--------|---------|-------------|
| `test` | `vitest run` | Run all frontend tests |
| `test:watch` | `vitest` | Run tests in watch mode |
| `test:ui` | `vitest --ui` | Run tests with UI |
| `test:coverage` | `vitest run --coverage` | Run tests with coverage |

### E2E (`package.json`)

| Script | Command | Description |
|--------|---------|-------------|
| `test:e2e` | `playwright test` | Run all E2E tests |
| `test:e2e:ui` | `playwright test --ui` | Run E2E tests with UI |
| `test:e2e:headed` | `playwright test --headed` | Run E2E tests in headed mode |

---

## Coverage Reports

### Backend Coverage

After running `npm run test:coverage` in the backend directory:
- HTML report: `backend/coverage/index.html`
- LCOV report: `backend/coverage/lcov.info`

### Frontend Coverage

After running `npm run test:coverage`:
- HTML report: `coverage/index.html`
- JSON report: `coverage/coverage-final.json`

---

## CI/CD Integration

### Running All Tests

In CI/CD pipelines, you can run all tests sequentially:

```bash
# Backend tests
cd backend && npm test

# Frontend tests
npm test

# E2E tests (requires servers running)
npm run test:e2e
```

### Test Environment Variables

For E2E tests, you can set:
- `PLAYWRIGHT_TEST_BASE_URL` - Override the base URL (default: `http://localhost:8000`)

---

## Troubleshooting

### Jest ES Module Issues

If you encounter ES module import errors with Jest:
1. Ensure `jest.config.js` uses `ts-jest/presets/default-esm`
2. Check that `package.json` has `"type": "module"`
3. Verify imports use `.js` extension in test files

### Vitest Not Finding Tests

If Vitest doesn't find your tests:
1. Check that test files match the pattern in `vite.config.ts`
2. Ensure test files are in `src/` directory
3. Verify file extensions are `.test.ts` or `.spec.ts`

### Playwright Browser Issues

If Playwright can't launch browsers:
1. Run `npx playwright install` to install browsers
2. Check that you have required system dependencies
3. See [Playwright installation guide](https://playwright.dev/docs/intro#installation)

---

## Next Steps

1. **Write Backend Tests**: Start with controller tests using Supertest
2. **Write Frontend Tests**: Start with component tests using React Testing Library
3. **Write E2E Tests**: Start with critical user flows (login, create application, etc.)

Refer to `docs/test-plan-P0.md` for test case specifications.

