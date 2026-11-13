import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { MainLayout } from '../../components/layout/MainLayout';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import { useNavigation } from '../../hooks/useNavigation';
import { useSidebarItems } from '../../hooks/useSidebarItems';
import { ApplicationFormStep, type SubmittedApplication } from './ApplicationFormStep';
import { DealerPostSubmitFlow } from './DealerPostSubmitFlow';

export function DealerNewApplication() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sidebarItems = useSidebarItems();
  const { activeItem, handleNavigation } = useNavigation(sidebarItems);
  const productId = searchParams.get('productId')?.trim() ?? '';
  const clientId = user?.clientId?.trim() ?? '';
  const [application, setApplication] = useState<SubmittedApplication | null>(null);

  const page = (() => {
    if (application) {
      return (
        <DealerPostSubmitFlow
          application={application}
          productId={productId || 'ev_dealer'}
          formFields={application.values}
        />
      );
    }
    if (!clientId) {
      return <p className="text-sm text-neutral-700">Your account is not linked to a client record.</p>;
    }
    if (!productId) {
      return (
        <Card>
          <CardContent className="space-y-3">
            <p className="text-sm text-neutral-700">
              Choose a loan product from your dashboard to start an application.
            </p>
            <Button type="button" variant="primary" onClick={() => navigate('/dashboard')}>
              Back to dashboard
            </Button>
          </CardContent>
        </Card>
      );
    }
    return (
      <ApplicationFormStep
        productId={productId}
        clientId={clientId}
        initialValues={{}}
        initialCoApplicant={false}
        existingRecordId=""
        existingFileId=""
        preserveStatus={false}
        onSubmitted={(next) => setApplication(next)}
      />
    );
  })();

  return (
    <MainLayout
      sidebarItems={sidebarItems}
      activeItem={activeItem}
      onItemClick={handleNavigation}
      pageTitle="New Application"
      userRole={user?.role?.replace('_', ' ').toUpperCase() || 'USER'}
      userName={user?.name || user?.email || 'User'}
    >
      <div className="mx-auto w-full max-w-[600px] space-y-4">{page}</div>
    </MainLayout>
  );
}
