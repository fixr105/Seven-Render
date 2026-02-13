/**
 * Unit tests for query content parser utilities
 */

import { describe, it, expect } from '@jest/globals';
import {
  parseQueryContent,
  updateQueryStatus,
  buildQueryContent,
  isRootQuery,
  getParentId,
} from '../queryParser.js';

describe('parseQueryContent', () => {
  it('extracts parent, status, and message', () => {
    const content = '[[parent:rec123]][[status:open]] Please provide documents';
    const result = parseQueryContent(content);
    expect(result.parent).toBe('rec123');
    expect(result.status).toBe('open');
    expect(result.message).toBe('Please provide documents');
  });

  it('defaults status to open when missing', () => {
    const content = '[[parent:rec123]] Some message';
    const result = parseQueryContent(content);
    expect(result.status).toBe('open');
  });

  it('extracts resolved status', () => {
    const content = '[[status:resolved]] Query resolved';
    const result = parseQueryContent(content);
    expect(result.status).toBe('resolved');
  });

  it('handles content without metadata', () => {
    const content = 'Plain message only';
    const result = parseQueryContent(content);
    expect(result.parent).toBeUndefined();
    expect(result.status).toBe('open');
    expect(result.message).toBe('Plain message only');
  });
});

describe('updateQueryStatus', () => {
  it('replaces existing status tag with resolved', () => {
    const content = '[[status:open]] Original message';
    const result = updateQueryStatus(content, 'resolved');
    expect(result).toContain('[[status:resolved]]');
    expect(result).not.toContain('[[status:open]]');
  });

  it('adds status tag when missing', () => {
    const content = 'Message without status';
    const result = updateQueryStatus(content, 'resolved');
    expect(result).toContain('[[status:resolved]]');
    expect(result).toContain('Message without status');
  });

  it('replaces existing status tag with open', () => {
    const content = '[[status:resolved]] Resolved message';
    const result = updateQueryStatus(content, 'open');
    expect(result).toContain('[[status:open]]');
    expect(result).not.toContain('[[status:resolved]]');
  });
});

describe('buildQueryContent', () => {
  it('builds content with parent and status', () => {
    const result = buildQueryContent('Reply message', {
      parent: 'rec123',
      status: 'open',
    });
    expect(result).toContain('[[parent:rec123]]');
    expect(result).toContain('[[status:open]]');
    expect(result).toContain('Reply message');
  });

  it('defaults status to open when not provided', () => {
    const result = buildQueryContent('Message');
    expect(result).toContain('[[status:open]]');
  });

  it('omits parent when not provided', () => {
    const result = buildQueryContent('Root query');
    expect(result).not.toContain('[[parent:');
  });
});

describe('isRootQuery', () => {
  it('returns true when no parent tag', () => {
    expect(isRootQuery('[[status:open]] Message')).toBe(true);
    expect(isRootQuery('Plain message')).toBe(true);
  });

  it('returns false when parent tag present', () => {
    expect(isRootQuery('[[parent:rec123]][[status:open]] Reply')).toBe(false);
  });
});

describe('getParentId', () => {
  it('extracts parent ID', () => {
    expect(getParentId('[[parent:rec123]][[status:open]] Reply')).toBe('rec123');
  });

  it('returns null when no parent', () => {
    expect(getParentId('[[status:open]] Message')).toBe(null);
    expect(getParentId('Plain message')).toBe(null);
  });
});
