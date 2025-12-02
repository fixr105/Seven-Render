/**
 * Example: Applications List using API Service
 * Shows how to fetch and display applications with role-based filtering
 */

import React, { useEffect, useState } from 'react';
import { useApiAuth } from '../contexts/ApiAuthContext';
import { useRoleAccess } from '../hooks/useRoleAccess';
import { apiService, LoanApplication } from '../services/api';
import { useApiCall } from '../hooks/useApi';
import { DataTable, Column } from '../components/ui/DataTable';
import { Button } from '../components/ui/Button';

export const ApplicationsApiExample: React.FC = () => {
  const { user } = useApiAuth();
  const { isClient, isKAM, isCredit, isNBFC } = useRoleAccess();
  const { loading, error, data, execute } = useApiCall<LoanApplication[]>();
  const [statusFilter, setStatusFilter] = useState<string>('');

  useEffect(() => {
    if (!user) return;

    // Fetch applications based on role
    const fetchApplications = async () => {
      if (isClient) {
        await execute(() => apiService.listApplications({ status: statusFilter }));
      } else if (isKAM) {
        await execute(() => apiService.listKAMApplications({ status: statusFilter }));
      } else if (isCredit) {
        await execute(() => apiService.listCreditApplications({ status: statusFilter }));
      } else if (isNBFC) {
        await execute(() => apiService.listNBFCApplications());
      }
    };

    fetchApplications();
  }, [user, isClient, isKAM, isCredit, isNBFC, statusFilter, execute]);

  const columns: Column<LoanApplication>[] = [
    { key: 'fileId', label: 'File ID' },
    { key: 'applicantName', label: 'Applicant' },
    { key: 'loanProduct', label: 'Product' },
    { key: 'requestedLoanAmount', label: 'Amount' },
    { key: 'status', label: 'Status' },
  ];

  if (loading) {
    return <div>Loading applications...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Loan Applications</h1>
        {isClient && (
          <Button onClick={() => {/* Navigate to new application */}}>
            New Application
          </Button>
        )}
      </div>

      {/* Status Filter */}
      <select
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value)}
        className="border rounded px-3 py-2"
      >
        <option value="">All Statuses</option>
        <option value="draft">Draft</option>
        <option value="pending_kam_review">Pending KAM Review</option>
        <option value="forwarded_to_credit">Forwarded to Credit</option>
        <option value="approved">Approved</option>
      </select>

      {/* Applications Table */}
      {data && (
        <DataTable
          data={data}
          columns={columns}
          onRowClick={(row) => {
            // Navigate to detail page
            console.log('View application:', row.id);
          }}
        />
      )}
    </div>
  );
};

