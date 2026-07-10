import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  getSubmitBlockers,
  shouldPromptKamWait,
  SubmitReadinessPanel,
} from '../SubmitReadinessPanel';

describe('SubmitReadinessPanel helpers', () => {
  it('lists stage and compliance blockers', () => {
    const blockers = getSubmitBlockers(
      {
        isComplete: false,
        errors: {},
        missingByStage: [
          { stageId: 'insurance', stageTitle: 'Insurance', fieldLabels: ['Insurance Provider'] },
        ],
      },
      { 'compliance.vkycDone': 'VKYC done must be confirmed before submitting' },
      {}
    );

    expect(blockers).toContain('Insurance: Insurance Provider');
    expect(blockers).toContain('VKYC done must be confirmed before submitting');
  });

  it('prompts KAM wait when compliance is pending', () => {
    expect(
      shouldPromptKamWait(
        { 'compliance.vkycDone': 'VKYC done must be confirmed before submitting' },
        {}
      )
    ).toBe(true);
    expect(shouldPromptKamWait({}, { 'compliance.vkycDone': false })).toBe(true);
    expect(shouldPromptKamWait({}, { 'compliance.vkycDone': 'true' })).toBe(false);
  });
});

describe('SubmitReadinessPanel', () => {
  it('shows blockers and save-draft guidance when submit is blocked', () => {
    render(
      <SubmitReadinessPanel
        canSubmit={false}
        completion={{
          isComplete: false,
          errors: {},
          missingByStage: [
            { stageId: 'insurance', stageTitle: 'Insurance', fieldLabels: ['Policy Number'] },
          ],
        }}
        complianceErrors={{
          'compliance.vkycDone': 'VKYC done must be confirmed before submitting',
        }}
        formData={{ '_meta.doRequest.fulfilledAt': '2026-01-02T00:00:00.000Z' }}
      />
    );

    expect(screen.getByTestId('submit-readiness-panel')).toBeInTheDocument();
    expect(screen.getByText(/What's blocking submit/i)).toBeInTheDocument();
    expect(screen.getByText(/Insurance: Policy Number/)).toBeInTheDocument();
    expect(screen.getByText(/VKYC done must be confirmed/i)).toBeInTheDocument();
    expect(screen.getByTestId('submit-readiness-save-draft-prompt')).toHaveTextContent(
      /Save draft to keep your Insurance and Vehicle details while your KAM completes compliance/i
    );
  });

  it('shows ready message when submit is allowed', () => {
    render(
      <SubmitReadinessPanel
        canSubmit={true}
        completion={{ isComplete: true, errors: {}, missingByStage: [] }}
        complianceErrors={{}}
        formData={{}}
      />
    );

    expect(screen.getByText(/You can submit the application/i)).toBeInTheDocument();
  });
});
