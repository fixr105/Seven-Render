import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { DataTable, Column } from '../ui/DataTable';
import { FileText, Plus } from 'lucide-react';
import { getStatusDisplayNameForViewer } from '../../lib/statusUtils';
import type { LoanApplication } from '../../hooks/useApplications';

export type RecentApplicationsRole = 'client' | 'kam' | 'credit';

export interface ApplicationRow {
  id: string;
  fileNumber: string;
  clientName?: string;
  loanType: string;
  amount: string;
  status: string;
  lastUpdate: string;
}

export interface RecentApplicationsSectionProps {
  role: RecentApplicationsRole;
  applications: LoanApplication[];
  loading: boolean;
  onViewAll: () => void;
  onRowClick: (row: ApplicationRow) => void;
  onEmptyAction?: () => void;
}

function getStatusVariant(status: string): 'success' | 'error' | 'warning' | 'info' | 'neutral' {
  if (status.toLowerCase().includes('approved') || status.toLowerCase().includes('disbursed')) return 'success';
  if (status === 'Action required' || status.toLowerCase().includes('query') || status.toLowerCase().includes('pending')) return 'warning';
  if (status.toLowerCase().includes('rejected')) return 'error';
  if (status.toLowerCase().includes('forwarded') || status.toLowerCase().includes('negotiation') || status.toLowerCase().includes('sent')) return 'info';
  return 'neutral';
}

function formatStatus(app: LoanApplication, role: RecentApplicationsRole): string {
  if (role === 'client') {
    return getStatusDisplayNameForViewer(app.status, 'client');
  }
  return app.status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

function mapToTableData(applications: LoanApplication[], role: RecentApplicationsRole): ApplicationRow[] {
  return applications.slice(0, 5).map((app) => ({
    id: app.id,
    fileNumber: app.file_number || `SF${app.id.slice(0, 8)}`,
    clientName: app.client?.company_name || '',
    loanType: app.loan_product?.name || '',
    amount: `₹${((app.requested_loan_amount || 0) / 100000).toFixed(2)}L`,
    status: formatStatus(app, role),
    lastUpdate: new Date(app.updated_at || app.created_at).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
    }),
  }));
}

function SkeletonRows() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex gap-4 items-center py-3 border-b border-neutral-100 last:border-0">
          <div className="h-4 w-20 bg-neutral-200 rounded animate-pulse" />
          <div className="h-4 w-24 bg-neutral-200 rounded animate-pulse hidden md:block" />
          <div className="h-4 w-28 bg-neutral-200 rounded animate-pulse" />
          <div className="h-4 w-16 bg-neutral-200 rounded animate-pulse ml-auto" />
          <div className="h-4 w-12 bg-neutral-200 rounded animate-pulse" />
          <div className="h-4 w-14 bg-neutral-200 rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}

const EMPTY_STATE_CONFIG: Record<
  RecentApplicationsRole,
  { message: string; ctaLabel?: string; showCta: boolean }
> = {
  client: {
    message: 'No applications yet',
    ctaLabel: 'Create Your First Application',
    showCta: true,
  },
  kam: {
    message: 'No applications from your clients yet',
    ctaLabel: 'Onboard Your First Client',
    showCta: true,
  },
  credit: {
    message: 'No applications yet',
    showCta: false,
  },
};

export function RecentApplicationsSection({
  role,
  applications,
  loading,
  onViewAll,
  onRowClick,
  onEmptyAction,
}: RecentApplicationsSectionProps) {
  const tableData = mapToTableData(applications, role);
  const emptyConfig = EMPTY_STATE_CONFIG[role];
  const showClientColumn = role === 'kam' || role === 'credit';

  const columns: Column<ApplicationRow>[] = [
    { key: 'fileNumber', label: 'File ID', sortable: true },
    ...(showClientColumn ? [{ key: 'clientName', label: 'Client', sortable: true }] : []),
    { key: 'loanType', label: 'Loan Type', sortable: true },
    { key: 'amount', label: 'Amount', sortable: true, align: 'right' as const },
    {
      key: 'status',
      label: 'Status',
      render: (value) => <Badge variant={getStatusVariant(String(value))}>{String(value)}</Badge>,
    },
    { key: 'lastUpdate', label: 'Last Update', sortable: true },
  ];

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Recent Applications</CardTitle>
        <Button variant="tertiary" size="sm" onClick={onViewAll}>
          View All
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-2">
            <SkeletonRows />
          </div>
        ) : tableData.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
            <p className="text-neutral-500 mb-6 text-lg">{emptyConfig.message}</p>
            {emptyConfig.showCta && onEmptyAction && emptyConfig.ctaLabel && (
              <Button variant="primary" icon={Plus} onClick={onEmptyAction}>
                {emptyConfig.ctaLabel}
              </Button>
            )}
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={tableData}
            keyExtractor={(row) => row.id}
            onRowClick={onRowClick}
          />
        )}
      </CardContent>
    </Card>
  );
}
