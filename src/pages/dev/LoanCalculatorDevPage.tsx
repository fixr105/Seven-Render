import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { LoanCalculator } from '../../components/applications/LoanCalculator';
import type { LoanCalculatorSnapshot, LoanFrozenValues } from '../../lib/loanCalculator';

/**
 * Dev-only preview for the B2C EV Loan Details step (no auth required).
 */
export function LoanCalculatorDevPage() {
  const [frozenValues, setFrozenValues] = useState<LoanFrozenValues | null>(null);

  return (
    <div className="min-h-screen bg-neutral-50 px-4 py-8">
      <div className="mx-auto max-w-4xl space-y-4">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
          Dev preview — Loan Details step
        </p>
        <Card>
          <CardHeader>
            <CardTitle>Loan Details</CardTitle>
            <p className="text-sm text-neutral-500">
              Calculate and freeze loan amount, rate and fees
            </p>
          </CardHeader>
          <CardContent>
            <LoanCalculator
              frozenValues={frozenValues}
              onFrozenValuesChange={(
                values: LoanFrozenValues | null,
                snapshot?: LoanCalculatorSnapshot
              ) => {
                setFrozenValues(values);
                if (import.meta.env.DEV) {
                  console.debug('[LoanCalculatorDevPage] frozen values', values, snapshot);
                }
              }}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
