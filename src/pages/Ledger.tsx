import React, { useState, useEffect } from 'react';
import { MainLayout } from '../components/layout/MainLayout';
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
  const { entries, balance, loading, requestPayout, raiseQuery, flagPayout, payoutRequests, refetchPayoutRequests } = useLedger(ledgerOptions);

  useEffect(() => {
    if (userRole === 'kam') {
      setClientsLoading(true);
      apiService.listClients()
        .then((res) => {
          if (res.success && res.data) {
            const list = (res.data as any[]).map((c: any) => ({
              id: c.id || c['Client ID'] || '',
              name: c.name || c.company_name || c['Client Name'] || c['Primary Contact Name'] || 'Unknown',
            })).filter((c) => c.id);
            setClients(list);
            if (list.length > 0) {
              setSelectedClientId((prev) => (prev ? prev : list[0].id));
            }
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
        alert('Payout request created successfully!');
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
        alert('Entry flagged for payout request!');
      } catch (err: any) {
        setError(err.message || 'Failed to flag payout');
      } finally {
        setSubmitting(false);
      }
    }
  };

  const handleRaiseQuery = async () => {
    if (!selectedEntry || !queryMessage.trim()) {
      setError('Please enter a query message');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await raiseQuery(selectedEntry.id, queryMessage);
      setShowQueryModal(false);
      setQueryMessage('');
      setSelectedEntry(null);
      alert('Query raised successfully!');
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
        return <span className="px-2 py-1 text-xs font-medium rounded bg-warning/20 text-warning">Under Query</span>;
      case 'Resolved':
      case 'RESOLVED':
        return <span className="px-2 py-1 text-xs font-medium rounded bg-success/20 text-success">Resolved</span>;
      default:
        return <span className="px-2 py-1 text-xs font-medium rounded bg-neutral-100 text-neutral-600">None</span>;
    }
  };

  const getPayoutRequestBadge = (status: string) => {
    switch (status) {
      case 'Requested':
        return <span className="px-2 py-1 text-xs font-medium rounded bg-brand-primary/20 text-brand-primary">Requested</span>;
      case 'Paid':
        return <span className="px-2 py-1 text-xs font-medium rounded bg-success/20 text-success">Paid</span>;
      case 'Rejected':
        return <span className="px-2 py-1 text-xs font-medium rounded bg-error/20 text-error">Rejected</span>;
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
      setError('Invalid amount');
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
        alert('Payout approved successfully.');
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
      setError('Please enter a rejection reason');
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
        alert('Payout rejected.');
      } else {
        setError(res.error || 'Failed to reject payout');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to reject payout');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <MainLayout
      sidebarItems={sidebarItems}
      activeItem={activeItem}
      onItemClick={handleNavigation}
      pageTitle="Commission Ledger"
      userRole={userRole?.replace('_', ' ').toUpperCase() || 'USER'}
      userName={getUserDisplayName()}
        notificationCount={unreadCount}
        notifications={notifications}
        onMarkAsRead={markAsRead}
        onMarkAllAsRead={markAllAsRead}
    >
      <div className="space-y-6">
        {/* KAM: Client selector */}
        {userRole === 'kam' && (
          <Card>
            <CardHeader>
              <CardTitle>Select Client</CardTitle>
            </CardHeader>
            <CardContent>
              {clientsLoading ? (
                <p className="text-sm text-neutral-500">Loading clients...</p>
              ) : clients.length === 0 ? (
                <p className="text-sm text-neutral-500">No clients assigned to you.</p>
              ) : (
                <Select
                  label="Client"
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  options={[
                    { value: '', label: 'Select a client...' },
                    ...clients.map((c) => ({ value: c.id, label: c.name })),
                  ]}
                />
              )}
            </CardContent>
          </Card>
        )}

        {/* Credit Team: Payout Requests */}
        {userRole === 'credit_team' && (
          <Card>
            <CardHeader>
              <CardTitle>Payout Requests</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-6 text-neutral-500">Loading payout requests...</div>
              ) : pendingPayoutRequests.length === 0 ? (
                <div className="text-center py-6 text-neutral-600">No pending payout requests.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-neutral-200">
                        <th className="text-left py-3 px-4 text-sm font-medium text-neutral-700">Client</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-neutral-700">Amount</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-neutral-700">Date</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-neutral-700">Description</th>
                        <th className="text-center py-3 px-4 text-sm font-medium text-neutral-700">Actions</th>
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
                                Approve
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
                                Reject
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
              {userRole === 'kam' ? 'Client Commission Balance' : 'Commission Balance'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-600 mb-1">Current Balance</p>
                {userRole === 'kam' && !selectedClientId ? (
                  <p className="text-neutral-500">Select a client to view their commission ledger</p>
                ) : (
                  <p className={`text-3xl font-bold ${balance >= 0 ? 'text-success' : 'text-error'}`}>
                    {formatCurrency(balance)}
                  </p>
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
                  Request Payout
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Ledger Entries Table */}
      <Card>
        <CardHeader>
            <CardTitle>Ledger Entries</CardTitle>
        </CardHeader>
        <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin w-8 h-8 border-4 border-brand-primary border-t-transparent rounded-full mx-auto mb-2"></div>
                <p className="text-sm text-neutral-600">Loading ledger entries...</p>
              </div>
            ) : entries.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-neutral-600">
                  {userRole === 'kam' && !selectedClientId
                    ? 'Select a client to view their commission ledger'
                    : 'No ledger entries found'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-neutral-200">
                      <th className="text-left py-3 px-4 text-sm font-medium text-neutral-700">Date</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-neutral-700">Loan File</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-neutral-700">Description</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-neutral-700">Disbursed Amount</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-neutral-700">Commission Rate</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-neutral-700">Payout Amount</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-neutral-700">Running Balance</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-neutral-700">Dispute Status</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-neutral-700">Payout Request</th>
                      {userRole === 'client' && (
                        <th className="text-center py-3 px-4 text-sm font-medium text-neutral-700">Actions</th>
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
                            {payoutAmount !== 0 ? formatCurrency(payoutAmount) : '-'}
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
                                    Request Payout
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
                                  Raise Query
                                </Button>
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
                  {selectedEntry ? 'Request Payout for Entry' : 'Request Payout'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedEntry ? (
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-neutral-600 mb-2">Entry Details:</p>
                      <p className="text-sm font-medium">{selectedEntry.Description || selectedEntry.description}</p>
                      <p className="text-sm text-neutral-600">
                        Amount: {formatCurrency(parseFloat(selectedEntry['Payout Amount'] || selectedEntry.payoutAmount || '0'))}
                      </p>
                    </div>
                    <p className="text-sm text-neutral-600">
                      This will flag this entry for payout request. The credit team will review and process your request.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-neutral-600 mb-2">Available Balance:</p>
                      <p className="text-2xl font-bold text-success">{formatCurrency(balance)}</p>
                    </div>
                    <Input
                      label="Request Amount (leave empty for full balance)"
                      type="number"
                      placeholder="Enter amount"
                      value={payoutAmount}
                      onChange={(e) => setPayoutAmount(e.target.value)}
                    />
                    <p className="text-xs text-neutral-500">
                      Leave empty to request the full available balance
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
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleRequestPayout}
                    loading={submitting}
                    disabled={submitting}
                  >
                    {selectedEntry ? 'Flag for Payout' : 'Request Payout'}
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
                <CardTitle>Raise Query on Ledger Entry</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-neutral-600 mb-2">Entry Details:</p>
                    <p className="text-sm font-medium">{selectedEntry.Description || selectedEntry.description}</p>
                    <p className="text-sm text-neutral-600">
                      Date: {formatDate(selectedEntry.Date || selectedEntry.date)}
                    </p>
                    <p className="text-sm text-neutral-600">
                      Amount: {formatCurrency(parseFloat(selectedEntry['Payout Amount'] || selectedEntry.payoutAmount || '0'))}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Query Message *
                    </label>
                    <textarea
                      value={queryMessage}
                      onChange={(e) => setQueryMessage(e.target.value)}
                      placeholder="Enter your query or dispute reason..."
                      rows={4}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                      required
                    />
                  </div>
                  <p className="text-xs text-neutral-500">
                    Your query will be sent to the credit team for review. They will respond via the audit log.
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
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleRaiseQuery}
                    loading={submitting}
                    disabled={!queryMessage.trim() || submitting}
                  >
                    Raise Query
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
                <CardTitle>Approve Payout</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-sm text-neutral-600">
                    Client: <strong>{creditPayoutForAction.client ?? creditPayoutForAction.id}</strong>
                  </p>
                  <p className="text-sm text-neutral-600">
                    Amount: <strong>{formatCurrency(creditPayoutForAction.amount)}</strong>
                  </p>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Note (optional)</label>
                    <textarea
                      value={approveNote}
                      onChange={(e) => setApproveNote(e.target.value)}
                      placeholder="e.g. Commission payout"
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
                    Cancel
                  </Button>
                  <Button variant="primary" onClick={handleApprovePayout} loading={submitting} disabled={submitting}>
                    Approve
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
                <CardTitle>Reject Payout</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-sm text-neutral-600">
                    Client: <strong>{creditPayoutForAction.client ?? creditPayoutForAction.id}</strong>
                  </p>
                  <p className="text-sm text-neutral-600">
                    Amount: <strong>{formatCurrency(creditPayoutForAction.amount)}</strong>
                  </p>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Reason for rejection *</label>
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Enter reason..."
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
                    Cancel
                  </Button>
                  <Button variant="primary" onClick={handleRejectPayout} loading={submitting} disabled={!rejectReason.trim() || submitting}>
                    Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </MainLayout>
  );
};
