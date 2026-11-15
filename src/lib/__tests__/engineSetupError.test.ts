import { describe, expect, it } from 'vitest';
import { formatEngineSetupError } from '../engineSetupError';
import { EngineRequestError } from '../../services/engineClient';

describe('formatEngineSetupError', () => {
  it('maps Forbidden to plain setup message with table name', () => {
    const err = new EngineRequestError(
      'Forbidden - perhaps check your credentials?',
      200,
      { ok: false, state: 'AIRTABLE_ERROR', error: 'Forbidden - perhaps check your credentials?' }
    );
    expect(formatEngineSetupError(err, 'VKYC Links')).toBe(
      'Setup problem: the VKYC Links table is missing or not writable. Contact support.'
    );
  });

  it('maps Forbidden substring in plain Error', () => {
    expect(formatEngineSetupError(new Error('AIRTABLE Forbidden'), 'KAM Flags')).toBe(
      'Setup problem: the KAM Flags table is missing or not writable. Contact support.'
    );
  });

  it('passes through non-Forbidden messages', () => {
    expect(formatEngineSetupError(new Error('Network down'), 'VKYC Links')).toBe('Network down');
  });
});
