/**
 * Date formatting utility
 * All dates should be formatted as dd-Mon (e.g., 05-Jan)
 */

const FALLBACK_DATE = '—';

export const formatDate = (date: string | Date | null | undefined): string => {
  if (date == null || date === '') return FALLBACK_DATE;
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return FALLBACK_DATE;
  const day = d.getDate().toString().padStart(2, '0');
  const month = d.toLocaleDateString('en-US', { month: 'short' });
  return `${day}-${month}`;
};

export const formatDateFull = (date: string | Date | null | undefined): string => {
  if (date == null || date === '') return FALLBACK_DATE;
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return FALLBACK_DATE;
  const day = d.getDate().toString().padStart(2, '0');
  const month = d.toLocaleDateString('en-US', { month: 'short' });
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
};

export const formatDateTime = (date: string | Date | null | undefined): string => {
  if (date == null || date === '') return FALLBACK_DATE;
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return FALLBACK_DATE;
  const day = d.getDate().toString().padStart(2, '0');
  const month = d.toLocaleDateString('en-US', { month: 'short' });
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  return `${day}-${month} ${hours}:${minutes}`;
};

/** Safe date+time for detail views; returns — for missing/invalid. */
export const formatDateSafe = (date: string | Date | null | undefined): string => {
  if (date == null || date === '') return FALLBACK_DATE;
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return FALLBACK_DATE;
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Format date as relative time (e.g., "5 minutes ago", "2 hours ago", "3 days ago")
 */
export const formatRelativeTime = (date: string | Date | null | undefined): string => {
  if (date == null || date === '') return FALLBACK_DATE;
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return FALLBACK_DATE;

  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) {
    return 'Just now';
  } else if (diffMinutes < 60) {
    return `${diffMinutes} ${diffMinutes === 1 ? 'minute' : 'minutes'} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
  } else if (diffDays < 7) {
    return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
  } else {
    // For older dates, use formatDateTime
    return formatDateTime(d);
  }
};

