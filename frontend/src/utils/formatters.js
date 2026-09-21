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
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  const options = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...(includeTime && { hour: '2-digit', minute: '2-digit' }),
  };
  return date.toLocaleDateString('en-US', options);
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
