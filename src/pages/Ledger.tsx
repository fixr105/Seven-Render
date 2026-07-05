import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../components/layout/MainLayout';
import { PageHero } from '../components/layout/PageHero';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { MessageSquare, Send, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useLedger } from '../hooks/useLedger';
import { useNotifications } from '../hooks/useNotifications';
import { useNavigation } from '../hooks/useNavigation';
import { useSidebarItems } from '../hooks/useSidebarItems';
import { apiService } from '../services/api';

export const Ledger: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const userRole = user?.role || null;
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [clientsLoading, setClientsLoading] = useState(false);

  const getUserDisplayName = () => {
    if (user?.name) return user.name;
    if (user?.email) return user.email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    return '';
  };

  const ledgerOptions = userRole === 'kam' ? { clientId: selectedClientId || null } : undefined;
  const {
    entries,
    balance,
    totalEarnings,
    totalFeesDue,
    loading,
    requestPayout,
    raiseQuery,
    flagPayout,
    payoutRequests,
    refetchPayoutRequests,
    addLedgerEntry,
    flagCreditDispute,
    resolveCreditDispute,
  } = useLedger(ledgerOptions);

  useEffect(() => {
    if (userRole === 'kam') {
      setClientsLoading(true);
      apiService.listClients()
        .then((res) => {
          if (res.success && res.data) {
            const list = (res.data as any[]).map((c: any) => {
              const id = c.id ?? c.clientId ?? c['Client ID'] ?? '';
              const rawName = c.clientName || c.name || c.company_name || c['Client Name'] || c.primaryContactName || c['Primary Contact Name'] || '';
              const name = rawName && rawName.trim() !== '' ? rawName.trim() : `Client (${id})`;
              return { id, name };
            }).filter((c) => c.id);
            setClients(list);
            if (list.length > 0) {
              setSelectedClientId((prev) => (prev ? prev : list[0].id));
            }
          }
        })
        .finally(() => setClientsLoading(false));
    } else if (userRole === 'credit_team' || userRole === 'admin') {
      setClientsLoading(true);
      apiService.listCreditClients()
        .then((res) => {
          if (res.success && res.data) {
            const list = (res.data as any[]).map((c: any) => {
              const id = c.id ?? c.clientId ?? c['Client ID'] ?? '';
              const rawName = c.clientName || c.name || c.company_name || c['Client Name'] || '';
              const name = rawName && rawName.trim() !== '' ? rawName.trim() : `Client (${id})`;
              return { id, name };
            }).filter((c) => c.id);
            setClients(list);
          }
        })
        .finally(() => setClientsLoading(false));
    }
  }, [userRole]);
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [showQueryModal, setShowQueryModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<any>(null);
  const [payoutAmount, setPayoutAmount] = useState<string>('');
  const [queryMessage, setQueryMessage] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [creditPayoutForAction, setCreditPayoutForAction] = useState<{ id: string; client?: string; amount: number; date?: string; description?: string } | null>(null);
  const [approveNote, setApproveNote] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [showResolveDisputeModal, setShowResolveDisputeModal] = useState(false);
  const [showManualEntryModal, setShowManualEntryModal] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [resolveNotes, setResolveNotes] = useState('');
  const [resolveAdjustedAmount, setResolveAdjustedAmount] = useState('');
  const [resolveAccepted, setResolveAccepted] = useState(true);
  const [manualEntryForm, setManualEntryForm] = useState({
    clientId: '',
    loanFile: '',
    payoutAmount: '',
    description: '',
  });

  const sidebarItems = useSidebarItems();
  const { activeItem, handleNavigation } = useNavigation(sidebarItems);

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string): string => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-IN', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    } catch {
      return dateString;
    }
  };

  const handleRequestPayout = async () => {
    if (!selectedEntry) {
      // Request payout for full balance
      setSubmitting(true);
      setError(null);
      try {
        await requestPayout(undefined, true);
        setShowPayoutModal(false);
        setPayoutAmount('');
        alert(t('pages.ledger.payoutCreatedSuccess'));
      } catch (err: any) {
        setError(err.message || 'Failed to create payout request');
      } finally {
        setSubmitting(false);
      }
    } else {
      // Flag specific entry for payout
      setSubmitting(true);
      setError(null);
      try {
        await flagPayout(selectedEntry.id);
        setShowPayoutModal(false);
        setSelectedEntry(null);
        alert(t('pages.ledger.entryFlaggedSuccess'));
      } catch (err: any) {
        setError(err.message || 'Failed to flag payout');
      } finally {
        setSubmitting(false);
      }
    }
  };

  const handleRaiseQuery = async () => {
    if (!selectedEntry || !queryMessage.trim()) {
      setError(t('pages.ledger.enterQueryMessage'));
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await raiseQuery(selectedEntry.id, queryMessage);
      setShowQueryModal(false);
      setQueryMessage('');
      setSelectedEntry(null);
      alert(t('pages.ledger.queryRaisedSuccess'));
    } catch (err: any) {
      setError(err.message || 'Failed to raise query');
    } finally {
      setSubmitting(false);
    }
  };

  const getDisputeStatusBadge = (status: string) => {
    switch (status) {
      case 'Under Query':
      case 'UNDER_QUERY':
        return <span className="px-2 py-1 text-xs font-medium rounded bg-warning/20 text-warning">{t('common.underQuery')}</span>;
      case 'Resolved':
      case 'RESOLVED':
        return <span className="px-2 py-1 text-xs font-medium rounded bg-success/20 text-success">{t('status.resolved')}</span>;
      default:
        return <span className="px-2 py-1 text-xs font-medium rounded bg-neutral-100 text-neutral-600">{t('common.none')}</span>;
    }
  };

  const getPayoutRequestBadge = (status: string) => {
    switch (status) {
      case 'Requested':
        return <span className="px-2 py-1 text-xs font-medium rounded bg-brand-primary/20 text-brand-primary">{t('common.requested')}</span>;
      case 'Paid':
        return <span className="px-2 py-1 text-xs font-medium rounded bg-success/20 text-success">{t('common.paid')}</span>;
      case 'Rejected':
        return <span className="px-2 py-1 text-xs font-medium rounded bg-error/20 text-error">{t('status.rejected')}</span>;
      default:
        return null;
    }
  };

  const pendingPayoutRequests = (payoutRequests ?? []).filter(
    (p: { status?: string }) => (p.status === 'Requested' || String(p.status || '').toLowerCase() === 'requested')
  );

  const handleApprovePayout = async () => {
    if (!creditPayoutForAction) return;
    const amount = creditPayoutForAction.amount;
    if (typeof amount !== 'number' || amount <= 0) {
      setError(t('pages.ledger.invalidAmount'));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiService.approvePayout(creditPayoutForAction.id, amount, approveNote.trim() || undefined);
      if (res.success) {
        setShowApproveModal(false);
        setCreditPayoutForAction(null);
        setApproveNote('');
        await refetchPayoutRequests();
        alert(t('pages.ledger.payoutApprovedSuccess'));
      } else {
        setError(res.error || 'Failed to approve payout');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to approve payout');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectPayout = async () => {
    if (!creditPayoutForAction || !rejectReason.trim()) {
      setError(t('pages.ledger.enterRejectionReason'));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiService.rejectPayout(creditPayoutForAction.id, rejectReason.trim());
      if (res.success) {
        setShowRejectModal(false);
        setCreditPayoutForAction(null);
        setRejectReason('');
        await refetchPayoutRequests();
        alert(t('pages.ledger.payoutRejectedSuccess'));
      } else {
        setError(res.error || 'Failed to reject payout');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to reject payout');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFlagCreditDispute = async () => {
    if (!selectedEntry || !disputeReason.trim()) {
      setError('Dispute reason is required');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await flagCreditDispute(selectedEntry.id, disputeReason.trim());
      setShowDisputeModal(false);
      setSelectedEntry(null);
      setDisputeReason('');
      alert('Ledger entry flagged for dispute.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to flag dispute');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolveCreditDispute = async () => {
    if (!selectedEntry) return;
    setSubmitting(true);
    setError(null);
    try {
      await resolveCreditDispute(selectedEntry.id, {
        resolved: resolveAccepted,
        adjustedAmount: resolveAdjustedAmount ? parseFloat(resolveAdjustedAmount) : undefined,
        notes: resolveNotes.trim() || undefined,
      });
      setShowResolveDisputeModal(false);
      setSelectedEntry(null);
      setResolveNotes('');
      setResolveAdjustedAmount('');
      alert(resolveAccepted ? 'Dispute resolved.' : 'Dispute rejected.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to resolve dispute');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateManualEntry = async () => {
    if (!manualEntryForm.clientId || !manualEntryForm.payoutAmount.trim()) {
      setError('Client and payout amount are required');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await addLedgerEntry({
        clientId: manualEntryForm.clientId,
        loanFile: manualEntryForm.loanFile.trim() || undefined,
        payoutAmount: parseFloat(manualEntryForm.payoutAmount),
        description: manualEntryForm.description.trim() || undefined,
      });
      setShowManualEntryModal(false);
      setManualEntryForm({ clientId: '', loanFile: '', payoutAmount: '', description: '' });
      alert('Manual ledger entry created.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create ledger entry');
    } finally {
      setSubmitting(false);
    }
  };

  const isCreditLedgerView = userRole === 'credit_team' || userRole === 'admin';

  return (
    <MainLayout
      sidebarItems={sidebarItems}
      activeItem={activeItem}
      onItemClick={handleNavigation}
      pageTitle={t('pages.ledger.pageTitle')}
      userRole={userRole?.replace('_', ' ').toUpperCase() || 'USER'}
      userName={getUserDisplayName()}
      notificationCount={unreadCount}
      notifications={notifications}
      onMarkAsRead={markAsRead}
      onMarkAllAsRead={markAllAsRead}
    >
      <div className="space-y-6">
        <PageHero
          description={t('pages.ledger.description')}
        />
        {/* KAM: Client selector */}
        {userRole === 'kam' && (
          <Card>
            <CardHeader>
              <CardTitle>{t('pages.ledger.selectClient')}</CardTitle>
            </CardHeader>
            <CardContent>
              {clientsLoading ? (
                <p className="text-sm text-neutral-500">{t('pages.ledger.loadingClients')}</p>
              ) : clients.length === 0 ? (
                <p className="text-sm text-neutral-500">{t('pages.ledger.noClientsAssigned')}</p>
              ) : (
                <Select
                  label={t('common.clientLabel')}
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  options={[
                    { value: '', label: t('pages.ledger.selectClientPlaceholder') },
                    ...clients.map((c) => ({ value: c.id, label: c.name })),
                  ]}
                />
              )}
            </CardContent>
          </Card>
        )}

        {/* Credit Team / Admin: Payout Requests */}
        {(userRole === 'credit_team' || userRole === 'admin') && (
          <Card>
            <CardHeader>
              <CardTitle>{t('pages.ledger.payoutRequests')}</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-6 text-neutral-500">{t('pages.ledger.loadingPayoutRequests')}</div>
              ) : pendingPayoutRequests.length === 0 ? (
                <div className="text-center py-6 text-neutral-600">{t('pages.ledger.noPendingPayouts')}</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-neutral-200">
                        <th className="text-left py-3 px-4 text-sm font-medium text-neutral-700">{t('common.clientLabel')}</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-neutral-700">{t('common.amount')}</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-neutral-700">{t('common.date')}</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-neutral-700">{t('common.description')}</th>
                        <th className="text-center py-3 px-4 text-sm font-medium text-neutral-700">{t('common.actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingPayoutRequests.map((p) => (
                        <tr key={p.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                          <td className="py-3 px-4 text-sm text-neutral-700">{p.client ?? p.id}</td>
                          <td className="py-3 px-4 text-sm font-medium text-right text-success">{formatCurrency(p.amount)}</td>
                          <td className="py-3 px-4 text-sm text-neutral-700">{formatDate(p.date ?? '')}</td>
                          <td className="py-3 px-4 text-sm text-neutral-600 max-w-xs truncate">{p.description ?? '-'}</td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-center gap-2">
                              <Button
                                variant="secondary"
                                size="sm"
                                icon={CheckCircle}
                                onClick={() => {
                                  setCreditPayoutForAction(p);
                                  setApproveNote('');
                                  setError(null);
                                  setShowApproveModal(true);
                                }}
                              >
                                {t('common.approve')}
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                icon={XCircle}
                                onClick={() => {
                                  setCreditPayoutForAction(p);
                                  setRejectReason('');
                                  setError(null);
                                  setShowRejectModal(true);
                                }}
                              >
                                {t('common.reject')}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Balance Summary Card */}
        <Card>
          <CardHeader>
            <CardTitle>
              {userRole === 'kam'
                ? t('pages.ledger.clientCommissionBalance')
                : userRole === 'credit_team' || userRole === 'admin'
                  ? t('pages.ledger.allClientsLedger')
                  : t('pages.ledger.commissionBalance')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                {userRole === 'kam' && !selectedClientId ? (
                  <p className="text-neutral-500">{t('pages.ledger.selectClientToView')}</p>
                ) : (
                  <>
                    <p className="text-sm text-neutral-600">{t('pages.ledger.totalEarnings')}</p>
                    <p className="text-xl font-semibold text-success">{formatCurrency(totalEarnings)}</p>
                    {totalFeesDue !== 0 && (
                      <>
                        <p className="text-sm text-neutral-600 mt-2">{t('pages.ledger.amountPayableToUs')}</p>
                        <p className="text-xl font-semibold text-warning">{formatCurrency(Math.abs(totalFeesDue))}</p>
                        <p className="text-xs text-neutral-500">{t('pages.ledger.payableNotReceivedHint')}</p>
                      </>
                    )}
                    <p className="text-sm text-neutral-600 mt-2">{t('pages.ledger.currentBalance')}</p>
                    <p className={`text-3xl font-bold ${balance >= 0 ? 'text-success' : 'text-error'}`}>
                      {formatCurrency(balance)}
                    </p>
                  </>
                )}
              </div>
              {userRole === 'client' && balance > 0 && (
                <Button
                  variant="primary"
                  icon={Send}
                  onClick={() => {
                    setSelectedEntry(null);
                    setShowPayoutModal(true);
                  }}
                >
                  {t('pages.ledger.requestPayout')}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Ledger Entries Table */}
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle>{t('pages.ledger.ledgerEntries')}</CardTitle>
              <p className="text-sm text-neutral-500 mt-1">{t('pages.ledger.ledgerEntriesHint')}</p>
            </div>
            {isCreditLedgerView && (
              <Button variant="secondary" size="sm" onClick={() => setShowManualEntryModal(true)}>
                Add manual entry
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin w-8 h-8 border-4 border-brand-primary border-t-transparent rounded-full mx-auto mb-2"></div>
                <p className="text-sm text-neutral-600">{t('pages.ledger.loadingLedgerEntries')}</p>
              </div>
            ) : entries.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-neutral-600">
                  {userRole === 'kam' && !selectedClientId
                    ? t('pages.ledger.selectClientToView')
                    : t('pages.ledger.noEntries')}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-neutral-200">
                      <th className="text-left py-3 px-4 text-sm font-medium text-neutral-700">{t('common.date')}</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-neutral-700">{t('common.loanFile')}</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-neutral-700">{t('common.description')}</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-neutral-700">{t('common.disbursedAmount')}</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-neutral-700">{t('common.commissionRate')}</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-neutral-700">{t('common.payoutAmount')}</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-neutral-700">{t('common.runningBalance')}</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-neutral-700">{t('common.disputeStatus')}</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-neutral-700">{t('common.payoutRequestCol')}</th>
                      {userRole === 'client' && (
                        <th className="text-center py-3 px-4 text-sm font-medium text-neutral-700">{t('common.actions')}</th>
                      )}
                      {isCreditLedgerView && (
                        <th className="text-center py-3 px-4 text-sm font-medium text-neutral-700">{t('common.actions')}</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry: any, index: number) => {
                      const payoutAmount = parseFloat(entry['Payout Amount'] || entry.payoutAmount || '0');
                      const disbursedAmount = parseFloat(entry['Disbursed Amount'] || entry.disbursedAmount || '0');
                      const commissionRate = entry['Commission Rate'] || entry.commissionRate || '';
                      const runningBalance = entry.runningBalance || entry.balance || 0;
                      
                      return (
                        <tr 
                          key={entry.id || index} 
                          className="border-b border-neutral-100 hover:bg-neutral-50 transition-colors"
                        >
                          <td className="py-3 px-4 text-sm text-neutral-700">
                            {formatDate(entry.Date || entry.date)}
                          </td>
                          <td className="py-3 px-4 text-sm text-neutral-700">
                            {entry['Loan File'] || entry.loanFile || '-'}
                          </td>
                          <td className="py-3 px-4 text-sm text-neutral-700 max-w-xs truncate">
                            {entry.Description || entry.description || '-'}
                          </td>
                          <td className="py-3 px-4 text-sm text-neutral-700 text-right">
                            {disbursedAmount > 0 ? formatCurrency(disbursedAmount) : '-'}
                          </td>
                          <td className="py-3 px-4 text-sm text-neutral-700 text-right">
                            {commissionRate ? `${commissionRate}%` : '-'}
                          </td>
                          <td className={`py-3 px-4 text-sm font-medium text-right ${payoutAmount >= 0 ? 'text-success' : 'text-error'}`}>
                            {payoutAmount !== 0 ? (
                              <>
                                {formatCurrency(payoutAmount)}
                                {payoutAmount < 0 && (
                                  <span className="block text-xs font-normal text-neutral-500 mt-0.5">{t('common.payableToUs')}</span>
                                )}
                              </>
                            ) : '-'}
                          </td>
                          <td className={`py-3 px-4 text-sm font-medium text-right ${runningBalance >= 0 ? 'text-success' : 'text-error'}`}>
                            {formatCurrency(runningBalance)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {getDisputeStatusBadge(entry['Dispute Status'] || entry.disputeStatus || 'None')}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {getPayoutRequestBadge(entry['Payout Request'] || entry.payoutRequest || 'False')}
                          </td>
                          {userRole === 'client' && (
                            <td className="py-3 px-4">
                              <div className="flex items-center justify-center gap-2">
                                {payoutAmount > 0 && (entry['Payout Request'] || entry.payoutRequest) === 'False' && (
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedEntry(entry);
                                      setShowPayoutModal(true);
                                    }}
                                    className="text-xs"
                                  >
                                    {t('pages.ledger.requestPayout')}
                                  </Button>
                                )}
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  icon={MessageSquare}
                                  onClick={() => {
                                    setSelectedEntry(entry);
                                    setShowQueryModal(true);
                                  }}
                                  className="text-xs"
                                >
                                  {t('pages.ledger.raiseQuery')}
                                </Button>
                              </div>
                            </td>
                          )}
                          {isCreditLedgerView && (
                            <td className="py-3 px-4">
                              <div className="flex items-center justify-center gap-2 flex-wrap">
                                {String(entry['Dispute Status'] || entry.disputeStatus || 'None').toLowerCase() === 'none' && (
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    className="text-xs"
                                    onClick={() => {
                                      setSelectedEntry(entry);
                                      setDisputeReason('');
                                      setError(null);
                                      setShowDisputeModal(true);
                                    }}
                                  >
                                    Flag dispute
                                  </Button>
                                )}
                                {String(entry['Dispute Status'] || entry.disputeStatus || '').toLowerCase() === 'open' && (
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    className="text-xs"
                                    onClick={() => {
                                      setSelectedEntry(entry);
                                      setResolveNotes('');
                                      setResolveAdjustedAmount('');
                                      setResolveAccepted(true);
                                      setError(null);
                                      setShowResolveDisputeModal(true);
                                    }}
                                  >
                                    Resolve dispute
                                  </Button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payout Request Modal */}
        {showPayoutModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md mx-4">
              <CardHeader>
                <CardTitle>
                  {selectedEntry ? t('pages.ledger.requestPayoutForEntry') : t('pages.ledger.requestPayout')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedEntry ? (
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-neutral-600 mb-2">{t('common.entryDetails')}</p>
                      <p className="text-sm font-medium">{selectedEntry.Description || selectedEntry.description}</p>
                      <p className="text-sm text-neutral-600">
                        {t('common.amount')}: {formatCurrency(parseFloat(selectedEntry['Payout Amount'] || selectedEntry.payoutAmount || '0'))}
                      </p>
                    </div>
                    <p className="text-sm text-neutral-600">
                      {t('pages.ledger.flagPayoutHint')}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-neutral-600 mb-2">{t('pages.ledger.availableBalance')}</p>
                      <p className="text-2xl font-bold text-success">{formatCurrency(balance)}</p>
                    </div>
                    <Input
                      label={t('pages.ledger.requestAmountLabel')}
                      type="number"
                      placeholder={t('pages.ledger.enterAmount')}
                      value={payoutAmount}
                      onChange={(e) => setPayoutAmount(e.target.value)}
                    />
                    <p className="text-xs text-neutral-500">
                      {t('pages.ledger.fullBalanceHint')}
                    </p>
                  </div>
                )}
                {error && (
                  <div className="mt-4 p-3 bg-error/10 border border-error/30 rounded-lg">
                    <p className="text-sm text-error">{error}</p>
                  </div>
                )}
                <div className="flex gap-3 mt-6">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setShowPayoutModal(false);
                      setSelectedEntry(null);
                      setPayoutAmount('');
                      setError(null);
                    }}
                    disabled={submitting}
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleRequestPayout}
                    loading={submitting}
                    disabled={submitting}
                  >
                    {selectedEntry ? t('pages.ledger.flagForPayout') : t('pages.ledger.requestPayout')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Raise Query Modal */}
        {showQueryModal && selectedEntry && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md mx-4">
              <CardHeader>
                <CardTitle>{t('pages.ledger.raiseQueryOnEntry')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-neutral-600 mb-2">{t('common.entryDetails')}</p>
                    <p className="text-sm font-medium">{selectedEntry.Description || selectedEntry.description}</p>
                    <p className="text-sm text-neutral-600">
                      {t('common.date')}: {formatDate(selectedEntry.Date || selectedEntry.date)}
                    </p>
                    <p className="text-sm text-neutral-600">
                      {t('common.amount')}: {formatCurrency(parseFloat(selectedEntry['Payout Amount'] || selectedEntry.payoutAmount || '0'))}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      {t('pages.ledger.queryMessageRequired')}
                    </label>
                    <textarea
                      value={queryMessage}
                      onChange={(e) => setQueryMessage(e.target.value)}
                      placeholder={t('pages.ledger.queryPlaceholder')}
                      rows={4}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                      required
                    />
                  </div>
                  <p className="text-xs text-neutral-500">
                    {t('pages.ledger.querySentHint')}
                  </p>
                </div>
                {error && (
                  <div className="mt-4 p-3 bg-error/10 border border-error/30 rounded-lg">
                    <p className="text-sm text-error">{error}</p>
                  </div>
                )}
                <div className="flex gap-3 mt-6">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setShowQueryModal(false);
                      setSelectedEntry(null);
                      setQueryMessage('');
                      setError(null);
                    }}
                    disabled={submitting}
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleRaiseQuery}
                    loading={submitting}
                    disabled={!queryMessage.trim() || submitting}
                  >
                    {t('pages.ledger.raiseQuery')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Credit: Approve Payout Modal */}
        {showApproveModal && creditPayoutForAction && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md mx-4">
              <CardHeader>
                <CardTitle>{t('pages.ledger.approvePayout')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-sm text-neutral-600">
                    {t('common.clientLabel')}: <strong>{creditPayoutForAction.client ?? creditPayoutForAction.id}</strong>
                  </p>
                  <p className="text-sm text-neutral-600">
                    {t('common.amount')}: <strong>{formatCurrency(creditPayoutForAction.amount)}</strong>
                  </p>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">{t('common.noteOptional')}</label>
                    <textarea
                      value={approveNote}
                      onChange={(e) => setApproveNote(e.target.value)}
                      placeholder={t('pages.ledger.commissionPayoutPlaceholder')}
                      rows={2}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary"
                    />
                  </div>
                </div>
                {error && (
                  <div className="mt-4 p-3 bg-error/10 border border-error/30 rounded-lg">
                    <p className="text-sm text-error">{error}</p>
                  </div>
                )}
                <div className="flex gap-3 mt-6">
                  <Button variant="secondary" onClick={() => { setShowApproveModal(false); setCreditPayoutForAction(null); setError(null); }} disabled={submitting}>
                    {t('common.cancel')}
                  </Button>
                  <Button variant="primary" onClick={handleApprovePayout} loading={submitting} disabled={submitting}>
                    {t('common.approve')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Credit: Reject Payout Modal */}
        {showRejectModal && creditPayoutForAction && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md mx-4">
              <CardHeader>
                <CardTitle>{t('pages.ledger.rejectPayout')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-sm text-neutral-600">
                    {t('common.clientLabel')}: <strong>{creditPayoutForAction.client ?? creditPayoutForAction.id}</strong>
                  </p>
                  <p className="text-sm text-neutral-600">
                    {t('common.amount')}: <strong>{formatCurrency(creditPayoutForAction.amount)}</strong>
                  </p>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">{t('pages.ledger.rejectionReasonRequired')}</label>
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder={t('pages.ledger.rejectionReasonPlaceholder')}
                      rows={3}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary"
                      required
                    />
                  </div>
                </div>
                {error && (
                  <div className="mt-4 p-3 bg-error/10 border border-error/30 rounded-lg">
                    <p className="text-sm text-error">{error}</p>
                  </div>
                )}
                <div className="flex gap-3 mt-6">
                  <Button variant="secondary" onClick={() => { setShowRejectModal(false); setCreditPayoutForAction(null); setRejectReason(''); setError(null); }} disabled={submitting}>
                    {t('common.cancel')}
                  </Button>
                  <Button variant="primary" onClick={handleRejectPayout} loading={submitting} disabled={!rejectReason.trim() || submitting}>
                    {t('common.reject')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {showDisputeModal && selectedEntry && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md mx-4">
              <CardHeader><CardTitle>Flag ledger dispute</CardTitle></CardHeader>
              <CardContent>
                <textarea
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  placeholder="Reason for dispute"
                  rows={4}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                />
                {error && <p className="text-sm text-error mt-2">{error}</p>}
                <div className="flex gap-3 mt-4">
                  <Button variant="secondary" onClick={() => setShowDisputeModal(false)} disabled={submitting}>Cancel</Button>
                  <Button variant="primary" onClick={handleFlagCreditDispute} loading={submitting} disabled={!disputeReason.trim() || submitting}>Submit</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {showResolveDisputeModal && selectedEntry && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md mx-4">
              <CardHeader><CardTitle>Resolve ledger dispute</CardTitle></CardHeader>
              <CardContent>
                <Select
                  label="Outcome"
                  value={resolveAccepted ? 'accept' : 'reject'}
                  onChange={(e) => setResolveAccepted(e.target.value === 'accept')}
                  options={[
                    { value: 'accept', label: 'Accept dispute' },
                    { value: 'reject', label: 'Reject dispute' },
                  ]}
                />
                <Input
                  label="Adjusted amount (optional)"
                  type="number"
                  value={resolveAdjustedAmount}
                  onChange={(e) => setResolveAdjustedAmount(e.target.value)}
                  className="mt-3"
                />
                <textarea
                  value={resolveNotes}
                  onChange={(e) => setResolveNotes(e.target.value)}
                  placeholder="Notes"
                  rows={3}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg mt-3"
                />
                {error && <p className="text-sm text-error mt-2">{error}</p>}
                <div className="flex gap-3 mt-4">
                  <Button variant="secondary" onClick={() => setShowResolveDisputeModal(false)} disabled={submitting}>Cancel</Button>
                  <Button variant="primary" onClick={handleResolveCreditDispute} loading={submitting} disabled={submitting}>Submit</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {showManualEntryModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md mx-4">
              <CardHeader><CardTitle>Add manual ledger entry</CardTitle></CardHeader>
              <CardContent>
                <Select
                  label="Client"
                  value={manualEntryForm.clientId}
                  onChange={(e) => setManualEntryForm((f) => ({ ...f, clientId: e.target.value }))}
                  options={[
                    { value: '', label: 'Select client' },
                    ...clients.map((c) => ({ value: c.id, label: c.name })),
                  ]}
                />
                <Input
                  label="Loan file (optional)"
                  value={manualEntryForm.loanFile}
                  onChange={(e) => setManualEntryForm((f) => ({ ...f, loanFile: e.target.value }))}
                  className="mt-3"
                />
                <Input
                  label="Payout amount"
                  type="number"
                  value={manualEntryForm.payoutAmount}
                  onChange={(e) => setManualEntryForm((f) => ({ ...f, payoutAmount: e.target.value }))}
                  className="mt-3"
                />
                <Input
                  label="Description (optional)"
                  value={manualEntryForm.description}
                  onChange={(e) => setManualEntryForm((f) => ({ ...f, description: e.target.value }))}
                  className="mt-3"
                />
                {error && <p className="text-sm text-error mt-2">{error}</p>}
                <div className="flex gap-3 mt-4">
                  <Button variant="secondary" onClick={() => setShowManualEntryModal(false)} disabled={submitting}>Cancel</Button>
                  <Button variant="primary" onClick={handleCreateManualEntry} loading={submitting} disabled={submitting}>Create</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </MainLayout>
  );
};
