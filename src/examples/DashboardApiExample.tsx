/**
 * Example: Dashboard using API Service
 * Shows how to fetch data using the API service
 */

import React, { useEffect } from 'react';
import { useApiAuth } from '../contexts/ApiAuthContext';
import { useRoleAccess } from '../hooks/useRoleAccess';
import { apiService, DashboardSummary } from '../services/api';
import { useApiCall } from '../hooks/useApi';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';

export const DashboardApiExample: React.FC = () => {
  const { user } = useApiAuth();
  const { isClient, isKAM, isCredit, isNBFC } = useRoleAccess();
  const { loading, error, data, execute } = useApiCall<DashboardSummary>();

  useEffect(() => {
    if (!user) return;

    // Fetch dashboard based on role
    if (isClient) {
      execute(() => apiService.getClientDashboard());
    } else if (isKAM) {
      execute(() => apiService.getKAMDashboard());
    } else if (isCredit) {
      execute(() => apiService.getCreditDashboard());
    } else if (isNBFC) {
      execute(() => apiService.getNBFCDashboard());
    }
  }, [user, isClient, isKAM, isCredit, isNBFC, execute]);

  if (loading) {
    return <div>Loading dashboard...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (!data) {
    return <div>No data available</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Client Dashboard */}
      {isClient && data.ledgerSummary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Total Earned</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ₹{data.ledgerSummary.totalEarned.toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ₹{data.ledgerSummary.balance.toLocaleString()}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Applications List */}
      {data.activeApplications && (
        <Card>
          <CardHeader>
            <CardTitle>Active Applications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.activeApplications.map((app) => (
                <div key={app.id} className="flex justify-between items-center p-2 border rounded">
                  <div>
                    <div className="font-medium">{app.fileId}</div>
                    <div className="text-sm text-gray-600">{app.applicantName}</div>
                  </div>
                  <div className="text-sm">{app.status}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

