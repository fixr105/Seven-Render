/**
 * NBFC AI Tools Dashboard
 * 3-column layout: tool list + Recent Reports | tool form | Report Viewer
 * Tools: RAAD, PAGER, Query Drafter. NBFC-only.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { MainLayout } from '../components/layout/MainLayout';
import { useAuth } from '../auth/AuthContext';
import { useNotifications } from '../hooks/useNotifications';
import { useNavigation } from '../hooks/useNavigation';
import { useSidebarItems } from '../hooks/useSidebarItems';
import { apiService } from '../services/api';
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Loader2,
  Copy,
  Send,
  MessageSquare,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const JOB_ID_KEY = 'nbfc_tool_job_id';
const TOOLS_BAR_COLLAPSED_KEY = 'nbfc_tools_bar_collapsed';
const RAAD_REQUEST_UNLOCK_PREFIX = 'nbfc_raad_request_unlock_';

const TOOL_ITEMS = [
  { id: 'raad', label: 'RAAD (Read Assess Allocate Disburse)', icon: BarChart3 },
  { id: 'pager', label: 'PAGER (Lender One-Pager)', icon: FileText },
  { id: 'query', label: 'Query Drafter', icon: MessageSquare },
] as const satisfies readonly { id: string; label: string; icon: LucideIcon }[];

type ToolId = (typeof TOOL_ITEMS)[number]['id'];

const PROGRESS_STAGES = [
  { key: 'uploading', label: 'Uploading' },
  { key: 'parsing', label: 'Parsing Docs' },
  { key: 'flagging', label: 'Flagging Transactions' },
  { key: 'scoring', label: 'Scoring' },
  { key: 'generating', label: 'Generating Report' },
  { key: 'done', label: 'Done' },
];

interface HistoryJob {
  id: string;
  tool: string;
  date: string;
  status: string;
  reportUrl?: string;
  loanApplicationId?: string;
}

export const NBFCTools: React.FC = () => {
  const { user } = useAuth();
  const sidebarItems = useSidebarItems();
  const { activeItem, handleNavigation } = useNavigation(sidebarItems);
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  const [selectedTool, setSelectedTool] = useState<ToolId>('raad');
  const [currentJobId, setCurrentJobId] = useState<string | null>(() =>
    localStorage.getItem(JOB_ID_KEY)
  );
  const [jobStatus, setJobStatus] = useState<'idle' | 'processing' | 'ready' | 'failed'>('idle');
  const [currentStage, setCurrentStage] = useState<string | null>(null);
  const [reportUrl, setReportUrl] = useState<string | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);
  const [currentLoanId, setCurrentLoanId] = useState<string | null>(null);

  const [raadRequestUnlockAt, setRaadRequestUnlockAt] = useState<number | null>(() => {
    const jobId = localStorage.getItem(JOB_ID_KEY);
    if (!jobId) return null;
    const stored = localStorage.getItem(RAAD_REQUEST_UNLOCK_PREFIX + jobId);
    return stored ? parseInt(stored, 10) : null;
  });
  const [raadRequestCountdown, setRaadRequestCountdown] = useState(0);
  const [raadRequestLoading, setRaadRequestLoading] = useState(false);
  const [raadRequestError, setRaadRequestError] = useState<string | null>(null);
  const [raadFetchedHtml, setRaadFetchedHtml] = useState<string | null>(null);

  const [history, setHistory] = useState<HistoryJob[]>([]);
  const [toolsBarCollapsed, setToolsBarCollapsed] = useState(() =>
    localStorage.getItem(TOOLS_BAR_COLLAPSED_KEY) === 'true'
  );

  const toggleToolsBar = () => {
    setToolsBarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(TOOLS_BAR_COLLAPSED_KEY, String(next));
      return next;
    });
  };

  // RAAD
  const [raadGstFile, setRaadGstFile] = useState<File | null>(null);
  const [raadBankFile, setRaadBankFile] = useState<File | null>(null);
  const [raadAuditedFile, setRaadAuditedFile] = useState<File | null>(null);
  const [raadItrFile, setRaadItrFile] = useState<File | null>(null);
  const [raadLoanId, setRaadLoanId] = useState('');
  const [raadSubmitting, setRaadSubmitting] = useState(false);

  // PAGER
  const [pagerBorrowerFile, setPagerBorrowerFile] = useState<File | null>(null);
  const [pagerLetterheadFile, setPagerLetterheadFile] = useState<File | null>(null);
  const [pagerLoanId, setPagerLoanId] = useState('');
  const [pagerSubmitting, setPagerSubmitting] = useState(false);

  // Query Drafter
  const [queryDescription, setQueryDescription] = useState('');
  const [queryTone, setQueryTone] = useState<'formal' | 'urgent' | 'polite'>('formal');
  const [queryLoanId, setQueryLoanId] = useState('');
  const [querySubmitting, setQuerySubmitting] = useState(false);
  const [editableQuery, setEditableQuery] = useState('');

  const getUserDisplayName = () => {
    if (user?.name) return user.name;
    if (user?.email)
      return user.email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
    return '';
  };

  const getRoleDisplayName = () => {
    switch (user?.role) {
      case 'nbfc':
        return 'NBFC Partner';
      default:
        return '';
    }
  };

  const fetchHistory = useCallback(async () => {
    try {
      const res = await apiService.getNBFCToolsHistory();
      if (res.success && res.data?.jobs) {
        const jobs = (
          res.data.jobs as Array<{
            jobId?: string;
            id?: string;
            createdAt?: string;
            date?: string;
            tool?: string;
            status?: string;
            reportUrl?: string;
            loanApplicationId?: string;
          }>
        ).map((j) => ({
          id: j.jobId ?? j.id ?? '',
          tool: j.tool ?? '',
          date: j.createdAt ?? j.date ?? '',
          status: j.status ?? '',
          reportUrl: j.reportUrl,
          loanApplicationId: j.loanApplicationId,
        }));
        setHistory(jobs);
      }
    } catch {
      setHistory([]);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const pollJobStatus = useCallback(async (jobId: string) => {
    try {
      const res = await apiService.getNBFCToolsJobStatus(jobId);
      if (!res.success) return;
      const d = res.data!;
      setCurrentStage(d.stage ?? null);
      setJobError(d.error ?? null);
      if (d.loanApplicationId) setCurrentLoanId(d.loanApplicationId);
      if (d.status === 'ready') {
        setJobStatus('ready');
        setReportUrl(d.reportUrl ?? null);
        localStorage.removeItem(JOB_ID_KEY);
        fetchHistory();
      } else if (d.status === 'failed') {
        setJobStatus('failed');
        localStorage.removeItem(JOB_ID_KEY);
        fetchHistory();
      }
    } catch {
      // Keep polling
    }
  }, [fetchHistory]);

  useEffect(() => {
    if (!currentJobId || jobStatus !== 'processing') return;
    const t = setInterval(() => pollJobStatus(currentJobId), 5000);
    pollJobStatus(currentJobId);
    return () => clearInterval(t);
  }, [currentJobId, jobStatus, pollJobStatus]);

  useEffect(() => {
    if (currentJobId && jobStatus === 'idle') {
      setJobStatus('processing');
      pollJobStatus(currentJobId);
    }
  }, [currentJobId]);

  useEffect(() => {
    if (!currentJobId) return;
    const stored = localStorage.getItem(RAAD_REQUEST_UNLOCK_PREFIX + currentJobId);
    if (stored) setRaadRequestUnlockAt(parseInt(stored, 10));
  }, [currentJobId]);

  useEffect(() => {
    if (raadRequestUnlockAt == null) {
      setRaadRequestCountdown(0);
      return;
    }
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((raadRequestUnlockAt - Date.now()) / 1000));
      setRaadRequestCountdown(remaining);
      if (remaining <= 0) setRaadRequestUnlockAt(null);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [raadRequestUnlockAt]);

  useEffect(() => {
    if (selectedTool !== 'raad') setRaadFetchedHtml(null);
  }, [selectedTool]);

  const handleRequestRaadData = async () => {
    const loanId = currentLoanId?.trim();
    if (!loanId || raadRequestCountdown > 0) return;
    setRaadRequestLoading(true);
    setRaadRequestError(null);
    setRaadFetchedHtml(null);
    try {
      const res = await apiService.requestRAADData(loanId);
      if (!res.success) {
        setRaadRequestError(res.error || 'Request failed');
        return;
      }
      const payload = res.data as { html?: string } | Array<{ html?: string }> | undefined;
      const html =
        payload && typeof payload === 'object' && !Array.isArray(payload)
          ? payload.html
          : Array.isArray(payload) && payload.length > 0 && payload[0]
            ? (payload[0] as { html?: string }).html
            : undefined;
      if (html && typeof html === 'string') setRaadFetchedHtml(html);
      else setRaadRequestError('No HTML in response');
    } catch (err) {
      setRaadRequestError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setRaadRequestLoading(false);
    }
  };

  const handleSelectJob = (job: HistoryJob) => {
    setRaadFetchedHtml(null);
    setCurrentJobId(job.id);
    if (job.loanApplicationId) setCurrentLoanId(job.loanApplicationId);
    if (job.status === 'ready' && job.reportUrl) {
      setReportUrl(job.reportUrl);
      setJobStatus('ready');
      setJobError(null);
    } else if (job.status === 'processing') {
      localStorage.setItem(JOB_ID_KEY, job.id);
      setJobStatus('processing');
      setReportUrl(null);
      setJobError(null);
    } else {
      setJobError(job.status === 'failed' ? 'Job failed' : 'Processing...');
      setReportUrl(null);
      setJobStatus(job.status === 'failed' ? 'failed' : 'processing');
    }
  };

  const handleRaadSubmit = async () => {
    if (!raadGstFile || !raadBankFile || !raadAuditedFile || !raadItrFile || !raadLoanId.trim())
      return;
    setRaadSubmitting(true);
    setJobError(null);
    try {
      const fd = new FormData();
      fd.append('gstFile', raadGstFile);
      fd.append('bankFile', raadBankFile);
      fd.append('auditedFile', raadAuditedFile);
      fd.append('itrFile', raadItrFile);
      fd.append('loanApplicationId', raadLoanId.trim());
      const res = await apiService.submitRAADJob(fd);
      if (res.success && res.data?.jobId) {
        const jobId = res.data.jobId;
        setCurrentJobId(jobId);
        setCurrentLoanId(raadLoanId.trim());
        localStorage.setItem(JOB_ID_KEY, jobId);
        const unlockAt = Date.now() + 60_000;
        setRaadRequestUnlockAt(unlockAt);
        localStorage.setItem(RAAD_REQUEST_UNLOCK_PREFIX + jobId, String(unlockAt));
        setJobStatus('processing');
        setCurrentStage('uploading');
        setReportUrl(null);
        setJobError(null);
        fetchHistory();
      } else {
        setJobError(res.error || 'RAAD submission failed. Try logging in again.');
        setJobStatus('failed');
      }
    } catch (err) {
      setJobError(err instanceof Error ? err.message : 'RAAD submission failed.');
      setJobStatus('failed');
    } finally {
      setRaadSubmitting(false);
    }
  };

  const handlePagerSubmit = async () => {
    if (!pagerBorrowerFile) return;
    setPagerSubmitting(true);
    setJobError(null);
    try {
      const fd = new FormData();
      fd.append('borrowerFile', pagerBorrowerFile);
      if (pagerLetterheadFile) fd.append('letterheadFile', pagerLetterheadFile);
      if (pagerLoanId) fd.append('loanApplicationId', pagerLoanId);
      const res = await apiService.submitPAGERJob(fd);
      if (res.success && res.data?.jobId) {
        setCurrentJobId(res.data.jobId);
        localStorage.setItem(JOB_ID_KEY, res.data.jobId);
        setJobStatus('processing');
        setCurrentStage('uploading');
        setReportUrl(null);
        setJobError(null);
        fetchHistory();
      } else {
        setJobError(res.error || 'PAGER submission failed. Try logging in again.');
        setJobStatus('failed');
      }
    } catch (err) {
      setJobError(err instanceof Error ? err.message : 'PAGER submission failed.');
      setJobStatus('failed');
    } finally {
      setPagerSubmitting(false);
    }
  };

  const handleQueryDraft = async () => {
    if (!queryDescription.trim()) return;
    setQuerySubmitting(true);
    try {
      const res = await apiService.submitQueryDrafter({
        roughQuery: queryDescription.trim(),
        tone: queryTone,
        documentText: '',
        loanApplicationId: queryLoanId.trim() || undefined,
      });
      if (res.success && res.data?.draftedQuery) {
        setEditableQuery(res.data.draftedQuery);
      }
    } finally {
      setQuerySubmitting(false);
    }
  };

  const handleCopyQuery = () => {
    navigator.clipboard.writeText(editableQuery);
  };

  const handleSendQuery = async () => {
    if (!queryLoanId.trim()) return;
    try {
      await apiService.raiseNBFCQuery(queryLoanId.trim(), { message: editableQuery });
      setEditableQuery('');
    } catch {
      // Error feedback
    }
  };

  const UploadZone: React.FC<{
    label: string;
    note?: string;
    file: File | null;
    onFile: (f: File | null) => void;
    accept?: string;
    required?: boolean;
  }> = ({ label, note, file, onFile, accept = '.pdf' }) => {
    const [dragging, setDragging] = useState(false);
    return (
      <div className="mb-4">
        <label className="block text-sm font-medium text-neutral-700 mb-1">{label}</label>
        {note && <p className="text-xs text-neutral-500 mb-1">{note}</p>}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files[0];
            if (f) onFile(f);
          }}
          onClick={() => document.getElementById(`upload-${label}`)?.click()}
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
            dragging ? 'border-[#332f78] bg-[#f8f9ff]' : 'border-neutral-300 hover:border-neutral-400'
          }`}
        >
          <input
            id={`upload-${label}`}
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          />
          {file ? (
            <p className="text-sm text-neutral-700">{file.name}</p>
          ) : (
            <p className="text-sm text-neutral-500">Drag & drop or click to upload</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <MainLayout
      hideSidebar
      sidebarItems={sidebarItems}
      activeItem={activeItem}
      onItemClick={handleNavigation}
      pageTitle="AI Tools"
      userRole={getRoleDisplayName()}
      userName={getUserDisplayName()}
      notificationCount={unreadCount}
      notifications={notifications}
      onMarkAsRead={markAsRead}
      onMarkAllAsRead={markAllAsRead}
      fullBleed
    >
      <div
        className="grid h-full min-h-0 transition-[grid-template-columns] duration-300 ease-in-out"
        style={{
          gridTemplateColumns: toolsBarCollapsed ? '64px 1fr 380px' : '220px 1fr 380px',
        }}
      >
        {/* LEFT COLUMN - Retractable AI Tools bar */}
        <div className="bg-[#1a1a2e] flex flex-col overflow-hidden">
          {/* Header with toggle */}
          <div className="flex items-center justify-between px-4 pt-6 pb-4 flex-shrink-0">
            {toolsBarCollapsed ? (
              <button
                onClick={toggleToolsBar}
                className="w-full flex justify-center p-2 text-neutral-400 hover:text-white transition-colors"
                aria-label="Expand tools bar"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            ) : (
              <>
                <h2 className="text-white text-sm font-medium uppercase tracking-wider truncate flex-1">
                  AI Tools
                </h2>
                <button
                  onClick={toggleToolsBar}
                  className="p-1 text-neutral-400 hover:text-white transition-colors flex-shrink-0"
                  aria-label="Collapse tools bar"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
          <nav className="flex flex-col flex-1 min-h-0">
            {TOOL_ITEMS.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedTool(t.id)}
                  title={t.label}
                  className={`flex items-center gap-3 border-l-4 transition-colors ${
                    toolsBarCollapsed ? 'justify-center px-0 py-3' : 'text-left px-4 py-3 text-sm'
                  } ${
                    selectedTool === t.id
                      ? 'border-[#332f78] bg-white/5 text-white'
                      : 'border-transparent text-neutral-500 hover:text-neutral-300'
                  }`}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {!toolsBarCollapsed && <span className="truncate">{t.label}</span>}
                </button>
              );
            })}
          </nav>
          {!toolsBarCollapsed && (
            <div className="mt-auto border-t border-white/10 px-4 py-4">
              <h3 className="text-white text-xs font-medium uppercase tracking-wider mb-3">
                Recent Reports
              </h3>
              {history.length === 0 ? (
                <p className="text-neutral-500 text-xs">No reports yet</p>
              ) : (
                <ul className="space-y-2">
                  {history.map((j) => (
                    <li key={j.id}>
                      <button
                        onClick={() => handleSelectJob(j)}
                        className="text-left w-full text-xs text-neutral-400 hover:text-white transition-colors"
                      >
                        <span className="block truncate font-medium text-white/90">
                          {j.tool === 'raad' ? 'RAAD' : j.tool === 'pager' ? 'PAGER' : j.tool}
                        </span>
                        <span className="block truncate">
                          {new Date(j.date).toLocaleDateString()} ·{' '}
                          <span
                            className={
                              j.status === 'ready'
                                ? 'text-green-400'
                                : j.status === 'failed'
                                  ? 'text-red-400'
                                  : 'text-amber-400'
                            }
                          >
                            {j.status === 'ready'
                              ? 'Ready'
                              : j.status === 'failed'
                                ? 'Failed'
                                : 'Processing'}
                          </span>
                        </span>
                        {j.status === 'ready' && j.reportUrl && (
                          <Download className="inline w-3 h-3 ml-1" />
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* CENTER COLUMN */}
        <div className="bg-white overflow-y-auto p-6">
          {selectedTool === 'raad' && (
            <>
              <h3 className="text-xl font-semibold text-neutral-900 mb-1">
                RAAD — Credit Analysis
              </h3>
              <p className="text-sm text-neutral-600 mb-6">
                Upload GST, Bank Statement, Audited Financials, and ITR. All files are sent as
                GST.pdf, BANK.pdf, AUDITED.pdf, ITR.pdf. Loan ID is required.
              </p>
              <UploadZone
                label="GST (PDF, sent as GST.pdf)"
                file={raadGstFile}
                onFile={setRaadGstFile}
                required
              />
              <UploadZone
                label="Bank Statement (PDF, sent as BANK.pdf)"
                file={raadBankFile}
                onFile={setRaadBankFile}
                required
              />
              <UploadZone
                label="Audited Financials (PDF, sent as AUDITED.pdf)"
                file={raadAuditedFile}
                onFile={setRaadAuditedFile}
                required
              />
              <UploadZone
                label="ITR (PDF, sent as ITR.pdf)"
                file={raadItrFile}
                onFile={setRaadItrFile}
                required
              />
              <div className="mb-4">
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Loan Application ID (required)
                </label>
                <input
                  type="text"
                  value={raadLoanId}
                  onChange={(e) => setRaadLoanId(e.target.value)}
                  placeholder="Required for tagging the report"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm"
                />
              </div>
              <button
                onClick={handleRaadSubmit}
                disabled={
                  !raadGstFile ||
                  !raadBankFile ||
                  !raadAuditedFile ||
                  !raadItrFile ||
                  !raadLoanId.trim() ||
                  raadSubmitting
                }
                className="px-6 py-3 bg-[#332f78] text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#2a265f] transition-colors"
              >
                {raadSubmitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Submitting...
                  </span>
                ) : (
                  'Run RAAD Analysis'
                )}
              </button>
              {jobStatus === 'processing' && currentJobId && (
                <div className="mt-6">
                  <div className="flex gap-2 flex-wrap mb-2">
                    {PROGRESS_STAGES.map((s, i) => {
                      const idx = PROGRESS_STAGES.findIndex((x) => x.key === currentStage);
                      const active = (idx >= 0 ? idx : 0) >= i;
                      return (
                        <span
                          key={s.key}
                          className={`text-xs px-2 py-1 rounded ${
                            active ? 'bg-[#332f78]/20 text-[#332f78]' : 'bg-neutral-100 text-neutral-500'
                          }`}
                        >
                          {s.label}
                        </span>
                      );
                    })}
                  </div>
                  <p className="text-xs text-neutral-500">
                    Polling every 5 seconds. You can leave and come back — your report will be saved.
                  </p>
                </div>
              )}
            </>
          )}

          {selectedTool === 'pager' && (
            <>
              <h3 className="text-xl font-semibold text-neutral-900 mb-1">
                PAGER — Lender One-Pager
              </h3>
              <p className="text-sm text-neutral-600 mb-6">
                Upload borrower documents and optionally your branded letterhead. We'll generate a
                clean lender-ready one-pager.
              </p>
              <UploadZone
                label="Borrower Documents (PDF)"
                file={pagerBorrowerFile}
                onFile={setPagerBorrowerFile}
                required
              />
              <UploadZone
                label="Your Branded Letterhead (PDF, optional)"
                note="Upload a blank branded page. The report will be overlaid on your template."
                file={pagerLetterheadFile}
                onFile={setPagerLetterheadFile}
              />
              <div className="mb-4">
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Loan Application ID (optional)
                </label>
                <input
                  type="text"
                  value={pagerLoanId}
                  onChange={(e) => setPagerLoanId(e.target.value)}
                  placeholder="For tagging the report"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm"
                />
              </div>
              <button
                onClick={handlePagerSubmit}
                disabled={!pagerBorrowerFile || pagerSubmitting}
                className="px-6 py-3 bg-[#332f78] text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#2a265f] transition-colors"
              >
                {pagerSubmitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Submitting...
                  </span>
                ) : (
                  'Generate One-Pager'
                )}
              </button>
              {jobStatus === 'processing' && currentJobId && (
                <div className="mt-6">
                  <div className="flex gap-2 flex-wrap mb-2">
                    {PROGRESS_STAGES.map((s, i) => {
                      const idx = PROGRESS_STAGES.findIndex((x) => x.key === currentStage);
                      const active = (idx >= 0 ? idx : 0) >= i;
                      return (
                        <span
                          key={s.key}
                          className={`text-xs px-2 py-1 rounded ${
                            active ? 'bg-[#332f78]/20 text-[#332f78]' : 'bg-neutral-100 text-neutral-500'
                          }`}
                        >
                          {s.label}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {selectedTool === 'query' && (
            <>
              <h3 className="text-xl font-semibold text-neutral-900 mb-1">Query Drafter</h3>
              <p className="text-sm text-neutral-600 mb-6">
                Upload the loan file or any relevant document and describe what's unclear. We'll
                draft a professional query for you.
              </p>
              <div className="mb-4">
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Loan Application ID (optional)
                </label>
                <input
                  type="text"
                  value={queryLoanId}
                  onChange={(e) => setQueryLoanId(e.target.value)}
                  placeholder="For tagging when sending as query"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm mb-4"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  What do you want to ask? Describe in your own words...
                </label>
                <textarea
                  value={queryDescription}
                  onChange={(e) => setQueryDescription(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm resize-y"
                  placeholder="e.g. Please clarify the applicant's CIBIL score and repayment history..."
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-neutral-700 mb-2">Tone</label>
                <div className="flex gap-2">
                  {(['formal', 'urgent', 'polite'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setQueryTone(t)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                        queryTone === t
                          ? 'bg-[#332f78] text-white'
                          : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={handleQueryDraft}
                disabled={!queryDescription.trim() || querySubmitting}
                className="px-6 py-3 bg-[#332f78] text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#2a265f] transition-colors mb-6"
              >
                {querySubmitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Drafting...
                  </span>
                ) : (
                  'Draft Query'
                )}
              </button>
              {editableQuery && (
                <div className="border border-neutral-200 rounded-lg p-4 bg-neutral-50">
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Drafted Query
                  </label>
                  <textarea
                    value={editableQuery}
                    onChange={(e) => setEditableQuery(e.target.value)}
                    rows={5}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm bg-white mb-3"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleCopyQuery}
                      className="flex items-center gap-2 px-4 py-2 bg-white border border-neutral-300 rounded-lg text-sm font-medium hover:bg-neutral-50"
                    >
                      <Copy className="w-4 h-4" /> Copy
                    </button>
                    {queryLoanId && (
                      <button
                        onClick={handleSendQuery}
                        className="flex items-center gap-2 px-4 py-2 bg-[#332f78] text-white rounded-lg text-sm font-medium hover:bg-[#2a265f]"
                      >
                        <Send className="w-4 h-4" /> Send as Query
                      </button>
                    )}
                  </div>
                  {!queryLoanId && (
                    <p className="text-xs text-neutral-500 mt-2">
                      Enter Loan Application ID in the form above to enable &quot;Send as Query&quot;
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* RIGHT COLUMN */}
        <div className="bg-[#f8f9ff] flex flex-col overflow-hidden border-l border-neutral-200">
          <h3 className="px-4 py-4 text-lg font-semibold text-neutral-900 border-b border-neutral-200">
            Report Viewer
          </h3>
          <div className="flex-1 flex flex-col min-h-0 p-4">
            {jobStatus === 'idle' && !reportUrl && (
              <div className="flex flex-col items-center justify-center flex-1 text-center text-neutral-500">
                <FileText className="w-16 h-16 mb-4 opacity-40" />
                <p>Run a tool to see results here</p>
              </div>
            )}
            {jobStatus === 'processing' && !raadFetchedHtml && (
              <div className="flex flex-col items-center justify-center flex-1 text-center">
                <Loader2 className="w-12 h-12 text-[#332f78] animate-pulse mb-4" />
                <p className="text-neutral-700 font-medium mb-1">Processing...</p>
                <p className="text-sm text-neutral-500">
                  This can take 1–3 minutes. You can leave this page and come back — your report will
                  be saved.
                </p>
                {selectedTool === 'raad' && currentLoanId && (
                  <div className="mt-4 w-full max-w-xs">
                    <button
                      onClick={handleRequestRaadData}
                      disabled={raadRequestCountdown > 0 || raadRequestLoading}
                      className={`flex items-center justify-center gap-2 w-full px-4 py-2 rounded-lg text-sm font-medium ${
                        raadRequestCountdown > 0 || raadRequestLoading
                          ? 'bg-neutral-200 text-neutral-500 cursor-not-allowed'
                          : 'bg-[#332f78] text-white hover:bg-[#2a265f]'
                      }`}
                    >
                      <RefreshCw className={`w-4 h-4 ${raadRequestLoading ? 'animate-spin' : ''}`} />
                      {raadRequestCountdown > 0
                        ? `Request data (${currentLoanId}) — ${raadRequestCountdown}s`
                        : raadRequestLoading
                          ? 'Requesting...'
                          : `Request RAAD data (${currentLoanId})`}
                    </button>
                    {raadRequestError && <p className="mt-2 text-xs text-red-500">{raadRequestError}</p>}
                  </div>
                )}
              </div>
            )}
            {raadFetchedHtml && (
              <div className="flex flex-col flex-1 min-h-0">
                <iframe
                  srcDoc={raadFetchedHtml}
                  title="RAAD Deal Brief"
                  sandbox="allow-same-origin"
                  className="flex-1 w-full min-h-[400px] rounded border border-neutral-200 bg-white"
                />
                <div className="mt-4 flex flex-col gap-2">
                  {selectedTool === 'raad' && currentLoanId && (
                    <button
                      onClick={handleRequestRaadData}
                      disabled={raadRequestCountdown > 0 || raadRequestLoading}
                      className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${
                        raadRequestCountdown > 0 || raadRequestLoading
                          ? 'bg-neutral-200 text-neutral-500 cursor-not-allowed'
                          : 'bg-neutral-100 border border-neutral-300 text-neutral-700 hover:bg-neutral-200'
                      }`}
                    >
                      <RefreshCw className={`w-4 h-4 ${raadRequestLoading ? 'animate-spin' : ''}`} />
                      {raadRequestCountdown > 0
                        ? `Request data: ${currentLoanId} (${raadRequestCountdown}s)`
                        : raadRequestLoading
                          ? 'Requesting...'
                          : `Request data: ${currentLoanId}`}
                    </button>
                  )}
                  {reportUrl && (
                    <a
                      href={reportUrl.startsWith('/') ? `${window.location.origin}${reportUrl}` : reportUrl}
                      download
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-[#332f78] text-white rounded-lg text-sm font-medium hover:bg-[#2a265f]"
                    >
                      <Download className="w-4 h-4" /> Download PDF
                    </a>
                  )}
                  {raadRequestError && <p className="text-xs text-red-500">{raadRequestError}</p>}
                  <p className="text-xs text-neutral-500">Report saved for 30 days</p>
                </div>
              </div>
            )}
            {jobStatus === 'ready' && reportUrl && !raadFetchedHtml && (
              <div className="flex flex-col flex-1 min-h-0">
                <iframe
                  src={reportUrl.startsWith('http') ? reportUrl : `${window.location.origin}${reportUrl.startsWith('/') ? reportUrl : `/${reportUrl}`}`}
                  title="Report PDF"
                  className="flex-1 w-full min-h-[400px] rounded border border-neutral-200 bg-white"
                />
                <div className="mt-4 flex flex-col gap-2">
                  {selectedTool === 'raad' && currentLoanId && (
                    <button
                      onClick={handleRequestRaadData}
                      disabled={raadRequestCountdown > 0 || raadRequestLoading}
                      className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${
                        raadRequestCountdown > 0 || raadRequestLoading
                          ? 'bg-neutral-200 text-neutral-500 cursor-not-allowed'
                          : 'bg-neutral-100 border border-neutral-300 text-neutral-700 hover:bg-neutral-200'
                      }`}
                    >
                      <RefreshCw className={`w-4 h-4 ${raadRequestLoading ? 'animate-spin' : ''}`} />
                      {raadRequestCountdown > 0
                        ? `Request data: ${currentLoanId} (${raadRequestCountdown}s)`
                        : raadRequestLoading
                          ? 'Requesting...'
                          : `Request data: ${currentLoanId}`}
                    </button>
                  )}
                  <a
                    href={reportUrl.startsWith('/') ? `${window.location.origin}${reportUrl}` : reportUrl}
                    download
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-[#332f78] text-white rounded-lg text-sm font-medium hover:bg-[#2a265f]"
                  >
                    <Download className="w-4 h-4" /> Download PDF
                  </a>
                  {raadRequestError && <p className="text-xs text-red-500">{raadRequestError}</p>}
                  <p className="text-xs text-neutral-500">Report saved for 30 days</p>
                </div>
              </div>
            )}
            {jobStatus === 'failed' && (
              <div className="flex flex-col items-center justify-center flex-1 text-center">
                <AlertCircle className="w-12 h-12 text-error mb-4" />
                <p className="text-neutral-700 font-medium mb-1">Failed</p>
                <p className="text-sm text-neutral-500 mb-4">{jobError || 'Something went wrong.'}</p>
                <button
                  onClick={() => {
                    setJobStatus('idle');
                    setJobError(null);
                    setCurrentJobId(null);
                  }}
                  className="px-4 py-2 bg-[#332f78] text-white rounded-lg text-sm font-medium"
                >
                  Try Again
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
};
