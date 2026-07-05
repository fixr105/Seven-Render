import React, { useState } from 'react';
import { Button } from '../../ui/Button';
import { isComplianceChecked, COMPLIANCE_ITEMS } from '../../../lib/b2cEvCompliance';
import {
  canKamFulfillB2cQuery,
  parseB2cQueryFromThread,
  type ParsedB2cQuery,
} from '../../../lib/b2cEvQueryActions';
import { apiService } from '../../../services/api';
import type { ComplianceItemId } from '../../../lib/b2cEvCompliance';

export interface B2cClientQueryThreadActionsProps {
  applicationId: string;
  queryId: string;
  rootQuery: {
    actionEventType?: string;
    message?: string;
  };
  formData: Record<string, unknown>;
  userRole?: string | null;
  isResolved: boolean;
  onUpdated: () => void;
}

export function getB2cThreadTitle(rootQuery: {
  actionEventType?: string;
  message?: string;
}): string | null {
  const parsed = parseB2cQueryFromThread(rootQuery);
  return parsed ? parsed.label : null;
}

export const B2cClientQueryThreadActions: React.FC<B2cClientQueryThreadActionsProps> = ({
  applicationId,
  queryId,
  rootQuery,
  formData,
  userRole,
  isResolved,
  onUpdated,
}) => {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  if (isResolved || !canKamFulfillB2cQuery(userRole)) {
    return null;
  }

  const parsed = parseB2cQueryFromThread(rootQuery);
  if (!parsed || parsed.kind === 'generic') {
    return null;
  }

  const runFulfillment = async (
    action: 'compliance_fulfill' | 'compliance_unmark' | 'do_fulfill',
    itemId?: ComplianceItemId
  ) => {
    const actionKey = itemId ? `${action}-${itemId}` : action;
    setLoadingAction(actionKey);
    try {
      const response = await apiService.replyToQuery(applicationId, queryId, '', {
        b2cFulfillment: { action, itemId },
      });
      if (!response.success) {
        throw new Error(response.error || 'Failed to update request');
      }
      onUpdated();
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Failed to update request');
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div
      className="mb-3 flex flex-wrap gap-2"
      data-testid={`b2c-query-thread-actions-${queryId}`}
    >
      {parsed.kind === 'compliance' && renderComplianceActions(parsed, formData, loadingAction, runFulfillment)}
      {parsed.kind === 'do' && (
        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={loadingAction != null}
          onClick={() => void runFulfillment('do_fulfill')}
          data-testid="b2c-query-action-do-fulfill"
        >
          {loadingAction === 'do_fulfill' ? 'Saving…' : 'Mark DO processed'}
        </Button>
      )}
    </div>
  );
};

function renderComplianceActions(
  parsed: Extract<ParsedB2cQuery, { kind: 'compliance' }>,
  formData: Record<string, unknown>,
  loadingAction: string | null,
  runFulfillment: (
    action: 'compliance_fulfill' | 'compliance_unmark' | 'do_fulfill',
    itemId?: ComplianceItemId
  ) => Promise<void>
) {
  const item = parsed.itemId;
  const complianceItem = COMPLIANCE_ITEMS.find((entry) => entry.id === item);
  const checked = complianceItem
    ? isComplianceChecked(formData, complianceItem.checkboxKey)
    : false;

  return (
    <>
      {!checked && (
        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={loadingAction != null}
          onClick={() => void runFulfillment('compliance_fulfill', item)}
          data-testid={`b2c-query-action-fulfill-${item}`}
        >
          {loadingAction === `compliance_fulfill-${item}` ? 'Saving…' : 'Mark complete'}
        </Button>
      )}
      {checked && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={loadingAction != null}
          onClick={() => void runFulfillment('compliance_unmark', item)}
          data-testid={`b2c-query-action-unmark-${item}`}
        >
          {loadingAction === `compliance_unmark-${item}` ? 'Saving…' : 'Unmark'}
        </Button>
      )}
    </>
  );
}
