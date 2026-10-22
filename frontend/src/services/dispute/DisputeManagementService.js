import {
  FUNCTION_CODE_MAP,
  FUNCTION_CODES,
  ALLOWED_FUNCTION_CODES,
  PLAZA_MAP,
  DEFAULT_PLAZAS,
  TRANSACTION_MASTER,
  DEFAULT_TAT_DAYS,
} from '../../config/disputeConstants';
import httpClient from '../api/httpClient';
import OnboardingService from '../onboarding/OnboardingService';
import evidenceStorage, { isValidMediaUrl } from './evidenceStorage';
import { formatDateTime, formatDateOnly, parseUtcTimestamp } from '../../utils/dateUtils';

const STORAGE_KEY_DISPUTES = 'paysonic_disputes_db_cache_v1';
const STORAGE_KEY_BATCHES = 'paysonic_dispute_batches_db_cache_v1';
const STORAGE_KEY_AUDIT = 'paysonic_dispute_audit_db_v1';
const STORAGE_KEY_BATCH_DATES = 'paysonic_batch_dates_map_v1';

/**
 * Parses YYMMDD (e.g. '261008' -> '08-10-2026'), YYYYMMDD, DD-MM-YYYY, or YYYY-MM-DD (with or without time)
 * CRITICAL: NEVER defaults to current system date (today). If invalid, returns { formatted: '', dateObj: null }.
 */
export function parseSettlementDate(raw, fallbackDate = null) {
  const tryParse = (val) => {
    if (!val) return null;
    if (val instanceof Date && !isNaN(val.getTime())) {
      const dd = String(val.getDate()).padStart(2, '0');
      const mm = String(val.getMonth() + 1).padStart(2, '0');
      const yyyy = val.getFullYear();
      return { formatted: `${dd}-${mm}-${yyyy}`, dateObj: val };
    }
    const str = String(val).trim();
    if (!str || str.toLowerCase() === 'null' || str.toLowerCase() === 'undefined' || str === '—' || str === '-') {
      return null;
    }

    // 6-digit YYMMDD format: e.g. 261013 -> 13-10-2026
    if (/^\d{6}$/.test(str)) {
      const yy = parseInt(str.substring(0, 2), 10);
      const mm = parseInt(str.substring(2, 4), 10);
      const dd = parseInt(str.substring(4, 6), 10);
      if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
        const yyyy = 2000 + yy;
        const dateObj = new Date(yyyy, mm - 1, dd);
        const formatted = `${String(dd).padStart(2, '0')}-${String(mm).padStart(2, '0')}-${yyyy}`;
        return { formatted, dateObj };
      }
    }

    // 8-digit YYYYMMDD format: e.g. 20261013 -> 13-10-2026
    if (/^\d{8}$/.test(str)) {
      const yyyy = parseInt(str.substring(0, 4), 10);
      const mm = parseInt(str.substring(4, 6), 10);
      const dd = parseInt(str.substring(6, 8), 10);
      if (yyyy >= 2000 && mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
        const dateObj = new Date(yyyy, mm - 1, dd);
        const formatted = `${String(dd).padStart(2, '0')}-${String(mm).padStart(2, '0')}-${yyyy}`;
        return { formatted, dateObj };
      }
    }

    // DD-MM-YYYY or DD/MM/YYYY (with optional time HH:mm:ss)
    const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
    if (dmyMatch) {
      const dd = parseInt(dmyMatch[1], 10);
      const mm = parseInt(dmyMatch[2], 10);
      const yyyy = parseInt(dmyMatch[3], 10);
      if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
        const dateObj = new Date(yyyy, mm - 1, dd);
        const formatted = `${String(dd).padStart(2, '0')}-${String(mm).padStart(2, '0')}-${yyyy}`;
        return { formatted, dateObj };
      }
    }

    // YYYY-MM-DD or YYYY/MM/DD (with optional time HH:mm:ss or 'T'...)
    const ymdMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (ymdMatch) {
      const yyyy = parseInt(ymdMatch[1], 10);
      const mm = parseInt(ymdMatch[2], 10);
      const dd = parseInt(ymdMatch[3], 10);
      if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
        const dateObj = new Date(yyyy, mm - 1, dd);
        const formatted = `${String(dd).padStart(2, '0')}-${String(mm).padStart(2, '0')}-${yyyy}`;
        return { formatted, dateObj };
      }
    }

    // General Date parse fallback
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      const dd = String(parsed.getDate()).padStart(2, '0');
      const mm = String(parsed.getMonth() + 1).padStart(2, '0');
      const yyyy = parsed.getFullYear();
      return { formatted: `${dd}-${mm}-${yyyy}`, dateObj: parsed };
    }

    return null;
  };

  const fromRaw = tryParse(raw);
  if (fromRaw) return fromRaw;

  const fromFb = tryParse(fallbackDate);
  if (fromFb) return fromFb;

  return { formatted: '', dateObj: null };
}

/**
 * Calculate TAT Due Date = Settlement Date + 8 days (T+8)
 */
export function computeTatDueDate(settlementDateStr) {
  if (!settlementDateStr) return '';
  const parsed = parseSettlementDate(settlementDateStr);
  if (!parsed || !parsed.dateObj || isNaN(parsed.dateObj.getTime())) return '';
  const due = new Date(parsed.dateObj);
  due.setDate(due.getDate() + 8);
  const dd = String(due.getDate()).padStart(2, '0');
  const mm = String(due.getMonth() + 1).padStart(2, '0');
  const yyyy = due.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

/**
 * Resolves the Dispute Raise Date and TAT Due Date defensively.
 * Explicitly rejects today's/upload date ('21-10-2026') and resolves from:
 * 1. File settlement date / batch settlement date (clean parsed)
 * 2. Master transaction date (or row.txnDate / row.txnDateTime)
 * 3. Back-calculates or computes TAT Due Date (T+8) dynamically
 */
export function resolveDisputeDates(row, fallbackMaster = null) {
  if (!row) return { disputeRaiseDate: '—', tatDueDate: '—' };

  const candidates = [
    row.fileSettlementDate,
    row.settlementDate,
    row.cbRaisedDate,
    row.batchDate,
    row.npciSettlementDate,
  ];

  let resolvedDate = '';
  for (const c of candidates) {
    if (!c || c === '—' || c === '-') continue;
    const p = parseSettlementDate(c);
    // Explicitly reject corrupted default date '21-10-2026'
    if (p && p.formatted && p.formatted !== '21-10-2026') {
      resolvedDate = p.formatted;
      break;
    }
  }

  // If still not resolved or was 21-10-2026, fallback to transaction date!
  if (!resolvedDate) {
    const staticTxn = row.acqTxnId ? (TRANSACTION_MASTER[row.acqTxnId] || {}) : {};
    const txnCandidates = [
      fallbackMaster?.txnDate,
      row.txnDate,
      row.txnDateTime,
      staticTxn.txnDate,
    ];
    for (const tc of txnCandidates) {
      if (!tc || tc === '—' || tc === '-') continue;
      const p = parseSettlementDate(tc);
      if (p && p.formatted) {
        resolvedDate = p.formatted;
        break;
      }
    }
  }

  // Fallback to batch date map in localStorage if available
  if (!resolvedDate && row.batchId) {
    try {
      const map = JSON.parse(localStorage.getItem(STORAGE_KEY_BATCH_DATES) || '{}');
      const bDate = map[row.batchId] || map[(row.fileName || '').trim().toLowerCase()];
      if (bDate) {
        const p = parseSettlementDate(bDate);
        if (p && p.formatted && p.formatted !== '21-10-2026') {
          resolvedDate = p.formatted;
        }
      }
    } catch {}
  }

  // If still not resolved, check if tatDueDate has a non-corrupted date and back-calculate T-8
  if (!resolvedDate && row.tatDueDate && row.tatDueDate !== '29-10-2026' && row.tatDueDate !== '—') {
    const pTat = parseSettlementDate(row.tatDueDate);
    if (pTat && pTat.dateObj) {
      const orig = new Date(pTat.dateObj);
      orig.setDate(orig.getDate() - 8);
      resolvedDate = `${String(orig.getDate()).padStart(2, '0')}-${String(orig.getMonth() + 1).padStart(2, '0')}-${orig.getFullYear()}`;
    }
  }

  const disputeRaiseDate = resolvedDate || '—';
  let tatDueDate = '—';
  if (resolvedDate) {
    tatDueDate = computeTatDueDate(resolvedDate);
  } else if (row.tatDueDate && row.tatDueDate !== '29-10-2026' && row.tatDueDate !== '—') {
    tatDueDate = formatDateOnly(row.tatDueDate) || row.tatDueDate;
  }

  return { disputeRaiseDate, tatDueDate };
}

/**
 * Format current timestamp in IST: DD-MM-YYYY HH:mm:ss
 */
export function formatIstTimestamp(date = new Date()) {
  return formatDateTime(date);
}

/**
 * Format any date/timestamp into standard DD-MM-YYYY HH:mm:ss IST format
 */
export function formatDisplayDateTime(val) {
  return formatDateTime(val);
}

/**
 * Normalizes a raw database record from Railway MySQL into the UI shape
 */
function mapDbRecordToUi(r, idx = 0) {
  const dispId = r.disputeId || (r.id ? `DISP-${r.id}` : `ROW-${idx + 1}`);
  const staticTxn = r.acqTxnId ? (TRANSACTION_MASTER[r.acqTxnId] || {}) : {};
  const txnDateStr = r.txnDate || (r.txnDateTime ? formatDateTime(r.txnDateTime) : '') || staticTxn.txnDate || '';

  const { disputeRaiseDate, tatDueDate } = resolveDisputeDates(r);
  const formattedSettlement = disputeRaiseDate !== '—' ? disputeRaiseDate : '';
  const tatDue = tatDueDate !== '—' ? tatDueDate : (formattedSettlement ? computeTatDueDate(formattedSettlement) : '');

  let dStatus = r.disputeStatus;
  if (!dStatus || dStatus === 'Pending') {
    dStatus = 'NA';
  }

  let lifecycleStatus = r.lifecycleStatus;
  if (!lifecycleStatus) {
    if (r.closed) lifecycleStatus = 'Closed';
    else if (dStatus === 'Approved') lifecycleStatus = 'Plaza Accepted';
    else if (dStatus === 'Rejected') lifecycleStatus = 'Plaza Rejected';
    else if (r.assigned) lifecycleStatus = 'Assigned to Plaza';
    else lifecycleStatus = 'Pending Assignment';
  }

  const isAssigned = Boolean(r.assigned);
  let resolvedAssignedAt = null;
  if (isAssigned) {
    const candidate =
      r.assignedAt ||
      r.assigned_at ||
      r.adminRemarksAt ||
      r.admin_remarks_at ||
      (r.plazaActionTime && r.plazaActionTime !== 'Pending Plaza Decision' ? r.plazaActionTime : null) ||
      r.plazaActionAt ||
      r.updatedAt ||
      r.createdAt;
    resolvedAssignedAt = candidate ? (formatDateTime(candidate) || String(candidate)) : formatIstTimestamp();
  }

  const fileReason = (r.memberMessageText || r.cbReason || r.member_message_text || r.cb_reason || '').trim();
  const existingRemarks = (r.adminRemarks || r.adminReason || '').trim();
  const resolvedAdminReason = (!existingRemarks || existingRemarks === 'Bulk-assigned for plaza review') && fileReason
    ? fileReason
    : (existingRemarks || fileReason);

  const resolvedPlazaActionTime = r.plazaActionTime
    ? (r.plazaActionTime === 'Pending Plaza Decision' ? 'Pending Plaza Decision' : formatDateTime(r.plazaActionTime))
    : (r.plazaActionAt ? formatDateTime(r.plazaActionAt) : '');

  return {
    ...r,
    rowId: dispId,
    disputeId: dispId,
    acqTxnId: r.acqTxnId || '',
    tollTxnId: r.tollTxnId || '—',
    vrn: r.vehicleNo || r.vrn || '—',
    tagId: r.tagId || '—',
    plazaId: String(r.plazaId || '501101'),
    plazaName: r.plazaName || PLAZA_MAP[r.plazaId] || 'MUMBAI PLAZA NH-04',
    laneId: r.laneId || 'Lane-01',
    tid: r.tid || 'TID-88401',
    txnAmount: Number(r.txnAmount || 0),
    disputeAmount: Number(r.disputeAmount || r.txnAmount || 0),
    functionCode: r.functionCode || '450',
    disputeType: r.functionLabel || FUNCTION_CODE_MAP[r.functionCode] || `Code ${r.functionCode}`,
    txnDate: txnDateStr,
    txnDateTime: txnDateStr,
    settlementDate: formattedSettlement,
    tatDueDate: tatDue,
    cbRaisedDate: formattedSettlement,
    cbReason: fileReason || '—',
    memberMessageText: fileReason || '—',
    assigned: isAssigned,
    assignedAt: resolvedAssignedAt,
    assignedToPlaza: r.assignedToPlaza || (isAssigned ? r.plazaId : null),
    adminReason: resolvedAdminReason,
    adminRemarks: resolvedAdminReason,
    adminRemarksAt: r.adminRemarksAt ? formatDateTime(r.adminRemarksAt) : '',
    plazaAction: (r.plazaAction === true || r.plazaAction === 'Yes' || r.plazaAction === 'Accepted' || r.plazaAction === 'Rejected') ? 'Yes' : 'No',
    plazaActionTime: resolvedPlazaActionTime,
    plazaActionAt: r.plazaActionAt || '',
    decidedAt: r.plazaActionAt || null,
    plazaReason: r.plazaRemarks || 'NA',
    plazaRemarks: r.plazaRemarks || 'NA',
    plazaActionBy: r.plazaActionBy || '',
    plazaEvidence: (() => {
      const dispKey = dispId;
      const acqKey = r.acqTxnId || '';
      const fromVault = evidenceStorage.getPlazaEvidence(dispKey, acqKey);
      if (fromVault && fromVault.length > 0) return fromVault;
      if (r.plazaEvidence && Array.isArray(r.plazaEvidence) && r.plazaEvidence.length > 0) return r.plazaEvidence;
      if (r.counterEvidenceName) {
        return evidenceStorage.parseEvidenceString(r.counterEvidenceName, r.counterEvidenceUrl, dispKey, acqKey);
      }
      return [];
    })(),
    adminEvidence: (() => {
      const dispKey = dispId;
      const acqKey = r.acqTxnId || '';
      const fromVault = evidenceStorage.getAdminEvidence(dispKey, acqKey);
      if (fromVault && fromVault.length > 0) return fromVault;
      if (r.adminEvidence && Array.isArray(r.adminEvidence) && r.adminEvidence.length > 0) return r.adminEvidence;
      return [];
    })(),
    disputeStatus: dStatus,
    lifecycleStatus,
    closed: Boolean(r.closed),
    closedAt: r.closedAt || null,
    closedBy: r.closedBy || null,
    closeRemarks: r.closeRemarks || '',
  };
}

class DisputeManagementService {
  constructor() {
    this.initStore();
  }

  initStore() {
    if (typeof window === 'undefined') return;
    try {
      // Clear legacy mock test keys so they don't corrupt the live DB experience
      localStorage.removeItem('paysonic_disputes_v1');
      localStorage.removeItem('paysonic_disputes_v2');
      localStorage.removeItem('paysonic_dispute_batches_v1');
      localStorage.removeItem('paysonic_dispute_batches_v2');
      localStorage.removeItem('paysonic_disputes_live_v1');
      localStorage.removeItem('paysonic_dispute_batches_live_v1');

      // Fetch live records from Railway backend database in background
      this.syncFromBackend().catch((e) => {
        console.debug('[DisputeManagementService] Background sync notice:', e?.message);
      });
    } catch (e) {
      console.warn('[DisputeManagementService] Store init warning:', e);
    }
  }

  /**
   * Sync active dispute queue directly from Railway MySQL database
   */
  async syncFromBackend() {
    try {
      await this.fetchBatches().catch(() => {});
      const res = await httpClient.get('/api/disputes/workflow/queue');
      if (Array.isArray(res.data)) {
        const mapped = res.data.map(mapDbRecordToUi);
        this.saveDisputes(mapped, false);
        return mapped;
      }
    } catch (err) {
      console.debug('[DisputeManagementService] Live DB sync unavailable:', err?.message);
    }
    return this.getStoredDisputes();
  }

  async getRealtimePlazas() {
    try {
      const live = await OnboardingService.getPlazas();
      if (Array.isArray(live) && live.length > 0) {
        return live.map((p) => ({
          id: String(p.id),
          name: p.name || `Plaza ${p.id}`,
          label: `${p.name || ('Plaza ' + p.id)} (${p.id})`,
        }));
      }
    } catch (e) {
      console.warn('[DisputeManagementService] Failed to load realtime plazas:', e);
    }
    const cached = OnboardingService.getCachedPlazas();
    if (Array.isArray(cached) && cached.length > 0) {
      return cached.map((p) => ({
        id: String(p.id),
        name: p.name || `Plaza ${p.id}`,
        label: `${p.name || ('Plaza ' + p.id)} (${p.id})`,
      }));
    }
    return DEFAULT_PLAZAS;
  }

  getStoredDisputes() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_DISPUTES);
      const parsed = raw ? JSON.parse(raw) : [];
      return parsed.map(mapDbRecordToUi);
    } catch {
      return [];
    }
  }

  saveDisputes(disputes, dispatch = true) {
    try {
      localStorage.setItem(STORAGE_KEY_DISPUTES, JSON.stringify(disputes));
      if (dispatch) {
        window.dispatchEvent(new CustomEvent('paysonic:disputes_updated', { detail: disputes }));
        if (typeof BroadcastChannel !== 'undefined') {
          try {
            const bc = new BroadcastChannel('paysonic_disputes_channel');
            bc.postMessage({ type: 'DISPUTES_UPDATED', timestamp: Date.now() });
            bc.close();
          } catch {}
        }
      }
    } catch (e) {
      console.warn('[DisputeManagementService] Save error:', e);
    }
  }

  mergeDisputes(newRows) {
    if (!Array.isArray(newRows) || newRows.length === 0) return;
    try {
      const current = this.getStoredDisputes();
      const currentMap = new Map();
      current.forEach((r) => {
        const key = String(r.rowId || r.disputeId || r.id || '').trim();
        if (key) currentMap.set(key, r);
      });
      newRows.forEach((r) => {
        const key = String(r.rowId || r.disputeId || r.id || '').trim();
        if (key) {
          const existing = currentMap.get(key) || {};
          currentMap.set(key, { ...existing, ...r });
        }
      });
      const merged = Array.from(currentMap.values());
      this.saveDisputes(merged, false);
    } catch (e) {
      console.warn('[DisputeManagementService] mergeDisputes error:', e);
    }
  }

  getBatchDateMap() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_BATCH_DATES);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  setBatchDate(batchId, fileName, date) {
    if (!date) return;
    try {
      const map = this.getBatchDateMap();
      if (batchId) map[batchId] = date;
      if (fileName) map[fileName.trim().toLowerCase()] = date;
      localStorage.setItem(STORAGE_KEY_BATCH_DATES, JSON.stringify(map));
    } catch (e) {
      console.warn('[DisputeManagementService] Failed to cache batch date:', e);
    }
  }

  getBatches() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_BATCHES);
      const batches = raw ? JSON.parse(raw) : [];
      const dateMap = this.getBatchDateMap();
      return batches.map((b) => {
        const fnKey = (b.fileName || '').trim().toLowerCase();
        return {
          ...b,
          disputeFileDate: b.disputeFileDate || dateMap[b.batchId] || dateMap[fnKey] || '',
        };
      });
    } catch {
      return [];
    }
  }

  async fetchBatches() {
    const dateMap = this.getBatchDateMap();
    try {
      const res = await httpClient.get('/api/disputes/workflow/batches');
      if (Array.isArray(res.data)) {
        res.data.forEach((b) => {
          if (b.disputeFileDate) {
            this.setBatchDate(b.batchId, b.fileName, b.disputeFileDate);
          }
        });
        const mapped = res.data.map((b) => {
          const fnKey = (b.fileName || '').trim().toLowerCase();
          const resolvedDate = b.disputeFileDate || dateMap[b.batchId] || dateMap[fnKey] || '';
          return {
            batchId: b.batchId,
            fileName: b.fileName,
            disputeFileDate: resolvedDate,
            uploadedAt: b.uploadTimestamp ? String(b.uploadTimestamp).replace('T', ' ').slice(0, 19) : '',
            uploadedBy: b.uploadedBy || 'Master Admin',
            totalRows: b.totalRows || 0,
            matchedRows: b.matchedRows || 0,
            unmatchedRows: b.unmatchedRows || 0,
            status: b.status || 'Processed',
          };
        });
        localStorage.setItem(STORAGE_KEY_BATCHES, JSON.stringify(mapped));
        return mapped;
      }
    } catch (e) {
      console.debug('[DisputeManagementService] Backend batches fetch notice:', e?.message);
    }
    return this.getBatches();
  }

  async deleteBatch(batchId) {
    try {
      await httpClient.delete(`/api/disputes/workflow/batches/${batchId}`);
    } catch (e) {
      console.debug('[DisputeManagementService] Delete batch API notice:', e?.message);
    }
    const current = this.getBatches().filter((b) => b.batchId !== batchId);
    localStorage.setItem(STORAGE_KEY_BATCHES, JSON.stringify(current));
    return current;
  }

  async clearAllDisputes() {
    try {
      await httpClient.delete('/api/disputes/workflow/clear-all');
    } catch (e) {
      console.warn('[DisputeManagementService] Clear all API notice:', e?.message);
    }
    localStorage.removeItem(STORAGE_KEY_DISPUTES);
    localStorage.removeItem(STORAGE_KEY_BATCHES);
    localStorage.removeItem('paysonic_disputes_v1');
    localStorage.removeItem('paysonic_disputes_v2');
    localStorage.removeItem('paysonic_dispute_batches_v1');
    localStorage.removeItem('paysonic_dispute_batches_v2');
    localStorage.removeItem('paysonic_disputes_live_v1');
    localStorage.removeItem('paysonic_dispute_batches_live_v1');
    window.dispatchEvent(new CustomEvent('paysonic:disputes_updated', { detail: [] }));
    return { success: true };
  }


  saveBatch(batch) {
    try {
      const batches = this.getStoredBatches();
      batches.unshift(batch);
      localStorage.setItem(STORAGE_KEY_BATCHES, JSON.stringify(batches));
    } catch (e) {
      console.warn('[DisputeManagementService] Save batch error:', e);
    }
  }

  getStoredBatches() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_BATCHES);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  logAudit(action, details, actor = null) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_AUDIT);
      const list = raw ? JSON.parse(raw) : [];
      list.unshift({
        id: `AUDIT-${Date.now()}`,
        action,
        details,
        timestamp: new Date().toISOString(),
        actor: actor || localStorage.getItem('actorId') || 'Master Admin',
      });
      localStorage.setItem(STORAGE_KEY_AUDIT, JSON.stringify(list.slice(0, 200)));
    } catch (e) {
      console.warn('[DisputeManagementService] Audit error:', e);
    }
  }

  computeDaysLeft(row) {
    if (row.tatDueDate) {
      const { dateObj } = parseSettlementDate(row.tatDueDate);
      const now = new Date();
      const diffMs = dateObj.getTime() - now.getTime();
      return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    }
    const daysAgo = row.cbRaisedDaysAgo ?? 1;
    return DEFAULT_TAT_DAYS - daysAgo;
  }

  getTatBadge(row) {
    if (row.closed || row.disputeStatus !== 'NA') {
      return { status: 'closed', label: 'Closed', colorClass: 'badge-gray' };
    }
    const daysLeft = this.computeDaysLeft(row);
    if (daysLeft < 0) {
      return { status: 'overdue', label: 'Overdue', colorClass: 'badge-red' };
    }
    if (daysLeft <= 2) {
      return { status: 'at-risk', label: `${daysLeft}d left`, colorClass: 'badge-amber' };
    }
    return { status: 'safe', label: `${daysLeft}d left`, colorClass: 'badge-green' };
  }

  /**
   * Search / filter disputes directly from Railway MySQL database
   */
  async searchDisputes(filters = {}) {
    try {
      const queryParams = {};
      if (filters.fromDate) queryParams.fromDate = filters.fromDate;
      if (filters.toDate) queryParams.toDate = filters.toDate;
      if (filters.dateType) queryParams.dateType = filters.dateType;
      if (filters.functionCode && filters.functionCode !== 'ALL') queryParams.functionCode = filters.functionCode;
      if (filters.plazaId && filters.plazaId !== 'ALL') queryParams.plazaId = filters.plazaId;
      if (filters.scopedPlazaId && filters.scopedPlazaId !== 'ALL') queryParams.plazaId = filters.scopedPlazaId;
      if (filters.assignStatus) queryParams.assignStatus = filters.assignStatus;
      if (filters.disputeStatus && filters.disputeStatus !== 'ALL') queryParams.disputeStatus = filters.disputeStatus;
      if (filters.plazaAction) queryParams.plazaAction = filters.plazaAction;
      const effectiveSearch = (filters.search || filters.acqTxnId || filters.tollTxnId || filters.tagId || '').trim();
      if (effectiveSearch) queryParams.search = effectiveSearch;

      await this.fetchBatches().catch(() => {});
      const res = await httpClient.get('/api/disputes/workflow/queue', { params: queryParams });
      if (Array.isArray(res.data)) {
        const rows = res.data.map(mapDbRecordToUi);
        this.mergeDisputes(rows);
        return rows;
      }
    } catch (err) {
      console.debug('[DisputeManagementService] DB query fallback:', err?.message);
    }

    // Local filter fallback
    let rows = this.getStoredDisputes();

    if (filters.scopedPlazaId && filters.scopedPlazaId !== 'ALL') {
      rows = rows.filter((r) => String(r.plazaId) === String(filters.scopedPlazaId));
    }
    if (filters.functionCode && filters.functionCode !== 'ALL') {
      rows = rows.filter((r) => String(r.functionCode) === String(filters.functionCode));
    }
    if (filters.plazaAction) {
      rows = rows.filter((r) => r.plazaAction === filters.plazaAction);
    }
    if (filters.assignStatus) {
      if (filters.assignStatus === 'Assigned') {
        rows = rows.filter((r) => r.assigned === true);
      } else if (filters.assignStatus === 'Unassigned' || filters.assignStatus === 'UnAssigned' || filters.assignStatus === 'Pending Assignment') {
        rows = rows.filter((r) => r.assigned === false);
      }
    }
    if (filters.lifecycleStatus && filters.lifecycleStatus !== 'ALL') {
      rows = rows.filter((r) => r.lifecycleStatus === filters.lifecycleStatus);
    }
    if (filters.disputeStatus && filters.disputeStatus !== 'ALL') {
      rows = rows.filter((r) => r.disputeStatus === filters.disputeStatus);
    }
    if (filters.plazaId && filters.plazaId !== 'ALL') {
      rows = rows.filter((r) => String(r.plazaId) === String(filters.plazaId));
    }
    if (filters.acqTxnId && filters.acqTxnId.trim()) {
      const q = filters.acqTxnId.trim().toLowerCase();
      rows = rows.filter((r) =>
        (r.acqTxnId && String(r.acqTxnId).toLowerCase().includes(q)) ||
        (r.rrn && String(r.rrn).toLowerCase().includes(q))
      );
    }
    if (filters.tollTxnId && filters.tollTxnId.trim()) {
      const q = filters.tollTxnId.trim().toLowerCase();
      rows = rows.filter((r) =>
        (r.tollTxnId && String(r.tollTxnId).toLowerCase().includes(q)) ||
        (r.toll_txn_id && String(r.toll_txn_id).toLowerCase().includes(q))
      );
    }
    if (filters.tagId && filters.tagId.trim()) {
      const q = filters.tagId.trim().toLowerCase();
      rows = rows.filter((r) => r.tagId && String(r.tagId).toLowerCase().includes(q));
    }
    if (filters.search && filters.search.trim()) {
      const q = filters.search.trim().toLowerCase();
      rows = rows.filter((r) => {
        const tagMatch = r.tagId && String(r.tagId).toLowerCase().includes(q);
        const rrnMatch =
          (r.acqTxnId && String(r.acqTxnId).toLowerCase().includes(q)) ||
          (r.rrn && String(r.rrn).toLowerCase().includes(q));
        const plazaTxnMatch =
          (r.tollTxnId && String(r.tollTxnId).toLowerCase().includes(q)) ||
          (r.toll_txn_id && String(r.toll_txn_id).toLowerCase().includes(q));
        const vrnMatch =
          (r.vrn && String(r.vrn).toLowerCase().includes(q)) ||
          (r.vehicleNo && String(r.vehicleNo).toLowerCase().includes(q));
        return tagMatch || rrnMatch || plazaTxnMatch || vrnMatch;
      });
    }

    if (filters.fromDate || filters.toDate) {
      let startMs = 0;
      let endMs = Infinity;
      if (filters.fromDate) {
        const d = new Date(filters.fromDate + 'T00:00:00');
        if (!isNaN(d.getTime())) startMs = d.getTime();
      }
      if (filters.toDate) {
        const d = new Date(filters.toDate + 'T23:59:59.999');
        if (!isNaN(d.getTime())) endMs = d.getTime();
      }
      const dType = filters.dateType || 'Transaction DateTime';
      rows = rows.filter((r) => {
        let target = dType === 'Chargeback Date' ? (r.cbRaisedDate || r.settlementDate)
                   : dType === 'Plaza Action Date' ? (r.plazaActionTime || r.plazaActionAt || r.decidedAt)
                   : (r.txnDateTime || r.txnDate);
        if (target && target !== '—' && target !== 'Pending Plaza Decision') {
          const parsed = parseUtcTimestamp(target);
          if (parsed && !isNaN(parsed.getTime())) {
            const time = parsed.getTime();
            if (time < startMs || time > endMs) return false;
          }
        }
        return true;
      });
    }

    return rows;
  }

  /**
   * Mini Dashboard metrics directly from Railway MySQL database
   */
  async getAdminMiniDashboardStats() {
    try {
      const res = await httpClient.get('/api/disputes/workflow/stats/admin');
      if (res.data) {
        return res.data;
      }
    } catch (err) {
      console.debug('[DisputeManagementService] Mini stats fallback:', err?.message);
    }

    const rows = this.getStoredDisputes();
    const unassigned = rows.filter((r) => !r.assigned && !r.closed).length;
    const assigned = rows.filter((r) => r.assigned && !r.closed).length;
    const todayStr = new Date().toISOString().slice(0, 10);
    const plazaRevertsToday = rows.filter((r) => {
      if (!r.decidedAt && !r.plazaActionAt) return false;
      const d = String(r.decidedAt || r.plazaActionAt).slice(0, 10);
      return d === todayStr;
    }).length;

    const approachingTat = rows.filter((r) => {
      if (r.closed || r.disputeStatus !== 'NA') return false;
      return this.computeDaysLeft(r) <= 2;
    }).length;

    const totalDisputeValue = rows
      .filter((r) => !r.closed)
      .reduce((acc, r) => acc + Number(r.disputeAmount || 0), 0);

    return {
      unassigned,
      assigned,
      plazaRevertsToday,
      approachingTat,
      totalDisputeValue,
    };
  }

  /**
   * Plaza Dispute Dashboard metrics directly from Railway MySQL database
   */
  async getPlazaDashboardStats(plazaId) {
    try {
      const res = await httpClient.get('/api/disputes/workflow/stats/plaza', { params: { plazaId } });
      if (res.data) {
        return res.data;
      }
    } catch (err) {
      console.debug('[DisputeManagementService] Plaza stats fallback:', err?.message);
    }

    const all = this.getStoredDisputes();
    const plazaRows = (plazaId && plazaId !== 'ALL')
      ? all.filter((r) => String(r.plazaId) === String(plazaId) || String(r.assignedToPlaza) === String(plazaId))
      : all;

    const openRows = plazaRows.filter((r) => r.disputeStatus === 'NA' && !r.closed);
    const approvedRows = plazaRows.filter((r) => r.disputeStatus === 'Approved');
    const rejectedRows = plazaRows.filter((r) => r.disputeStatus === 'Rejected');

    return {
      totalDisputes: plazaRows.length,
      openDisputes: openRows.length,
      approvedDisputes: approvedRows.length,
      rejectedDisputes: rejectedRows.length,
      closedDisputes: plazaRows.filter((r) => r.closed).length,
      acceptedAmount: approvedRows.reduce((acc, r) => acc + Number(r.disputeAmount || 0), 0),
      rejectedAmount: rejectedRows.reduce((acc, r) => acc + Number(r.disputeAmount || 0), 0),
      withinTat: openRows.filter((r) => this.computeDaysLeft(r) >= 0).length,
      breachedTat: openRows.filter((r) => this.computeDaysLeft(r) < 0).length,
    };
  }


  /**
   * Assign a single row with persistence to Railway MySQL
   */
  async assignRow(rowId, adminReason, evidenceList = [], actor = 'Master Admin', targetPlazaId = null, fallbackRow = null) {
    if (!adminReason || !adminReason.trim()) {
      throw new Error('Reason / remarks explaining the dispute is mandatory.');
    }

    const cleanId = String(rowId || '').trim();
    let rows = this.getStoredDisputes();
    let row = rows.find((r) =>
      String(r.rowId || '') === cleanId ||
      String(r.disputeId || '') === cleanId ||
      (r.id && String(r.id) === cleanId) ||
      (r.acqTxnId && String(r.acqTxnId) === cleanId)
    );

    // If missing from local cache, fall back to in-memory row from modal
    if (!row && fallbackRow) {
      row = mapDbRecordToUi(fallbackRow);
    }

    // If still missing, sync live from backend
    if (!row) {
      try {
        const live = await this.syncFromBackend();
        if (Array.isArray(live)) {
          rows = live;
          row = rows.find((r) =>
            String(r.rowId || '') === cleanId ||
            String(r.disputeId || '') === cleanId ||
            (r.id && String(r.id) === cleanId) ||
            (r.acqTxnId && String(r.acqTxnId) === cleanId)
          );
        }
      } catch (e) {
        console.debug('[DisputeManagementService] Sync notice during assign:', e);
      }
    }

    if (row) {
      const hasPlazaActed =
        row.disputeStatus === 'Approved' ||
        row.disputeStatus === 'Rejected' ||
        (row.plazaAction === 'Yes' && row.disputeStatus !== 'NA' && row.disputeStatus !== 'Pending');

      if (hasPlazaActed) {
        throw new Error('Admin cannot re-assign a dispute after the plaza has acted (Accept or Reject).');
      }
    }

    const finalPlazaId = targetPlazaId ? String(targetPlazaId) : (row?.plazaId ? String(row.plazaId) : '501101');
    const cachedPlazas = OnboardingService.getCachedPlazas() || [];
    const matchedApiPlaza = cachedPlazas.find((p) => String(p.id).trim() === finalPlazaId);
    const targetPlazaName = matchedApiPlaza?.name || PLAZA_MAP[finalPlazaId] || row?.plazaName || 'Plaza';

    let backendResult = null;
    try {
      const res = await httpClient.put(`/api/disputes/workflow/assign/${cleanId}`, {
        plazaId: finalPlazaId,
        plazaName: targetPlazaName,
        adminRemarks: adminReason.trim(),
        actor,
      });
      if (res && res.data) {
        backendResult = mapDbRecordToUi(res.data);
      }
    } catch (err) {
      console.warn('[DisputeManagementService] DB assign notice:', err?.message);
      if (err?.response?.data?.error) {
        throw new Error(err.response.data.error);
      }
    }

    if (evidenceList && evidenceList.length > 0 && (row?.acqTxnId || backendResult?.acqTxnId)) {
      evidenceStorage.saveAdminEvidence(cleanId, row?.acqTxnId || backendResult?.acqTxnId, evidenceList);
    }

    const updatedRow = backendResult || {
      ...(row || fallbackRow || {}),
      rowId: cleanId,
      disputeId: cleanId,
      plazaId: finalPlazaId,
      assignedToPlaza: finalPlazaId,
      plazaName: targetPlazaName,
      assigned: true,
      lifecycleStatus: 'Assigned to Plaza',
      assignedBy: actor,
      assignedAt: formatIstTimestamp(),
      adminRemarks: adminReason.trim(),
      adminReason: adminReason.trim(),
      adminRemarksAt: formatIstTimestamp(),
      adminEvidence: evidenceList.length > 0 ? evidenceList : (row?.adminEvidence || []),
    };

    const existingIndex = rows.findIndex((r) =>
      String(r.rowId || '') === cleanId ||
      String(r.disputeId || '') === cleanId ||
      (r.id && String(r.id) === cleanId)
    );

    let updated;
    if (existingIndex >= 0) {
      updated = rows.map((r, i) => (i === existingIndex ? { ...r, ...updatedRow } : r));
    } else {
      updated = [updatedRow, ...rows];
    }

    this.saveDisputes(updated);
    this.logAudit('ROW_ASSIGN', `Assigned dispute ${cleanId} to plaza ${finalPlazaId}`, actor);
    return { success: true };
  }

  /**
   * Bulk-assign unassigned disputes across selected plazas
   */
  async bulkAssignPlazas(plazaIds = [], actor = 'Master Admin', adminRemarks = 'Bulk-assigned for plaza review') {
    if (!Array.isArray(plazaIds) || plazaIds.length === 0) {
      return { updatedCount: 0 };
    }
    const setIds = new Set(plazaIds.map((id) => String(id).trim()));
    let rows = this.getStoredDisputes();
    if (rows.length === 0) {
      try {
        const live = await this.syncFromBackend();
        if (Array.isArray(live)) rows = live;
      } catch {}
    }
    let updatedCount = 0;
    const assignedIds = [];

    const updated = rows.map((r) => {
      const rowPlazaId = String(r.plazaId || '').trim();
      if (setIds.has(rowPlazaId) && !r.assigned && !r.closed) {
        updatedCount++;
        assignedIds.push(r.disputeId || r.rowId);
        const rowRemarks = (r.memberMessageText || r.cbReason || adminRemarks || '').trim();
        return {
          ...r,
          assigned: true,
          assignedToPlaza: rowPlazaId,
          assignedBy: actor,
          assignedAt: formatIstTimestamp(),
          adminRemarks: rowRemarks,
          adminReason: rowRemarks,
          adminRemarksAt: formatIstTimestamp(),
          lifecycleStatus: 'Assigned to Plaza',
        };
      }
      return r;
    });

    if (updatedCount > 0) {
      this.saveDisputes(updated);
      this.logAudit(
        'BULK_ASSIGN_PLAZAS',
        `Bulk-assigned ${updatedCount} disputes across ${setIds.size} plaza(s)`,
        actor
      );

      // Notify backend
      if (assignedIds.length > 0) {
        try {
          await httpClient.put('/api/disputes/workflow/bulk-assign', {
            disputeIds: assignedIds,
            plazaId: plazaIds[0] || '',
            adminRemarks,
            actor,
          });
        } catch (err) {
          console.debug('[DisputeManagementService] Backend bulk-assign notice:', err?.message);
        }
      }
    }

    return { updatedCount };
  }

  /**
   * Bulk-unassign all open (undecided) disputes across selected plazas
   */
  async bulkUnassignPlazas(plazaIds = [], actor = 'Master Admin') {
    if (!Array.isArray(plazaIds) || plazaIds.length === 0) {
      return { updatedCount: 0 };
    }
    const setIds = new Set(plazaIds.map((id) => String(id).trim()));
    let rows = this.getStoredDisputes();
    if (rows.length === 0) {
      try {
        const live = await this.syncFromBackend();
        if (Array.isArray(live)) rows = live;
      } catch {}
    }
    let updatedCount = 0;
    const unassignedIds = [];

    const updated = rows.map((r) => {
      const rowPlazaId = String(r.plazaId || '').trim();
      const isDecided =
        r.disputeStatus === 'Approved' ||
        r.disputeStatus === 'Rejected' ||
        r.plazaAction === 'Yes';
      if (setIds.has(rowPlazaId) && r.assigned && !isDecided && !r.closed) {
        updatedCount++;
        unassignedIds.push(r.disputeId || r.rowId);
        return {
          ...r,
          assigned: false,
          assignedToPlaza: null,
          assignedBy: null,
          assignedAt: null,
          adminRemarks: null,
          adminReason: '',
          lifecycleStatus: 'Pending Assignment',
        };
      }
      return r;
    });

    if (updatedCount > 0) {
      this.saveDisputes(updated);
      this.logAudit(
        'BULK_UNASSIGN_PLAZAS',
        `Bulk-unassigned ${updatedCount} open disputes across ${setIds.size} plaza(s)`,
        actor
      );

      // Notify backend
      if (unassignedIds.length > 0) {
        try {
          await httpClient.put('/api/disputes/workflow/bulk-unassign', {
            disputeIds: unassignedIds,
            plazaIds: Array.from(setIds),
            actor,
          });
        } catch (err) {
          console.debug('[DisputeManagementService] Backend bulk-unassign notice:', err?.message);
        }
      }
    }

    return { updatedCount };
  }

  /**
   * Bulk-assign specific dispute IDs
   */
  async bulkAssignDisputeIds(disputeIds = [], actor = 'Master Admin', adminRemarks = 'Bulk-assigned for plaza review') {
    if (!Array.isArray(disputeIds) || disputeIds.length === 0) {
      return { updatedCount: 0 };
    }
    const targetSet = new Set(disputeIds.map((id) => String(id).trim().toLowerCase()));
    const rows = this.getStoredDisputes();
    let updatedCount = 0;
    const assignedIds = [];

    const updated = rows.map((r) => {
      const cleanId = String(r.disputeId || r.rowId || '').trim().toLowerCase();
      const acqId = String(r.acqTxnId || '').trim().toLowerCase();
      if ((targetSet.has(cleanId) || targetSet.has(acqId)) && !r.assigned && !r.closed) {
        updatedCount++;
        assignedIds.push(r.disputeId || r.rowId);
        const rowRemarks = (r.memberMessageText || r.cbReason || adminRemarks || '').trim();
        return {
          ...r,
          assigned: true,
          assignedToPlaza: r.plazaId,
          assignedBy: actor,
          assignedAt: formatIstTimestamp(),
          adminRemarks: rowRemarks,
          adminReason: rowRemarks,
          adminRemarksAt: formatIstTimestamp(),
          lifecycleStatus: 'Assigned to Plaza',
        };
      }
      return r;
    });

    if (updatedCount > 0) {
      this.saveDisputes(updated);
      this.logAudit(
        'BULK_ASSIGN_ROWS',
        `Bulk-assigned ${updatedCount} selected dispute(s)`,
        actor
      );

      if (assignedIds.length > 0) {
        try {
          await httpClient.put('/api/disputes/workflow/bulk-assign', {
            disputeIds: assignedIds,
            plazaId: '',
            adminRemarks,
            actor,
          });
        } catch (err) {
          console.debug('[DisputeManagementService] Backend bulk-assign notice:', err?.message);
        }
      }
    }

    return { updatedCount };
  }

  /**
   * Bulk-unassign specific dispute IDs
   */
  async bulkUnassignDisputeIds(disputeIds = [], actor = 'Master Admin') {
    if (!Array.isArray(disputeIds) || disputeIds.length === 0) {
      return { updatedCount: 0 };
    }
    const targetSet = new Set(disputeIds.map((id) => String(id).trim().toLowerCase()));
    const rows = this.getStoredDisputes();
    let updatedCount = 0;
    const unassignedIds = [];

    const updated = rows.map((r) => {
      const cleanId = String(r.disputeId || r.rowId || '').trim().toLowerCase();
      const acqId = String(r.acqTxnId || '').trim().toLowerCase();
      const isDecided =
        r.disputeStatus === 'Approved' ||
        r.disputeStatus === 'Rejected' ||
        r.plazaAction === 'Yes';
      if ((targetSet.has(cleanId) || targetSet.has(acqId)) && r.assigned && !isDecided && !r.closed) {
        updatedCount++;
        unassignedIds.push(r.disputeId || r.rowId);
        return {
          ...r,
          assigned: false,
          assignedToPlaza: null,
          assignedBy: null,
          assignedAt: null,
          adminRemarks: null,
          adminReason: '',
          lifecycleStatus: 'Pending Assignment',
        };
      }
      return r;
    });

    if (updatedCount > 0) {
      this.saveDisputes(updated);
      this.logAudit(
        'BULK_UNASSIGN_ROWS',
        `Bulk-unassigned ${updatedCount} selected dispute(s)`,
        actor
      );

      if (unassignedIds.length > 0) {
        try {
          await httpClient.put('/api/disputes/workflow/bulk-unassign', {
            disputeIds: unassignedIds,
            actor,
          });
        } catch (err) {
          console.debug('[DisputeManagementService] Backend bulk-unassign notice:', err?.message);
        }
      }
    }

    return { updatedCount };
  }

  /**
   * Plaza submits decision with persistence to Railway MySQL
   */
  async submitPlazaDecision(rowId, decision, plazaReason, evidenceList = [], actor = 'Plaza User', actorPlazaId = null, fallbackRow = null) {
    const trimmedReason = (plazaReason || '').trim();
    if (decision === 'Rejected' && !trimmedReason) {
      throw new Error('Plaza remarks / justification are mandatory when rejecting a dispute.');
    }
    if (decision === 'Rejected' && (!evidenceList || evidenceList.length === 0)) {
      throw new Error('At least one counter-evidence file is mandatory when rejecting a dispute.');
    }
    const finalReason = trimmedReason || (decision === 'Approved' ? 'Accepted' : '');

    const cleanId = String(rowId || '').trim();
    let rows = this.getStoredDisputes();
    let row = rows.find((r) =>
      String(r.rowId || '') === cleanId ||
      String(r.disputeId || '') === cleanId ||
      (r.id && String(r.id) === cleanId) ||
      (r.acqTxnId && String(r.acqTxnId) === cleanId)
    );

    // If missing from local cache, fall back to in-memory row from modal
    if (!row && fallbackRow) {
      row = mapDbRecordToUi(fallbackRow);
    }

    // If still missing, sync live from backend
    if (!row) {
      try {
        const live = await this.syncFromBackend();
        if (Array.isArray(live)) {
          rows = live;
          row = rows.find((r) =>
            String(r.rowId || '') === cleanId ||
            String(r.disputeId || '') === cleanId ||
            (r.id && String(r.id) === cleanId) ||
            (r.acqTxnId && String(r.acqTxnId) === cleanId)
          );
        }
      } catch (e) {
        console.debug('[DisputeManagementService] Sync notice during decision:', e);
      }
    }

    if (row) {
      if (row.disputeStatus !== 'NA' && row.disputeStatus !== 'Pending' && row.plazaAction === 'Yes') {
        throw new Error('Decision has already been submitted and locked (single-submit rule)');
      }
      if (actorPlazaId && actorPlazaId !== 'ALL' && String(row.plazaId).trim() !== String(actorPlazaId).trim()) {
        throw new Error('Plaza cannot act on a dispute not mapped to its own plaza ID.');
      }
    }

    const istNow = formatIstTimestamp();

    if (evidenceList && evidenceList.length > 0 && (row?.acqTxnId || fallbackRow?.acqTxnId)) {
      evidenceStorage.savePlazaEvidence(cleanId, row?.acqTxnId || fallbackRow?.acqTxnId, evidenceList);
    }

    // Join multiple file names so all are recorded in backend
    const evNames =
      evidenceList && evidenceList.length > 0
        ? evidenceList
            .map((f) => (typeof f === 'string' ? f : f.name || 'attachment'))
            .filter((n) => n && n !== '[object Object]')
            .join(', ')
        : null;

    // Only send a valid short URL or null — NEVER send '[object Object]' or huge blobs to TEXT column
    const firstEv = evidenceList && evidenceList[0];
    let evUrl = null;
    if (firstEv) {
      const candidate = typeof firstEv === 'string' ? firstEv : firstEv.dataUrl || firstEv.url;
      if (isValidMediaUrl(candidate) && candidate.length < 32000) {
        evUrl = candidate;
      }
    }

    let backendResult = null;
    try {
      const res = await httpClient.put(`/api/disputes/workflow/decision/${cleanId}`, {
        decision,
        plazaRemarks: finalReason,
        counterEvidenceName: evNames ? evNames.slice(0, 250) : null,
        counterEvidenceUrl: evUrl,
        actor,
        actorPlazaId,
        isMasterAdmin: actorPlazaId === 'ALL' || !actorPlazaId,
      });
      if (res && res.data) {
        backendResult = mapDbRecordToUi(res.data);
      }
    } catch (err) {
      console.warn('[DisputeManagementService] DB decision notice:', err?.message);
      if (err?.response?.data?.error) {
        throw new Error(err.response.data.error);
      }
    }

    const updatedRow = backendResult || {
      ...(row || fallbackRow || {}),
      rowId: cleanId,
      disputeId: cleanId,
      plazaAction: 'Yes',
      disputeStatus: decision,
      lifecycleStatus: decision === 'Approved' ? 'Plaza Accepted' : 'Plaza Rejected',
      plazaRemarks: finalReason,
      plazaReason: finalReason,
      plazaEvidence: evidenceList.length > 0 ? evidenceList : (row?.plazaEvidence || []),
      plazaActionTime: istNow,
      plazaActionBy: actor,
      decidedAt: new Date().toISOString(),
    };

    const existingIndex = rows.findIndex((r) =>
      String(r.rowId || '') === cleanId ||
      String(r.disputeId || '') === cleanId ||
      (r.id && String(r.id) === cleanId)
    );

    let updated;
    if (existingIndex >= 0) {
      updated = rows.map((r, i) => (i === existingIndex ? { ...r, ...updatedRow } : r));
    } else {
      updated = [updatedRow, ...rows];
    }

    this.saveDisputes(updated);
    this.logAudit('PLAZA_DECISION', `Plaza decided ${decision} for dispute ${cleanId} at ${istNow}`, actor);
    return { success: true };
  }

  /**
   * Close a dispute with persistence to Railway MySQL
   */
  async closeDispute(rowId, closeRemarks = '', actor = 'Master Admin') {
    const cleanId = String(rowId || '').trim();
    try {
      await httpClient.put(`/api/disputes/workflow/close/${cleanId}`, {
        closeRemarks,
        actor,
      });
    } catch (err) {
      console.warn('[DisputeManagementService] DB close notice:', err?.message);
    }

    const rows = this.getStoredDisputes();
    const updated = rows.map((r) => {
      if (String(r.rowId || '') === cleanId || String(r.disputeId || '') === cleanId) {
        return {
          ...r,
          closed: true,
          closedAt: new Date().toISOString(),
          closedBy: actor,
          closeRemarks,
          lifecycleStatus: 'Closed',
        };
      }
      return r;
    });

    this.saveDisputes(updated);
    this.logAudit('CLOSE_DISPUTE', `Closed dispute ${cleanId}`, actor);
    return { success: true };
  }

  /**
   * Match CSV rows against Single Master Transaction Table and check Dispute validations:
   * 1. Backend API matching against toll_transactions (/api/disputes/workflow/batches/validate-and-match)
   * 2. Strict Whitelist of Allowed Function Codes (450, 451, 471, 479, 481, 680)
   * 3. Dual-key duplicate rule: Same RRN AND Same Function Code in active queue
   * 4. Disputed Amount: from CSV file
   * 5. Txn Amount, Plaza ID, Plaza Name, Txn Date: from single transaction table
   * 6. Mismatched records: marked and excluded from Dispute Assign
   */
  async matchCsvRows(parsedRows, fallbackDisputeFileDate = '') {
    try {
      const resp = await httpClient.post('/api/disputes/workflow/batches/validate-and-match', {
        rows: parsedRows,
        disputeFileDate: fallbackDisputeFileDate,
      });
      if (resp && resp.data && Array.isArray(resp.data.results)) {
        return resp.data;
      }
    } catch (err) {
      console.warn('[DisputeManagementService] Server validate-and-match notice:', err?.message);
    }

    // Client-side fallback adhering to exact validation rules
    const existing = this.getStoredDisputes();
    const results = [];
    const errorRows = [];
    let matchedCount = 0;
    let mismatchedCount = 0;
    let duplicateCount = 0;
    let invalidCodeCount = 0;

    const cachedPlazas = OnboardingService.getCachedPlazas() || [];
    const apiPlazaMap = {};
    cachedPlazas.forEach((p) => {
      const pid = String(p.id || '').trim();
      if (pid) {
        apiPlazaMap[pid] = p.name || `Plaza ${pid}`;
      }
    });

    parsedRows.forEach((row, idx) => {
      const rowNum = idx + 2; // 1-based header offset
      const rrn = (row['RRN'] || row['rrn'] || row['Acq Txn ID'] || row['Acquirer Reference Number'] || '').trim();
      const rawFuncCode = String(row['Function Code'] || row['functionCode'] || row['FunctionCode'] || '450').trim();

      // Robust extraction of settlement date from CSV file (case-insensitive & whitespace tolerant)
      let rawSettlement = '';
      const dateKeys = [
        'Settlement Date', 'settlementDate', 'Settlement_Date', 'Settlement date', 'SETTLEMENT DATE', 'SettlementDate', 'Settlement', 'Date Settlement',
        'Dispute Raise Date', 'Dispute Raised Date', 'Dispute_Raise_Date', 'Dispute Date', 'DisputeDate', 'Dispute_Date', 'DISPUTE RAISE DATE',
        'CB Raised Date', 'CB Date', 'CB_Raised_Date', 'CBRaisedDate', 'CB_Date',
        'Txn Date', 'Transaction Date', 'txnDate', 'Txn_Date', 'Transaction_Date',
        'Date', 'Release Date', 'Release_Date', 'File Date'
      ];
      for (const k of dateKeys) {
        if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
          rawSettlement = String(row[k]).trim();
          break;
        }
      }
      if (!rawSettlement) {
        for (const rk of Object.keys(row)) {
          const cleanK = rk.toLowerCase().replace(/[\s_-]/g, '');
          if (['settlementdate', 'datesettlement', 'settlement', 'disputeraisedate', 'disputedate', 'cbraisedate', 'cbdate', 'txndate', 'transactiondate', 'date'].includes(cleanK)) {
            const v = row[rk];
            if (v !== undefined && v !== null && String(v).trim() !== '') {
              rawSettlement = String(v).trim();
              break;
            }
          }
        }
      }

      // User requirement: Dispute Raise Date MUST use settlement date from file, or selected file date
      let parsedRowDate = parseSettlementDate(rawSettlement, fallbackDisputeFileDate);
      let settlementDate = parsedRowDate.formatted;

      // Extract Disputed Amount from CSV (Rule 3.3)
      const rawDisputeAmt = row['Dispute Amount'] || row['Disputed Amount'] || row['disputeAmount'] || row['Amount'] || row['Dispute Amt'];
      const parsedDisputeAmt = rawDisputeAmt !== undefined && rawDisputeAmt !== null && String(rawDisputeAmt).trim() !== ''
        ? Number(String(rawDisputeAmt).replace(/,/g, '').trim())
        : null;

      if (!rrn) {
        errorRows.push({
          rowNumber: rowNum,
          rrn: 'EMPTY',
          functionCode: rawFuncCode || '—',
          disputeAmount: parsedDisputeAmt || 0,
          reason: 'Missing RRN / Acq Txn ID',
        });
        mismatchedCount++;
        return;
      }

      // Rule 3.4.b: Whitelist Check
      if (!ALLOWED_FUNCTION_CODES.includes(rawFuncCode)) {
        invalidCodeCount++;
        errorRows.push({
          rowNumber: rowNum,
          rrn,
          functionCode: rawFuncCode,
          disputeAmount: parsedDisputeAmt || 0,
          reason: `Invalid Function Code '${rawFuncCode}'. Allowed codes are: 450, 451, 471, 479, 481, 680.`,
        });
        return;
      }

      // Rule 3.1: Match RRN with Single Master Transaction Table
      const masterHit = TRANSACTION_MASTER[rrn];
      const csvPlazaId = (row['Plaza ID'] || row['Merchant ID'] || row['plazaId'] || row['Toll Plaza ID'] || '').trim();
      const resolvedPlazaName = apiPlazaMap[csvPlazaId] || PLAZA_MAP[csvPlazaId];
      const directPlazaHit = (csvPlazaId && resolvedPlazaName) ? {
        tollTxnId: row['Toll Txn ID'] || row['tollTxnId'] || `TXN-${rrn.slice(-6)}`,
        vrn: row['Vehicle Registration Number'] || row['VRN'] || row['vrn'] || '—',
        tagId: row['Tag ID'] || row['tagId'] || '—',
        plazaId: csvPlazaId,
        plazaName: resolvedPlazaName,
        txnDate: row['Txn Date'] || row['txnDate'] || '—',
        txnAmount: Number(row['Transaction Amount'] || row['txnAmount'] || 85.00),
      } : null;

      const hit = masterHit || directPlazaHit;

      if (!hit) {
        // Rule 3.1.4: Mismatched - not found in master transaction table
        mismatchedCount++;
        errorRows.push({
          rowNumber: rowNum,
          rrn,
          functionCode: rawFuncCode,
          disputeAmount: parsedDisputeAmt || 0,
          reason: `Mismatched: RRN ${rrn} not found in Master Transaction Table`,
        });
        return; // Exclude from results so it NEVER enters Dispute Assign
      }

      // Rule 3.4.a: Duplicate Check (Same RRN AND Same Function Code in active queue)
      const isExactDuplicate = existing.some(
        (e) => e.acqTxnId === rrn && String(e.functionCode) === String(rawFuncCode) && !e.closed
      );

      if (isExactDuplicate) {
        duplicateCount++;
        errorRows.push({
          rowNumber: rowNum,
          rrn,
          functionCode: rawFuncCode,
          disputeAmount: parsedDisputeAmt !== null ? parsedDisputeAmt : hit.txnAmount,
          reason: `Duplicate row: Transaction RRN ${rrn} with function code ${rawFuncCode} already has an active open dispute in queue`,
        });
        return;
      }

      // Matched and Valid!
      matchedCount++;
      const plazaId = hit.plazaId || csvPlazaId || '501101';
      const plazaName = hit.plazaName || apiPlazaMap[plazaId] || PLAZA_MAP[plazaId] || 'MUMBAI PLAZA NH-04';

      const rawMemberMsg = (() => {
        for (const k of ['Member Message Text', 'memberMessageText', 'MemberMessageText', 'CB Reason', 'cbReason', 'CB_Reason', 'Reason', 'Member_Message_Text', 'Member message text']) {
          if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
            return String(row[k]).trim();
          }
        }
        for (const rk of Object.keys(row)) {
          const cleanK = rk.toLowerCase().replace(/[\s_-]/g, '');
          if (cleanK === 'membermessagetext' || cleanK === 'cbreason' || cleanK === 'reason') {
            const v = row[rk];
            if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
          }
        }
        return '';
      })();
      const memberMsgVal = rawMemberMsg || 'Imported from bank file';

      const finalDisputeAmt = parsedDisputeAmt !== null ? parsedDisputeAmt : hit.txnAmount;

      let effectiveSettlementDate = settlementDate;
      if (!effectiveSettlementDate && hit.txnDate) {
        effectiveSettlementDate = parseSettlementDate(hit.txnDate).formatted || '';
      }
      const effectiveTatDue = computeTatDueDate(effectiveSettlementDate);

      results.push({
        rowNumber: rowNum,
        status: 'Matched',
        isMatched: true,
        alreadyQueued: false,
        rrn,
        tagId: hit.tagId || row['Tag ID'] || '—',
        functionCode: rawFuncCode,
        disputeType: FUNCTION_CODE_MAP[rawFuncCode] || `Code ${rawFuncCode}`,
        settlementDate: effectiveSettlementDate,
        tatDueDate: effectiveTatDue,
        txnAmount: hit.txnAmount, // Authoritative Transaction Amount from master
        disputeAmount: finalDisputeAmt, // Disputed Amount from CSV
        memberMessageText: memberMsgVal,
        cbReason: memberMsgVal,
        plazaId,
        plazaName,
        vrn: hit.vrn || row['Vehicle Registration Number'] || '—',
        tollTxnId: hit.tollTxnId || '—',
        txnDate: hit.txnDate || '—',
      });
    });

    return {
      totalRows: parsedRows.length,
      matchedCount,
      mismatchedCount,
      duplicateCount,
      invalidCodeCount,
      results,
      errorRows,
    };
  }

  /**
   * Commit matched rows directly to Railway MySQL database
   */
  async commitMatchedRows(fileName, matchedResults, actor = 'Master Admin', npciMeta = null, disputeFileDate = '') {
    // 1. Strict Duplicate File Name Check: User requirement: "Duplicate 01 files (file with same name) are getting uploaded this should accept unique name every time"
    const liveBatches = await this.fetchBatches();
    const localBatches = this.getBatches();
    const existingBatches = [...(Array.isArray(liveBatches) ? liveBatches : []), ...(Array.isArray(localBatches) ? localBatches : [])];
    const cleanFileName = String(fileName || '').trim();
    const isDuplicate = existingBatches.some(
      (b) => b.fileName && b.fileName.trim().toLowerCase() === cleanFileName.toLowerCase()
    );
    if (isDuplicate) {
      throw new Error(`Duplicate File Error: A dispute file with name "${cleanFileName}" has already been uploaded previously. The system accepts unique file names only.`);
    }

    const resolvedFileDate = disputeFileDate || npciMeta?.releaseDate || '';
    const existing = this.getStoredDisputes();
    const toInsert = [];

    matchedResults.forEach((r) => {
      if (!r.isMatched || r.alreadyQueued) return;
      const exists = existing.some(
        (e) => e.acqTxnId === r.rrn && String(e.functionCode) === String(r.functionCode) && !e.closed
      );
      if (exists) return;

      // User requirement: "Currently dispute raised date showing the date when file is uploaded rather than it should show date settlement from file as dispute raise date"
      const effectiveCbRaisedDate = r.settlementDate || resolvedFileDate || (npciMeta?.releaseDate) || '';

      toInsert.push({
        disputeId: `DISP-${Math.floor(1000 + Math.random() * 9000)}`,
        acqTxnId: r.rrn,
        tollTxnId: r.tollTxnId,
        vrn: r.vrn,
        tagId: r.tagId,
        plazaId: String(r.plazaId),
        plazaName: r.plazaName,
        txnDate: r.txnDate,
        settlementDate: r.settlementDate,
        tatDueDate: r.tatDueDate,
        txnAmount: r.txnAmount,
        disputeAmount: r.disputeAmount,
        cbRaisedDate: effectiveCbRaisedDate,
        cbReason: r.memberMessageText,
        functionCode: String(r.functionCode),
        functionLabel: r.disputeType,
        disputeType: r.disputeType,
        memberMessageText: r.memberMessageText,
        adminRemarks: r.memberMessageText,
        adminReason: r.memberMessageText,
      });
    });

    const batchId = `BATCH-${Date.now().toString().slice(-6)}`;

    // Cache batch date locally for instant UI reflection
    if (resolvedFileDate) {
      this.setBatchDate(batchId, cleanFileName, resolvedFileDate);
    }

    this.saveBatch({
      batchId,
      fileName: cleanFileName,
      disputeFileDate: resolvedFileDate,
      uploadedAt: formatIstTimestamp(),
      uploadedBy: actor,
      totalRows: matchedResults.length,
      matchedRows: toInsert.length,
      unmatchedRows: matchedResults.length - toInsert.length,
      status: 'Processed',
    });

    // 2. Persist directly to Railway MySQL database
    try {
      await httpClient.post('/api/disputes/workflow/batches/upload', {
        batchId,
        fileName: cleanFileName,
        disputeFileDate: resolvedFileDate,
        uploadedBy: actor,
        totalRows: matchedResults.length,
        unmatchedRows: matchedResults.length - toInsert.length,
        rows: toInsert,
      });
    } catch (err) {
      console.warn('[DisputeManagementService] DB batch upload notice:', err?.message);
    }

    // 3. Re-sync from Railway MySQL to get fresh DB records
    await this.syncFromBackend();

    this.logAudit('FILE_UPLOAD', `Uploaded ${fileName}: added ${toInsert.length} disputes to Railway DB`, actor);
    return { inserted: toInsert.length };
  }

  /**
   * Clear all disputes from Railway MySQL database and local cache
   */
  async clearAllDisputes() {
    try {
      await httpClient.delete('/api/disputes/workflow/clear');
    } catch (err) {
      console.warn('[DisputeManagementService] DB clear notice:', err?.message);
    }
    this.saveDisputes([]);
    localStorage.removeItem(STORAGE_KEY_BATCHES);
    return true;
  }
}

export default new DisputeManagementService();
