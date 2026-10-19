/**
 * Currency, date, and number formatting utilities
 */

export const formatCurrency = (amount, currency = 'USD') => {
  if (amount === undefined || amount === null) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

export const formatNumber = (num) => {
  if (num === undefined || num === null) return '0';
  return new Intl.NumberFormat('en-US').format(num);
};

export const formatDate = (dateStr, includeTime = false) => {
  if (!dateStr || dateStr === '—' || dateStr === '-') return '—';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return String(dateStr);
    const pad = (n) => String(n).padStart(2, '0');
    const dmy = `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`;
    if (includeTime) {
      return `${dmy} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    }
    return dmy;
  } catch {
    return String(dateStr);
  }
};


export const getStatusBadgeClass = (status) => {
  switch (status?.toLowerCase()) {
    case 'active':
    case 'completed':
    case 'verified':
    case 'live':
      return 'badge--success';
    case 'pending':
    case 'in_review':
      return 'badge--warning';
    case 'suspended':
    case 'failed':
    case 'rejected':
      return 'badge--danger';
    default:
      return 'badge--neutral';
  }
};
