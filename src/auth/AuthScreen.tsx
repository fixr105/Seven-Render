import React from 'react';
import { CursorWaveCanvas } from '../components/login/CursorWaveCanvas';
import './login-dealer.css';

export const authSubmitClassName =
  'login-submit !h-11 !min-h-11 !w-full !rounded-lg !bg-dealer-navy !text-sm !font-semibold !text-white !shadow-none hover:!bg-dealer-navy focus:!ring-dealer-navy';

export const AuthScreen: React.FC<{ children: React.ReactNode; testId?: string }> = ({ children, testId }) => {
  return (
    <div
      data-testid={testId}
      className="relative flex min-h-dvh items-center justify-center overflow-x-hidden bg-dealer-surface px-4 py-8"
    >
      <CursorWaveCanvas />
      <div className="relative z-10 flex w-full max-w-[420px] flex-col items-center">
        <div className="dealer-login-card w-full rounded-[12px] border border-dealer-border bg-dealer-surface p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.06)] md:p-6">
          {children}
        </div>
        <p className="mt-6 text-center text-xs leading-4 text-dealer-text-quiet">
          Noxven Ventures OPC Pvt. Ltd. · Lending Service Provider
        </p>
      </div>
    </div>
  );
};
