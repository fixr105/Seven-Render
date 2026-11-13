import { useState } from 'react';
import { enginePost } from '../../services/engineClient';
import { Button } from '../../components/ui/Button';
import { Checkbox } from '../../components/ui/Checkbox';
import { formatInr, type DisplayOffer } from './offers';
import type { SubmittedApplication } from './ApplicationFormStep';

interface OfferStepProps {
  application: SubmittedApplication;
  offers: DisplayOffer[];
  formFields?: Record<string, unknown>;
  onAccepted: (offer: DisplayOffer) => void;
  onBackToForm: () => void;
}

function consentCopy(applicantName: string): string {
  const name = applicantName.trim() || 'the applicant';
  return `I, ${name}, authorise Seven Fincorp and its lending partners to process this loan application, carry out required background checks, and disburse the loan as per the selected terms.`;
}

export function OfferStep({
  application,
  offers,
  formFields,
  onAccepted,
  onBackToForm,
}: OfferStepProps) {
  const [selectedLabel, setSelectedLabel] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const selected = offers.find((offer) => offer.label === selectedLabel) ?? null;

  const accept = async () => {
    if (!selected) {
      setError('Select an offer to continue.');
      return;
    }
    if (!consent) {
      setError('Consent is required before this offer can be accepted.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const today = new Date().toISOString().split('T')[0];
      const fields: Record<string, unknown> = {
        'Approved Loan Amount': selected.amount,
        'Lender Decision Status': 'Approved',
        'Lender Decision Date': today,
        'Lender Decision Remarks': `${selected.label} | ROI ${selected.roi}% | Tenure ${selected.tenure}m`,
        'Assigned NBFC': selected.realLenderId || 'Fintree',
        'Last Updated': new Date().toISOString(),
      };
      if (formFields) {
        fields['Form Data'] = JSON.stringify(formFields);
      }
      await enginePost('airtable_write', {
        table: 'Loan Applications',
        action: 'update',
        record_id: application.recordId,
        fields,
      });
      onAccepted(selected);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save the selected offer.');
    } finally {
      setSaving(false);
    }
  };

  if (offers.length === 0) {
    return (
      <div className="rounded-xl border border-[#E5E7EB] bg-white p-6 space-y-4">
        <p className="font-inter text-sm text-neutral-800">
          Application does not meet current lending criteria.
        </p>
        <Button type="button" variant="secondary" onClick={onBackToForm}>
          Back to Home
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="font-michroma text-xl text-brand-primary">Choose your offer</h2>
      {offers.map((offer) => (
        <div key={offer.label} className="rounded-xl border border-[#E5E7EB] bg-white p-5 space-y-3">
          <h3 className="font-michroma text-base text-brand-primary">{offer.label}</h3>
          <dl className="grid grid-cols-2 gap-2 font-inter text-sm">
            <dt className="text-neutral-600">Loan Amount</dt>
            <dd className="text-right font-medium text-neutral-900">{formatInr(offer.amount)}</dd>
            <dt className="text-neutral-600">Interest Rate</dt>
            <dd className="text-right font-medium text-neutral-900">{offer.roi}% p.a.</dd>
            <dt className="text-neutral-600">Tenure</dt>
            <dd className="text-right font-medium text-neutral-900">{offer.tenure} months</dd>
            <dt className="text-neutral-600">EMI</dt>
            <dd className="text-right font-medium text-neutral-900">{formatInr(offer.emi)}/month</dd>
            <dt className="text-neutral-600">Processing Fee</dt>
            <dd className="text-right font-medium text-neutral-900">{formatInr(offer.pf)} + GST</dd>
          </dl>
          <Button
            type="button"
            variant={selectedLabel === offer.label ? 'primary' : 'secondary'}
            onClick={() => setSelectedLabel(offer.label)}
          >
            Select This Offer
          </Button>
        </div>
      ))}
      <div className="rounded-xl border border-[#E5E7EB] bg-white p-5 space-y-3">
        <Checkbox
          checked={consent}
          onChange={setConsent}
          label={consentCopy(application.canonical.fullName)}
        />
        {error ? <p className="font-inter text-sm text-error">{error}</p> : null}
        <Button
          type="button"
          variant="primary"
          loading={saving}
          disabled={saving || !selected || !consent}
          onClick={() => void accept()}
        >
          Accept & Proceed
        </Button>
      </div>
    </div>
  );
}
