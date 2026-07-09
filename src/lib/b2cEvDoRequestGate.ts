import {
  areAllComplianceItemsApproved,
  getApprovedComplianceCount,
  getPendingComplianceLabels,
  COMPLIANCE_ITEMS,
} from './b2cEvCompliance';
import {
  getRequiredDocumentReadiness,
  type FormConfigCategory,
  validateB2cEvDocumentsReadyForDo,
} from './b2cEvDocuments';
import { validateGeoPhotosStage } from './b2cEvGeoPhotos';
import { isDoFulfilled, isDoRequested } from './b2cEvDoRequest';

export interface DoRequestReadiness {
  complianceApprovedCount: number;
  complianceTotal: number;
  documentsAddedCount: number;
  documentsRequiredCount: number;
  doRequested: boolean;
  doFulfilled: boolean;
  blockers: string[];
  canRequestDo: boolean;
}

export function getDoRequestBlockers(
  formData: Record<string, unknown>,
  formConfig: FormConfigCategory[]
): string[] {
  const blockers: string[] = [];

  const geoErrors = validateGeoPhotosStage(formData);
  if (Object.keys(geoErrors).length > 0) {
    blockers.push('Complete all geo-tagged photos with location data');
  }

  if (!areAllComplianceItemsApproved(formData)) {
    const pending = getPendingComplianceLabels(formData);
    blockers.push(
      `KAM must approve all compliance items (${getApprovedComplianceCount(formData)}/${COMPLIANCE_ITEMS.length} done${
        pending.length > 0 ? `: pending ${pending.join(', ')}` : ''
      })`
    );
  }

  if (formConfig.length > 0) {
    const documentErrors = validateB2cEvDocumentsReadyForDo(formData, formConfig);
    if (Object.keys(documentErrors).length > 0) {
      blockers.push('Mark every required upload as “Yes, Added to Folder” and confirm the folder link');
    }
  }

  if (isDoRequested(formData)) {
    blockers.push('DO request already sent to KAM');
  }

  return blockers;
}

export function getDoRequestReadiness(
  formData: Record<string, unknown>,
  formConfig: FormConfigCategory[]
): DoRequestReadiness {
  const documentReadiness = getRequiredDocumentReadiness(formData, formConfig);
  const blockers = getDoRequestBlockers(formData, formConfig);

  return {
    complianceApprovedCount: getApprovedComplianceCount(formData),
    complianceTotal: COMPLIANCE_ITEMS.length,
    documentsAddedCount: documentReadiness.addedToFolderCount,
    documentsRequiredCount: documentReadiness.requiredCount,
    doRequested: isDoRequested(formData),
    doFulfilled: isDoFulfilled(formData),
    blockers,
    canRequestDo: blockers.length === 0,
  };
}
