import { UserContext } from './types';

export type ProfileRequiredField = 'name' | 'phone' | 'company';

export interface ProfileCompletionResult {
  isComplete: boolean;
  missingFields: ProfileRequiredField[];
}

const BASE_REQUIRED_FIELDS: ProfileRequiredField[] = ['name', 'phone'];
const COMPANY_REQUIRED_ROLES = new Set(['client', 'nbfc']);

function isFilled(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

export function getRequiredProfileFields(user: UserContext | null): ProfileRequiredField[] {
  if (!user) return [];
  const required = [...BASE_REQUIRED_FIELDS];
  if (COMPANY_REQUIRED_ROLES.has(user.role)) {
    required.push('company');
  }
  return required;
}

export function getProfileCompletion(user: UserContext | null): ProfileCompletionResult {
  const requiredFields = getRequiredProfileFields(user);
  const missingFields = requiredFields.filter((field) => !isFilled(user?.[field]));
  return {
    isComplete: missingFields.length === 0,
    missingFields,
  };
}
