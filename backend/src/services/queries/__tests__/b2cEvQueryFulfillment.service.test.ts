import { describe, expect, it } from '@jest/globals';
import {
  buildB2cClientQueryActionEventType,
  buildB2cFulfillmentPatch,
  buildB2cFulfillmentReplyMessage,
  getQueryReplyTarget,
  isB2cClientQueryActionEventType,
  isResolvableB2cClientQuery,
  parseB2cQueryFromAuditEntry,
} from '../b2cEvQueryFulfillment.service.js';

describe('b2cEvQueryFulfillment.service', () => {
  it('builds typed action event types', () => {
    expect(buildB2cClientQueryActionEventType('b2c_do')).toBe('client_query_b2c_do');
    expect(buildB2cClientQueryActionEventType('b2c_compliance', 'vkyc')).toBe(
      'client_query_b2c_compliance_vkyc'
    );
    expect(buildB2cClientQueryActionEventType()).toBe('client_query');
  });

  it('builds compliance and DO fulfillment patches', () => {
    const compliancePatch = buildB2cFulfillmentPatch('compliance_fulfill', 'vkyc');
    expect(compliancePatch['compliance.vkycDone']).toBe('true');

    const doPatch = buildB2cFulfillmentPatch('do_fulfill');
    expect(doPatch['_meta.doRequest.fulfilledAt']).toBeTruthy();
  });

  it('routes KAM replies on client B2C queries back to client', () => {
    const target = getQueryReplyTarget(
      {
        actionEventType: 'client_query_b2c_compliance_vkyc',
        targetUserRole: 'kam',
        actor: 'client@test.local',
      },
      'kam'
    );
    expect(target).toBe('client');
  });

  it('routes KAM replies on credit queries to credit_team', () => {
    const target = getQueryReplyTarget(
      {
        actionEventType: 'credit_query',
        targetUserRole: 'kam',
        actor: 'credit@test.local',
      },
      'kam'
    );
    expect(target).toBe('credit_team');
  });

  it('identifies resolvable B2C client queries', () => {
    expect(isResolvableB2cClientQuery('client_query_b2c_do', 'kam')).toBe(true);
    expect(isResolvableB2cClientQuery('client_query', 'kam')).toBe(true);
    expect(isResolvableB2cClientQuery('query_raised', 'client')).toBe(false);
  });

  it('parses legacy client_query messages', () => {
    const parsed = parseB2cQueryFromAuditEntry({
      actionEventType: 'client_query',
      message: 'Please complete VKYC for the borrower (application rec-1).',
    });
    expect(parsed?.kind).toBe('compliance');
    expect(parsed && parsed.kind === 'compliance' ? parsed.itemId : null).toBe('vkyc');
  });

  it('builds fulfillment reply messages', () => {
    expect(buildB2cFulfillmentReplyMessage('do_fulfill')).toContain('DO');
    expect(buildB2cFulfillmentReplyMessage('compliance_fulfill', 'enach')).toContain('eNACH');
  });

  it('detects B2C client query action types', () => {
    expect(isB2cClientQueryActionEventType('client_query_b2c_do')).toBe(true);
    expect(isB2cClientQueryActionEventType('client_query')).toBe(true);
    expect(isB2cClientQueryActionEventType('query_raised')).toBe(false);
  });
});
