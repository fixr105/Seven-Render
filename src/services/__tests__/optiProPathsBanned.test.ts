import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import * as engineClient from '../engineClient';

const BANNED = [
  '/engine/order-stamp',
  '/engine/initiate-signing',
  '/engine/edrafter-status',
] as const;

describe('Opti Pro stamp/sign paths banned', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      for (const path of BANNED) {
        if (url.includes(path)) {
          throw new Error(`Banned Opti Pro path requested: ${path}`);
        }
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('does not export orderStamp, initiateSigning, or edrafterStatus', () => {
    const mod = engineClient as Record<string, unknown>;
    expect(mod.orderStamp).toBeUndefined();
    expect(mod.initiateSigning).toBeUndefined();
    expect(mod.edrafterStatus).toBeUndefined();
  });

  it('fails if any code path fetches a banned Opti Pro URL', async () => {
    await expect(
      globalThis.fetch('/engine/order-stamp', { method: 'POST', body: '{}' })
    ).rejects.toThrow(/Banned Opti Pro path/);
    await expect(
      globalThis.fetch('/engine/initiate-signing', { method: 'POST', body: '{}' })
    ).rejects.toThrow(/Banned Opti Pro path/);
    await expect(
      globalThis.fetch('/engine/edrafter-status?loanId=x')
    ).rejects.toThrow(/Banned Opti Pro path/);
  });
});
