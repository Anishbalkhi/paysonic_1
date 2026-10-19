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
  if (ts instanceof Date) return isNaN(ts.getTime()) ? null : ts;
  if (typeof ts === 'number') {
    const d = new Date(ts);
    return isNaN(d.getTime()) ? null : d;
  }
  if (Array.isArray(ts)) {
    const [y, m = 1, d = 1, h = 0, min = 0, sec = 0, ms = 0] = ts;
    return new Date(Date.UTC(y, m - 1, d, h, min, sec, ms));
  }
  let s = String(ts).trim();
  if (!s) return null;

  if (/^\d{10,13}$/.test(s)) {
    const d = new Date(Number(s));
    if (!isNaN(d.getTime())) return d;
  }

  // Handle DD-MM-YYYY or DD/MM/YYYY with optional time
  const dmyMatch = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (dmyMatch) {
    const [, day, month, year, hours = 0, minutes = 0, seconds = 0] = dmyMatch;
    // Local representation: do NOT use Date.UTC to prevent double-offsetting local time
    return new Date(+year, +month - 1, +day, +hours, +minutes, +seconds);
  }

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
 * Extracts a robust numeric epoch millisecond timestamp from an audit or history record
 */
export const getRecordTimestampMs = (record) => {
  if (!record) return 0;
  const ts = record.timestamp || record.createdAt || record.time || record.date || record.loginTime || record.lastActive;
  if (ts) {
    const d = parseUtcTimestamp(ts);
    if (d && !isNaN(d.getTime())) return d.getTime();
  }
  // Fallback to numeric part in id (e.g. AUD-1792043578230 or LOG-1792043578230)
  if (typeof record.id === 'string') {
    const match = record.id.match(/\d{6,}/);
    if (match) return parseInt(match[0], 10);
  }
  if (typeof record.sessionId === 'string') {
    const match = record.sessionId.match(/\d{6,}/);
    if (match) return parseInt(match[0], 10);
  }
  return 0;
};

/**
 * Sorts any list of audit records descending by timestamp (latest / newest record first).
 * Tie breaker: ID descending.
 */
export const sortRecordsLatestFirst = (records) => {
  if (!Array.isArray(records)) return [];
  return [...records].sort((a, b) => {
    const timeA = getRecordTimestampMs(a);
    const timeB = getRecordTimestampMs(b);
    if (timeB !== timeA) {
      return timeB - timeA; // Descending: newest first
    }
    const idA = String(a?.id || a?.sessionId || '');
    const idB = String(b?.id || b?.sessionId || '');
    return idB.localeCompare(idA);
  });
};

/**
 * Helper to zero-pad numbers to 2 digits
 */
const pad2 = (n) => String(n).padStart(2, '0');

/**
 * Formats a date/timestamp to DD-MM-YYYY HH:mm:ss
 */
export const formatDateTime = (ts) => {
  if (!ts || ts === '—' || ts === 'null' || ts === 'undefined') return '—';
  const str = String(ts).trim();
  if (!str) return '—';

  // Already in DD-MM-YYYY HH:mm:ss
  if (/^\d{2}-\d{2}-\d{4}\s+\d{2}:\d{2}:\d{2}$/.test(str)) {
    return str;
  }
  // DD-MM-YYYY HH:mm
  if (/^\d{2}-\d{2}-\d{4}\s+\d{2}:\d{2}$/.test(str)) {
    return `${str}:00`;
  }
  // DD-MM-YYYY date only
  if (/^\d{2}-\d{2}-\d{4}$/.test(str)) {
    return `${str} 00:00:00`;
  }

  const d = parseUtcTimestamp(ts);
  if (!d || isNaN(d.getTime())) return String(ts);
  return `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
};

/**
 * Formats a date/timestamp to DD-MM-YYYY (date only)
 */
export const formatDateOnly = (ts) => {
  if (!ts || ts === '—' || ts === 'null' || ts === 'undefined') return '—';
  const str = String(ts).trim();
  if (!str) return '—';

  // Already in DD-MM-YYYY
  if (/^\d{2}-\d{2}-\d{4}$/.test(str)) {
    return str;
  }
  // Starts with DD-MM-YYYY
  if (/^\d{2}-\d{2}-\d{4}\s+/.test(str)) {
    return str.split(/\s+/)[0];
  }
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split('-');
    return `${d}-${m}-${y}`;
  }

  const d = parseUtcTimestamp(ts);
  if (!d || isNaN(d.getTime())) return String(ts);
  return `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()}`;
};

/**
 * Formats a timestamp into standard DD-MM-YYYY HH:mm:ss
 */
export const formatAuditTimestamp = (ts) => {
  return formatDateTime(ts);
};

/**
 * Formats full timestamp with date and time: DD-MM-YYYY HH:mm:ss
 */
export const formatFullTimestamp = (ts) => {
  return formatDateTime(ts);
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
 * e.g., "Just now", "2 mins ago", "1 hr ago", or DD-MM-YYYY
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
  return formatDateOnly(d);
};

/**
 * Formats report fetch time in standard dd-MM-yyyy HH:mm:ss format
 */
export const formatFetchTime = (date = new Date()) => {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  return `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
};



