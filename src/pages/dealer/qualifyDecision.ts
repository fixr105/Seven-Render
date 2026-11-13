export type QualifyDecision = 'pass' | 'fail' | 'error';

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/** Pass continues. A completed `pass: false` is a rejection. Anything else can be retried. */
export function decideQualifyResult(payload: unknown): QualifyDecision {
  const row = asRecord(payload);
  if (row?.ok === true && row.pass === true) return 'pass';
  if (row?.ok === true && row.pass === false) return 'fail';
  return 'error';
}

export type EngineQualifyBlock = 'rejected' | 'config' | 'bureau' | 'retry';

/** Screen outcome for an engine qualify payload. A pass has no block. */
export function engineQualifyBlock(payload: unknown): EngineQualifyBlock | null {
  const decision = decideQualifyResult(payload);
  if (decision === 'pass') return null;
  if (decision === 'fail') return 'rejected';
  const row = asRecord(payload);
  if (row?.state === 'CONFIG_ERROR') return 'config';
  if (row?.state === 'BUREAU_ERROR') return 'bureau';
  return 'retry';
}

export function engineQualifyBlockMessage(block: EngineQualifyBlock): string {
  switch (block) {
    case 'rejected':
      return 'This application does not meet current lending criteria.';
    case 'config':
      return 'System configuration error. Please contact support.';
    case 'bureau':
      return 'Unable to check eligibility. Please try again.';
    case 'retry':
      return 'Something went wrong. Please try again.';
    default: {
      const exhaustive: never = block;
      return exhaustive;
    }
  }
}
