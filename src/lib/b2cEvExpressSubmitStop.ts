/**
 * STOP (Stage 6 Next = Submit): Express `validateB2cEvFormData` still requires
 * delivery-stage fields + compliance checkboxes at submit. Owner must authorize
 * relaxing backend/src/services/validation/b2cEvFormValidation.service.ts before
 * wiring Step-6 Next → Express submit. Do not invent placeholder values.
 */

export const EXPRESS_SUBMIT_STOP_REASON =
  'Submit blocked: Express still requires insurance/vehicle/geo (and compliance checkboxes) at submit. Owner must authorize validateB2cEvFormData relax.';

/** Exact keys that cause 400 if missing on B2C EV submit today. */
export const EXPRESS_SUBMIT_BLOCKING_FIELDS = [
  'insurance.cost',
  'insurance.provider',
  'insurance.policyNumber',
  'insurance.issuedDate',
  'insurance.periodMonths',
  'vehicle.cost',
  'vehicle.manufacturingYear',
  'vehicle.invoiceDate',
  'vehicle.downpayment',
  'vehicle.registrationCost',
  'geoPhotos.withSupportPerson.url',
  'geoPhotos.withSupportPerson.lat',
  'geoPhotos.withSupportPerson.lon',
  'geoPhotos.withVehicle.url',
  'geoPhotos.withVehicle.lat',
  'geoPhotos.withVehicle.lon',
  'geoPhotos.atResidence.url',
  'geoPhotos.atResidence.lat',
  'geoPhotos.atResidence.lon',
  'compliance.vkycDone',
  'compliance.loanAgreementSigned',
  'compliance.enachDone',
] as const;

/**
 * Until Express is relaxed, Step-6 Next must fail closed before calling submit.
 * Flip to false only after owner-authorized Express change lands.
 */
export const EXPRESS_B2C_EV_SUBMIT_REQUIRES_DELIVERY_FIELDS = true;

export function getExpressSubmitStopMessage(): string {
  return EXPRESS_SUBMIT_STOP_REASON;
}
