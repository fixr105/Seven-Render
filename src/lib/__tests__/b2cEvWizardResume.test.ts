import { describe, expect, it } from 'vitest';
import {
  buildWizardResumePath,
  buildWizardResumeSearchParams,
  patchWizardStepMeta,
  resolveWizardResumeStepIndex,
  WIZARD_LAST_STAGE_ID_KEY,
} from '../b2cEvWizardResume';

describe('b2cEvWizardResume', () => {
  it('builds resume URL with saved stage id', () => {
    const params = buildWizardResumeSearchParams('draft-1', {
      [WIZARD_LAST_STAGE_ID_KEY]: 'geo-photos',
    });
    expect(params.get('draftId')).toBe('draft-1');
    expect(params.get('stage')).toBe('geo-photos');
    expect(buildWizardResumePath('draft-1', { [WIZARD_LAST_STAGE_ID_KEY]: 'geo-photos' })).toBe(
      '/applications/new?draftId=draft-1&stage=geo-photos'
    );
  });

  it('resolves saved stage index for visible stages', () => {
    const stages = [{ id: 'product' }, { id: 'geo-photos' }, { id: 'vehicle' }];
    expect(
      resolveWizardResumeStepIndex({ [WIZARD_LAST_STAGE_ID_KEY]: 'geo-photos' }, stages)
    ).toBe(1);
  });

  it('opens the upload step for an older draft that never stored a stage', () => {
    const form = {
      '_meta.pricing': { roi_pct: 28 },
      '_meta.postSubmitPhase': 'post_offer',
      '_meta.kycDocuments.uploads': {
        pan_card: { url: 'https://cdn.example/pan.jpg', filename: 'pan.jpg' },
        aadhaar_front: { url: 'https://cdn.example/aadhaar.jpg', filename: 'aadhaar.jpg' },
      },
    };
    const stages = [{ id: 'product' }, { id: 'borrower' }, { id: 'kyc-documents' }];
    expect(buildWizardResumeSearchParams('draft-old', form).get('stage')).toBe('kyc-documents');
    expect(resolveWizardResumeStepIndex(form, stages)).toBe(2);
  });

  it('persists wizard step metadata as 1-indexed step', () => {
    const patched = patchWizardStepMeta({}, 'geo-photos', 5);
    expect(patched['_meta.wizard.lastStageId']).toBe('geo-photos');
    expect(patched['_meta.wizard.lastStep']).toBe('6');
  });
});
