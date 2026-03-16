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
  Download,
  FileText,
  Loader2,
  Copy,
  Send,
  AlertCircle,
} from 'lucide-react';

const JOB_ID_KEY = 'nbfc_tool_job_id';

const TOOL_ITEMS = [
  { id: 'raad', label: 'RAAD (Read Assess Allocate Disburse)' },
  { id: 'pager', label: 'PAGER (Lender One-Pager)' },
  { id: 'query', label: 'Query Drafter' },
] as const;

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

  const [history, setHistory] = useState<HistoryJob[]>([]);

  // RAAD
  const [raadBankFile, setRaadBankFile] = useState<File | null>(null);
  const [raadGstFile, setRaadGstFile] = useState<File | null>(null);
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
          }>
        ).map((j) => ({
          id: j.jobId ?? j.id ?? '',
          tool: j.tool ?? '',
          date: j.createdAt ?? j.date ?? '',
          status: j.status ?? '',
          reportUrl: j.reportUrl,
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

  const handleSelectJob = (job: HistoryJob) => {
    if (job.status === 'ready' && job.reportUrl) {
      setReportUrl(job.reportUrl);
      setJobStatus('ready');
      setJobError(null);
    } else if (job.status === 'processing') {
      setCurrentJobId(job.id);
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
    if (!raadBankFile) return;
    setRaadSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('bankFile', raadBankFile);
      if (raadGstFile) fd.append('gstFile', raadGstFile);
      if (raadLoanId) fd.append('loanApplicationId', raadLoanId);
      const res = await apiService.submitRAADJob(fd);
      if (res.success && res.data?.jobId) {
        setCurrentJobId(res.data.jobId);
        localStorage.setItem(JOB_ID_KEY, res.data.jobId);
        setJobStatus('processing');
        setCurrentStage('uploading');
        setReportUrl(null);
        setJobError(null);
        fetchHistory();
      }
    } finally {
      setRaadSubmitting(false);
    }
  };

  const handlePagerSubmit = async () => {
    if (!pagerBorrowerFile) return;
    setPagerSubmitting(true);
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
      }
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
      <div className="grid grid-cols-[220px_1fr_380px] h-full min-h-0">
        {/* LEFT COLUMN */}
        <div className="bg-[#1a1a2e] flex flex-col overflow-hidden">
          <h2 className="text-white text-sm font-medium uppercase tracking-wider px-4 pt-6 pb-4">
            AI Tools
          </h2>
          <nav className="flex flex-col">
            {TOOL_ITEMS.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedTool(t.id)}
                className={`text-left px-4 py-3 text-sm border-l-4 transition-colors ${
                  selectedTool === t.id
                    ? 'border-[#332f78] bg-white/5 text-white'
                    : 'border-transparent text-neutral-500 hover:text-neutral-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
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
        </div>

        {/* CENTER COLUMN */}
        <div className="bg-white overflow-y-auto p-6">
          {selectedTool === 'raad' && (
            <>
              <h3 className="text-xl font-semibold text-neutral-900 mb-1">
                RAAD — Credit Analysis
              </h3>
              <p className="text-sm text-neutral-600 mb-6">
                Upload the borrower's bank statement and GST documents. We'll analyze, flag, and
                recommend.
              </p>
              <UploadZone
                label="Bank Statement (PDF)"
                file={raadBankFile}
                onFile={setRaadBankFile}
                required
              />
              <UploadZone label="GST Document (PDF)" file={raadGstFile} onFile={setRaadGstFile} />
              <div className="mb-4">
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Loan Application ID (optional)
                </label>
                <input
                  type="text"
                  value={raadLoanId}
                  onChange={(e) => setRaadLoanId(e.target.value)}
                  placeholder="For tagging the report"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm"
                />
              </div>
              <button
                onClick={handleRaadSubmit}
                disabled={!raadBankFile || raadSubmitting}
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
            {jobStatus === 'processing' && (
              <div className="flex flex-col items-center justify-center flex-1 text-center">
                <Loader2 className="w-12 h-12 text-[#332f78] animate-pulse mb-4" />
                <p className="text-neutral-700 font-medium mb-1">Processing...</p>
                <p className="text-sm text-neutral-500">
                  This can take 1–3 minutes. You can leave this page and come back — your report will
                  be saved.
                </p>
              </div>
            )}
            {jobStatus === 'ready' && reportUrl && (
              <div className="flex flex-col flex-1 min-h-0">
                <iframe
                  src={reportUrl.startsWith('http') ? reportUrl : `${window.location.origin}${reportUrl.startsWith('/') ? reportUrl : `/${reportUrl}`}`}
                  title="Report PDF"
                  className="flex-1 w-full min-h-[400px] rounded border border-neutral-200 bg-white"
                />
                <div className="mt-4 flex flex-col gap-2">
                  <a
                    href={reportUrl.startsWith('/') ? `${window.location.origin}${reportUrl}` : reportUrl}
                    download
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-[#332f78] text-white rounded-lg text-sm font-medium hover:bg-[#2a265f]"
                  >
                    <Download className="w-4 h-4" /> Download PDF
                  </a>
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
