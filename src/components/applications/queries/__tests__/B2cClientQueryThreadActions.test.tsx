import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { B2cClientQueryThreadActions } from '../B2cClientQueryThreadActions';
import { apiService } from '../../../../services/api';

vi.mock('../../../../services/api', () => ({
  apiService: {
    replyToQuery: vi.fn(),
  },
}));

describe('B2cClientQueryThreadActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows Mark complete for unresolved compliance query', () => {
    render(
      <B2cClientQueryThreadActions
        applicationId="app-1"
        queryId="QUERY-1"
        rootQuery={{
          actionEventType: 'client_query_b2c_compliance_vkyc',
          message: 'Please complete VKYC for the borrower.',
        }}
        formData={{ 'compliance.vkycDone': false }}
        userRole="kam"
        isResolved={false}
        onUpdated={vi.fn()}
      />
    );

    expect(screen.getByTestId('b2c-query-action-fulfill-vkyc')).toBeInTheDocument();
  });

  it('calls replyToQuery with b2cFulfillment when Mark complete clicked', async () => {
    (apiService.replyToQuery as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
    const onUpdated = vi.fn();
    const user = userEvent.setup();

    render(
      <B2cClientQueryThreadActions
        applicationId="app-1"
        queryId="QUERY-1"
        rootQuery={{
          actionEventType: 'client_query_b2c_compliance_vkyc',
          message: 'Please complete VKYC for the borrower.',
        }}
        formData={{ 'compliance.vkycDone': false }}
        userRole="kam"
        isResolved={false}
        onUpdated={onUpdated}
      />
    );

    await user.click(screen.getByTestId('b2c-query-action-fulfill-vkyc'));

    expect(apiService.replyToQuery).toHaveBeenCalledWith('app-1', 'QUERY-1', '', {
      b2cFulfillment: { action: 'compliance_fulfill', itemId: 'vkyc' },
    });
    expect(onUpdated).toHaveBeenCalled();
  });
});
