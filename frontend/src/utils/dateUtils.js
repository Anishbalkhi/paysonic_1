/**
 * dateUtils.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Normalizes timestamps received from Railway backend and converts them
 * from UTC to the user's local timezone (Indian Standard Time, +05:30).
 */

/**
 * Parses any timestamp representation, ensuring UTC timestamps without a 'Z'
 * suffix are properly interpreted as UTC instead of browser local time.
 */
export const parseUtcTimestamp = (ts) => {
  if (!ts) return null;
  if (ts instanceof Date) return ts;
  if (typeof ts === 'number') return new Date(ts);
  let s = String(ts).trim();
  if (!s) return null;

  // If the timestamp string from Railway / Spring Boot has no timezone designator:
  // e.g. "2026-10-06T01:15:00" or "2026-10-06 01:15:00"
  // It was generated in UTC on the Railway server.
  // We append 'Z' so that the JavaScript Date parser knows it is UTC,
  // allowing it to correctly convert to the user's local timezone (e.g. IST +05:30).
  if (!s.endsWith('Z') && !/[+-]\d{2}(:?\d{2})?$/.test(s)) {
    s = s.replace(' ', 'T') + 'Z';
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};

/**
 * Formats a timestamp into a standard human-readable format:
 * e.g., "Oct 6, 06:45 AM" or with timeZone support
 */
export const formatAuditTimestamp = (ts, options = {}) => {
  const d = parseUtcTimestamp(ts);
  if (!d) return '—';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    ...options,
  });
};

/**
 * Formats full timestamp with date and time:
 * e.g., "Monday, October 6, 2026, 6:45:00 AM"
 */
export const formatFullTimestamp = (ts, options = {}) => {
  const d = parseUtcTimestamp(ts);
  if (!d) return '—';
  return d.toLocaleString('en-US', {
    dateStyle: 'full',
    timeStyle: 'medium',
    ...options,
  });
};

/**
 * Calculates human readable session duration from login timestamp.
 * e.g., "12 mins", "3 hrs 15 mins", or "Active now"
 */
export const calculateSessionDuration = (ts) => {
  const d = parseUtcTimestamp(ts);
  if (!d) return 'Active now';
  const diffMs = Math.max(0, Date.now() - d.getTime());
  const totalMins = Math.floor(diffMs / (1000 * 60));
  if (totalMins < 1) {
    const totalSecs = Math.floor(diffMs / 1000);
    return totalSecs <= 3 ? 'Active now' : `${totalSecs}s`;
  }
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hours > 0) {
    return `${hours} hr${hours > 1 ? 's' : ''} ${mins} min${mins !== 1 ? 's' : ''}`;
  }
  return `${mins} min${mins > 1 ? 's' : ''}`;
};

/**
 * Formats a relative timestamp:
 * e.g., "Just now", "2 mins ago", "1 hr ago"
 */
export const formatRelativeTime = (ts) => {
  if (!ts) return 'Just now';
  if (typeof ts === 'string' && (ts.toLowerCase().includes('ago') || ts.toLowerCase().includes('now') || ts.toLowerCase().includes('closed'))) {
    return ts;
  }
  const d = parseUtcTimestamp(ts);
  if (!d) return 'Just now';
  const diffMs = Math.max(0, Date.now() - d.getTime());
  const diffSecs = Math.floor(diffMs / 1000);
  if (diffSecs < 60) return 'Just now';
  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hr${diffHours > 1 ? 's' : ''} ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

/**
 * Formats report fetch time in standard dd-MM-yyyy HH:mm:ss format
 */
export const formatFetchTime = (date = new Date()) => {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};


