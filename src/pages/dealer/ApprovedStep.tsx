import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { formatInr, type DisplayOffer } from './offers';

interface ApprovedStepProps {
  fileId: string;
  offer: DisplayOffer;
}

export function ApprovedStep({ fileId, offer }: ApprovedStepProps) {
  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-white p-6 space-y-4">
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-600 text-white">
          <Check className="h-4 w-4" aria-hidden />
        </span>
        <div>
          <h2 className="font-michroma text-xl text-brand-primary">
            Application Qualified & Offer Accepted
          </h2>
          <p className="mt-2 font-inter text-sm text-neutral-800">{offer.label}</p>
        </div>
      </div>
      <dl className="space-y-1 font-inter text-sm text-neutral-800">
        <div>Loan Amount: {formatInr(offer.amount)}</div>
        <div>
          EMI: {formatInr(offer.emi)}/month × {offer.tenure} months
        </div>
        <div>File ID: {fileId}</div>
      </dl>
      <p className="font-inter text-sm text-neutral-600">
        Your loan documents are being prepared. The customer will receive signing documents on their
        registered mobile/email shortly.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link to="/dealer/new">
          <Button type="button" variant="primary">
            New Application
          </Button>
        </Link>
        <Link to="/applications">
          <Button type="button" variant="secondary">
            My Applications
          </Button>
        </Link>
      </div>
    </div>
  );
}
