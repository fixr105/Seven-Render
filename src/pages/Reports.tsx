import React, { useState, useEffect } from 'react';
import { MainLayout } from '../components/layout/MainLayout';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Mail, Calendar, Clock, RefreshCw, AlertCircle, BarChart3 } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useNotifications } from '../hooks/useNotifications';
import { useNavigation } from '../hooks/useNavigation';
import { useSidebarItems } from '../hooks/useSidebarItems';
import { apiService } from '../services/api';

interface DailySummaryReport {
  id: string;
  reportDate: string;
  summaryContent: string;
  generatedTimestamp: string;
  deliveredTo: string;
}

export const Reports: React.FC = () => {
  const { user } = useAuth();
  const userRole = user?.role || null;
  
  const getUserDisplayName = () => {
    if (user?.name) return user.name;
    if (user?.email) return user.email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    return '';
  };
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [reports, setReports] = useState<DailySummaryReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [latestReport, setLatestReport] = useState<DailySummaryReport | null>(null);
  const [latestLoading, setLatestLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [emailRecipients, setEmailRecipients] = useState('');

  const sidebarItems = useSidebarItems();
  const { activeItem, handleNavigation } = useNavigation(sidebarItems);

  // Fetch on mount (including SPA navigation) when credit_team, admin, or kam (backend allows KAM via requireCreditOrKAM).
  useEffect(() => {
    if (userRole === 'credit_team' || userRole === 'admin' || userRole === 'kam') {
      fetchReports();
      fetchLatestReport();
    } else {
      setLoading(false);
      setLatestLoading(false);
      setReports([]);
      setLatestReport(null);
    }
  }, []);

  const normalizeReport = (raw: Record<string, unknown>): DailySummaryReport => ({
    id: (raw.id as string) || '',
    reportDate: (raw['Report Date'] ?? raw.reportDate ?? '') as string,
    summaryContent: (raw['Summary Content'] ?? raw.summaryContent ?? '') as string,
    generatedTimestamp: (raw['Generated Timestamp'] ?? raw.generatedTimestamp ?? '') as string,
    deliveredTo: (raw['Delivered To'] ?? raw.deliveredTo ?? '') as string,
  });

  const fetchReports = async () => {
    try {
      setLoading(true);
      setReportsError(null);
      const response = await apiService.listDailySummaries(7);
      if (response.success && response.data) {
        const data = Array.isArray(response.data) ? response.data : [];
        setReports(data.map((item: unknown) => normalizeReport((item as Record<string, unknown>) ?? {})));
      } else {
        console.error('Error fetching reports:', response.error);
        setReports([]);
        setReportsError(response.error || 'Could not load reports. Please try again.');
      }
    } catch (error) {
      console.error('Error fetching reports:', error);
      setReports([]);
      setReportsError((error as Error)?.message || 'Could not load reports. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchLatestReport = async () => {
    try {
      setLatestLoading(true);
      const response = await apiService.getLatestDailySummary();
      if (response.success && response.data) {
        const raw = (response.data as Record<string, unknown>) ?? {};
        setLatestReport(normalizeReport(raw));
      } else {
        setLatestReport(null);
      }
    } catch {
      setLatestReport(null);
    } finally {
      setLatestLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    if (!confirm('Generate daily summary report for today?')) {
      return;
    }

    const recipients = emailRecipients
      ? emailRecipients.split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean)
      : undefined;

    setGenerating(true);
    try {
      const response = await apiService.generateDailySummary(undefined, recipients);
      if (response.success) {
        await fetchReports();
        await fetchLatestReport();
        alert(recipients?.length
          ? 'Report generated and email sent successfully.'
          : 'Report generated successfully.');
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

  // Restrict to credit_team, admin, and kam (client, nbfc get Access Restricted)
  if (userRole !== 'credit_team' && userRole !== 'admin' && userRole !== 'kam') {
    return (
      <MainLayout
        sidebarItems={sidebarItems}
        activeItem={activeItem}
        onItemClick={handleNavigation}
        pageTitle="Reports"
        userRole={userRole?.replace('_', ' ').toUpperCase() || 'USER'}
        userName={getUserDisplayName()}
        notificationCount={unreadCount}
        notifications={notifications}
        onMarkAsRead={markAsRead}
        onMarkAllAsRead={markAllAsRead}
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
                Reports are only available to Credit Team, KAM, and Administrators.
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
      userName={getUserDisplayName()}
      notificationCount={unreadCount}
    >
      <div className="space-y-6">
        {/* Header with Generate Button */}
        <div className="flex flex-col gap-4">
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
                onClick={() => {
                  fetchReports();
                  fetchLatestReport();
                }}
                disabled={loading}
              >
                Refresh
              </Button>
              {(userRole === 'credit_team' || userRole === 'admin') && (
                <Button
                  variant="primary"
                  icon={Mail}
                  onClick={handleGenerateReport}
                  loading={generating}
                  disabled={generating}
                >
                  Generate Today&apos;s Report
                </Button>
              )}
            </div>
          </div>
          {(userRole === 'credit_team' || userRole === 'admin') && (
            <div className="max-w-md">
              <Input
                id="email-recipients"
                type="text"
                label="Email to (optional)"
                placeholder="e.g. manager@company.com, team@company.com"
                value={emailRecipients}
                onChange={(e) => setEmailRecipients(e.target.value)}
              />
            </div>
          )}
        </div>

        {/* Latest report */}
        <Card>
          <CardHeader>
            <CardTitle>Latest report</CardTitle>
          </CardHeader>
          <CardContent>
            {latestLoading ? (
              <div className="flex items-center gap-3 py-4">
                <div className="animate-spin w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full" />
                <span className="text-sm text-neutral-500">Loading latest report...</span>
              </div>
            ) : latestReport ? (
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <Calendar className="w-5 h-5 text-neutral-400" />
                  <span className="font-medium text-neutral-900">
                    Report for {formatDate(latestReport.reportDate)}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm text-neutral-600 mb-3">
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    <span>Generated: {formatDateTime(latestReport.generatedTimestamp)}</span>
                  </div>
                  {latestReport.deliveredTo && (
                    <div className="flex items-center gap-1">
                      <Mail className="w-4 h-4" />
                      <span>Delivered to: {latestReport.deliveredTo}</span>
                    </div>
                  )}
                </div>
                <div className="bg-neutral-50 rounded-lg p-4 border border-neutral-200">
                  <pre className="text-sm text-neutral-700 whitespace-pre-wrap font-mono line-clamp-6">
                    {latestReport.summaryContent.length > 200
                      ? `${latestReport.summaryContent.slice(0, 200)}...`
                      : latestReport.summaryContent}
                  </pre>
                </div>
                <p className="mt-2">
                  <Button
                    variant="tertiary"
                    size="sm"
                    onClick={() => document.getElementById('reports-list')?.scrollIntoView({ behavior: 'smooth' })}
                  >
                    View full report in list below
                  </Button>
                </p>
              </div>
            ) : (
              <div className="text-center py-6">
                <BarChart3 className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
                <p className="text-neutral-600 mb-3">No report generated yet.</p>
                {(userRole === 'credit_team' || userRole === 'admin') && (
                  <Button variant="primary" icon={Mail} onClick={handleGenerateReport} loading={generating}>
                    Generate Today&apos;s Report
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Reports List */}
        <Card id="reports-list">
          <CardHeader>
            <CardTitle>Recent Reports (Last 7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            {reportsError ? (
              <div className="text-center py-12">
                <AlertCircle className="w-12 h-12 text-error mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-neutral-900 mb-2">Could not load reports</h3>
                <p className="text-neutral-600 mb-4">{reportsError}</p>
                <Button variant="primary" icon={RefreshCw} onClick={fetchReports}>
                  Retry
                </Button>
              </div>
            ) : loading ? (
              <div className="text-center py-10">
                <div className="animate-spin w-8 h-8 border-4 border-brand-primary border-t-transparent rounded-full mx-auto mb-2" />
                <p className="text-sm text-neutral-500">Loading reports...</p>
              </div>
            ) : reports.length === 0 ? (
              <div className="text-center py-12">
                <BarChart3 className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-neutral-900 mb-2">No reports found</h3>
                <p className="text-neutral-600 mb-4">
                  No daily summary reports have been generated yet.
                </p>
                {(userRole === 'credit_team' || userRole === 'admin') && (
                  <Button variant="primary" icon={Mail} onClick={handleGenerateReport} loading={generating}>
                    Generate First Report
                  </Button>
                )}
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
