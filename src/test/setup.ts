/**
 * Vitest Setup File
 * Global test configuration and mocks
 */

import '@testing-library/jest-dom';
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Extend Vitest's expect with jest-dom matchers
// This is handled by @testing-library/jest-dom import above

