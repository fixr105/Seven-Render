import React, { useState, useEffect } from 'react';
import { MainLayout } from '../components/layout/MainLayout';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Home, FileText, Users, DollarSign, BarChart3, Settings, Mail, Calendar, Clock, RefreshCw } from 'lucide-react';
import { useAuthSafe } from '../hooks/useAuthSafe';
import { useNotifications } from '../hooks/useNotifications';
import { useNavigation } from '../hooks/useNavigation';
import { apiService } from '../services/api';

interface DailySummaryReport {
  id: string;
  reportDate: string;
  summaryContent: string;
  generatedTimestamp: string;
  deliveredTo: string;
}

export const Reports: React.FC = () => {
  const { userRole } = useAuthSafe();
  const { unreadCount } = useNotifications();
  const [reports, setReports] = useState<DailySummaryReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const sidebarItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home, path: '/dashboard' },
    { id: 'applications', label: 'Applications', icon: FileText, path: '/applications' },
    ...(userRole === 'kam' || userRole === 'credit_team' ? [{ id: 'clients', label: 'Clients', icon: Users, path: '/clients' }] : []),
    ...(userRole === 'client' || userRole === 'credit_team' ? [{ id: 'ledger', label: 'Ledger', icon: DollarSign, path: '/ledger' }] : []),
    { id: 'reports', label: 'Reports', icon: BarChart3, path: '/reports' },
    { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' },
  ];

  const { activeItem, handleNavigation } = useNavigation(sidebarItems);

  // Load reports on initial mount (when page is first loaded/refreshed)
  // This ensures data loads when user first visits the page
  // No automatic refetch on role changes - user must manually refresh
  useEffect(() => {
    if (userRole === 'credit_team' || userRole === 'admin') {
      fetchReports();
    }
  }, []); // Empty dependency array - only runs once on mount (userRole checked inside)

  const fetchReports = async () => {
    try {
      setLoading(true);
      const response = await apiService.listDailySummaries(7);
      if (response.success && response.data) {
        setReports(response.data);
      } else {
        console.error('Error fetching reports:', response.error);
        setReports([]);
      }
    } catch (error) {
      console.error('Error fetching reports:', error);
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    if (!confirm('Generate daily summary report for today?')) {
      return;
    }

    setGenerating(true);
    try {
      const response = await apiService.generateDailySummary();
      if (response.success) {
        alert('Daily summary report generated successfully! Please click Refresh to see the new report.');
        // No automatic refresh - user must manually refresh to see updates
      } else {
        alert(`Failed to generate report: ${response.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Error generating report:', error);
      alert(`Failed to generate report: ${error.message || 'Unknown error'}`);
    } finally {
      setGenerating(false);
    }
  };

  const formatDate = (dateString: string): string => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const formatDateTime = (dateString: string): string => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Kolkata',
      });
    } catch {
      return dateString;
    }
  };

  // Only show reports page to credit team and admin
  if (userRole !== 'credit_team' && userRole !== 'admin') {
    return (
      <MainLayout
        sidebarItems={sidebarItems}
        activeItem={activeItem}
        onItemClick={handleNavigation}
        pageTitle="Reports"
        userRole={userRole?.replace('_', ' ').toUpperCase() || 'USER'}
        userName="User"
        notificationCount={unreadCount}
      >
        <Card>
          <CardHeader>
            <CardTitle>Reports & Analytics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12">
              <BarChart3 className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-neutral-900 mb-2">Access Restricted</h3>
              <p className="text-neutral-600">
                Reports are only available to Credit Team and Administrators.
              </p>
            </div>
          </CardContent>
        </Card>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      sidebarItems={sidebarItems}
      activeItem={activeItem}
      onItemClick={handleNavigation}
      pageTitle="Daily Summary Reports"
      userRole={userRole?.replace('_', ' ').toUpperCase() || 'USER'}
      userName="User"
      notificationCount={unreadCount}
    >
      <div className="space-y-6">
        {/* Header with Generate Button */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Daily Summary Reports</h1>
            <p className="text-sm text-neutral-600 mt-1">
              Automated daily reports aggregating loan applications, commission ledger, and audit log metrics
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              icon={RefreshCw}
              onClick={fetchReports}
              disabled={loading}
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              icon={Mail}
              onClick={handleGenerateReport}
              loading={generating}
              disabled={generating}
            >
              Generate Today's Report
            </Button>
          </div>
        </div>

        {/* Reports List */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Reports (Last 7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin w-8 h-8 border-4 border-brand-primary border-t-transparent rounded-full mx-auto mb-2"></div>
                <p className="text-sm text-neutral-600">Loading reports...</p>
              </div>
            ) : reports.length === 0 ? (
              <div className="text-center py-12">
                <BarChart3 className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-neutral-900 mb-2">No Reports Found</h3>
                <p className="text-neutral-600 mb-4">
                  No daily summary reports have been generated yet.
                </p>
                <Button variant="primary" icon={Mail} onClick={handleGenerateReport} loading={generating}>
                  Generate First Report
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {reports.map((report) => (
                  <Card key={report.id} className="border border-neutral-200">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Calendar className="w-5 h-5 text-neutral-400" />
                            <CardTitle className="text-lg">
                              Report for {formatDate(report.reportDate)}
                            </CardTitle>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-neutral-600">
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              <span>Generated: {formatDateTime(report.generatedTimestamp)}</span>
                            </div>
                            {report.deliveredTo && (
                              <div className="flex items-center gap-1">
                                <Mail className="w-4 h-4" />
                                <span>Delivered to: {report.deliveredTo}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="bg-neutral-50 rounded-lg p-4 border border-neutral-200">
                        <pre className="text-sm text-neutral-700 whitespace-pre-wrap font-mono">
                          {report.summaryContent}
                        </pre>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};
