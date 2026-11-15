export const VKYC_STATUS_CHECK_MESSAGE = "Can't check video KYC status. Retrying…";

const SHOW_AFTER = 3;

export function nextVkycPollFailureCount(
  previous: number,
  succeeded: boolean
): number {
  if (succeeded) return 0;
  return previous + 1;
}

export function shouldShowVkycStatusCheckError(consecutiveFailures: number): boolean {
  return consecutiveFailures >= SHOW_AFTER;
}
