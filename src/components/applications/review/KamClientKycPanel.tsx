import React, { useEffect, useState } from 'react';
import { apiService, type ClientKycDealerProfile } from '../../../services/api';

export interface KamClientKycPanelProps {
  clientId: string;
}

export const KamClientKycPanel: React.FC<KamClientKycPanelProps> = ({ clientId }) => {
  const [profile, setProfile] = useState<ClientKycDealerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiService.getKAMClientKyc(clientId);
        if (cancelled) return;
        if (res.success && res.data) {
          setProfile(res.data);
        } else {
          setError(res.error || 'No KYC profile found');
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load KYC');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  if (loading) {
    return <p className="text-sm text-neutral-500" data-testid="kam-client-kyc-loading">Loading dealer KYC…</p>;
  }

  if (error || !profile) {
    return (
      <p className="text-sm text-neutral-500" data-testid="kam-client-kyc-missing">
        {error || 'No dealer KYC on file for this client.'}
      </p>
    );
  }

  const rows: Array<{ label: string; value: string }> = [
    { label: 'Trade Name', value: profile.tradeName ?? '' },
    { label: 'Dealer Name', value: profile.dealerName ?? '' },
    { label: 'Contact', value: profile.dealerContact ?? '' },
    { label: 'Email', value: profile.dealerEmail ?? '' },
    { label: 'GST', value: profile.gstNumber ?? '' },
    { label: 'PAN', value: profile.dealerPan ?? '' },
    { label: 'IFSC', value: profile.dealerIfscCode ?? '' },
    { label: 'City', value: profile.dealerCity ?? '' },
    { label: 'State', value: profile.dealerState ?? '' },
  ];

  return (
    <div className="rounded-xl border border-neutral-200 p-4" data-testid="kam-client-kyc-panel">
      <h4 className="mb-3 text-sm font-semibold text-neutral-900">Dealer KYC profile</h4>
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-1 gap-1 sm:grid-cols-3 sm:gap-2">
            <p className="text-sm text-neutral-500">{row.label}</p>
            <p className="text-sm text-neutral-900 sm:col-span-2">{row.value || '—'}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
