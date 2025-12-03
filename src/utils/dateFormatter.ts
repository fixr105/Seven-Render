/**
 * Date formatting utility
 * All dates should be formatted as dd-Mon (e.g., 05-Jan)
 */

export const formatDate = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(d.getTime())) {
    return 'Invalid Date';
  }

  const day = d.getDate().toString().padStart(2, '0');
  const month = d.toLocaleDateString('en-US', { month: 'short' });
  
  return `${day}-${month}`;
};

export const formatDateFull = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(d.getTime())) {
    return 'Invalid Date';
  }

  const day = d.getDate().toString().padStart(2, '0');
  const month = d.toLocaleDateString('en-US', { month: 'short' });
  const year = d.getFullYear();
  
  return `${day}-${month}-${year}`;
};

export const formatDateTime = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(d.getTime())) {
    return 'Invalid Date';
  }

  const day = d.getDate().toString().padStart(2, '0');
  const month = d.toLocaleDateString('en-US', { month: 'short' });
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  
  return `${day}-${month} ${hours}:${minutes}`;
};

