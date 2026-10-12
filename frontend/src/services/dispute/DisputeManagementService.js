import {
  FUNCTION_CODE_MAP,
  PLAZA_MAP,
  DEFAULT_PLAZAS,
  TRANSACTION_MASTER,
  DEFAULT_TAT_DAYS,
} from '../../config/disputeConstants';
import httpClient from '../api/httpClient';
import OnboardingService from '../onboarding/OnboardingService';
import evidenceStorage, { isValidMediaUrl } from './evidenceStorage';

const STORAGE_KEY_DISPUTES = 'paysonic_disputes_db_cache_v1';
const STORAGE_KEY_BATCHES = 'paysonic_dispute_batches_db_cache_v1';
const STORAGE_KEY_AUDIT = 'paysonic_dispute_audit_db_v1';

/**
 * Parses YYMMDD (e.g. '261008' -> '08-10-2026') or DD-MM-YYYY / YYYY-MM-DD
 */
export function parseSettlementDate(raw) {
  if (!raw) {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    return { formatted: `${dd}-${mm}-${yyyy}`, dateObj: today };
  }

  const str = String(raw).trim();
  // 6-digit YYMMDD format: e.g. 261008
  if (/^\d{6}$/.test(str)) {
    const yy = parseInt(str.substring(0, 2), 10);
    const mm = parseInt(str.substring(2, 4), 10);
    const dd = parseInt(str.substring(4, 6), 10);
    const yyyy = 2000 + yy;
    const dateObj = new Date(yyyy, mm - 1, dd);
    const formatted = `${String(dd).padStart(2, '0')}-${String(mm).padStart(2, '0')}-${yyyy}`;
    return { formatted, dateObj };
  }

  // DD-MM-YYYY format
  if (/^\d{2}-\d{2}-\d{4}$/.test(str)) {
    const [dd, mm, yyyy] = str.split('-').map((v) => parseInt(v, 10));
    return { formatted: str, dateObj: new Date(yyyy, mm - 1, dd) };
  }

  // YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [yyyy, mm, dd] = str.split('-').map((v) => parseInt(v, 10));
    const formatted = `${String(dd).padStart(2, '0')}-${String(mm).padStart(2, '0')}-${yyyy}`;
    return { formatted, dateObj: new Date(yyyy, mm - 1, dd) };
  }

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const dd = String(parsed.getDate()).padStart(2, '0');
    const mm = String(parsed.getMonth() + 1).padStart(2, '0');
    const yyyy = parsed.getFullYear();
    return { formatted: `${dd}-${mm}-${yyyy}`, dateObj: parsed };
  }

  const today = new Date();
  const dd = String(today.getDate()).padStart(2, '0');
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const yyyy = today.getFullYear();
  return { formatted: `${dd}-${mm}-${yyyy}`, dateObj: today };
}

/**
 * Calculate TAT Due Date = Settlement Date + 8 days (T+8)
 */
export function computeTatDueDate(settlementDateStr) {
  const { dateObj } = parseSettlementDate(settlementDateStr);
  const due = new Date(dateObj);
  due.setDate(due.getDate() + 8);
  const dd = String(due.getDate()).padStart(2, '0');
  const mm = String(due.getMonth() + 1).padStart(2, '0');
  const yyyy = due.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

/**
 * Format current timestamp in IST: DD-MM-YYYY HH:mm:ss
 */
export function formatIstTimestamp(date = new Date()) {
  const d = new Date(date);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${dd}-${mm}-${yyyy} ${hh}:${min}:${ss}`;
}

/**
 * Format any date/timestamp into standard DD-MM-YYYY HH:mm:ss IST format
 */
export function formatDisplayDateTime(val) {
  if (!val || val === '—' || val === 'null' || val === 'undefined') return '';
  const str = String(val).trim();
  if (!str) return '';

  // If already in DD-MM-YYYY HH:mm:ss format
  if (/^\d{2}-\d{2}-\d{4}\s+\d{2}:\d{2}:\d{2}$/.test(str)) {
    return str;
  }
  // If DD-MM-YYYY HH:mm format
  if (/^\d{2}-\d{2}-\d{4}\s+\d{2}:\d{2}$/.test(str)) {
    return `${str}:00`;
  }
  // If DD-MM-YYYY only
  if (/^\d{2}-\d{2}-\d{4}$/.test(str)) {
    return `${str} 00:00:00`;
  }

  // Handle ISO strings, e.g. 2026-10-10T09:54:52 or timestamps
  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      const hh = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      const ss = String(d.getSeconds()).padStart(2, '0');
      return `${dd}-${mm}-${yyyy} ${hh}:${min}:${ss}`;
    }
  } catch {}

  return str;
}

/**
 * Normalizes a raw database record from Railway MySQL into the UI shape
 */
function mapDbRecordToUi(r, idx = 0) {
  const dispId = r.disputeId || (r.id ? `DISP-${r.id}` : `ROW-${idx + 1}`);
  const settlement = r.settlementDate || (r.npciSettlementDate ? String(r.npciSettlementDate) : '');
  const tatDue = r.tatDueDate || (settlement ? computeTatDueDate(settlement) : '');
  const txnDateStr = r.txnDate || (r.txnDateTime ? String(r.txnDateTime).replace('T', ' ').slice(0, 19) : '');

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
    resolvedAssignedAt = candidate ? (formatDisplayDateTime(candidate) || String(candidate)) : formatIstTimestamp();
  }

  const fileReason = (r.memberMessageText || r.cbReason || r.member_message_text || r.cb_reason || '').trim();
  const existingRemarks = (r.adminRemarks || r.adminReason || '').trim();
  const resolvedAdminReason = (!existingRemarks || existingRemarks === 'Bulk-assigned for plaza review') && fileReason
    ? fileReason
    : (existingRemarks || fileReason);

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
    settlementDate: settlement,
    tatDueDate: tatDue,
    cbRaisedDate: r.cbRaisedDate || settlement,
    cbReason: fileReason || '—',
    memberMessageText: fileReason || '—',
    assigned: isAssigned,
    assignedAt: resolvedAssignedAt,
    assignedToPlaza: r.assignedToPlaza || (isAssigned ? r.plazaId : null),
    adminReason: resolvedAdminReason,
    adminRemarks: resolvedAdminReason,
    adminRemarksAt: r.adminRemarksAt ? formatDisplayDateTime(r.adminRemarksAt) : '',
    plazaAction: (r.plazaAction === true || r.plazaAction === 'Yes' || r.plazaAction === 'Accepted' || r.plazaAction === 'Rejected') ? 'Yes' : 'No',
    plazaActionTime: r.plazaActionTime || '',
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

  getBatches() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_BATCHES);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  async fetchBatches() {
    try {
      const res = await httpClient.get('/api/disputes/workflow/batches');
      if (Array.isArray(res.data) && res.data.length > 0) {
        const mapped = res.data.map((b) => ({
          batchId: b.batchId,
          fileName: b.fileName,
          uploadedAt: b.uploadTimestamp ? String(b.uploadTimestamp).replace('T', ' ').slice(0, 19) : '',
          uploadedBy: b.uploadedBy || 'Master Admin',
          totalRows: b.totalRows || 0,
          matchedRows: b.matchedRows || 0,
          unmatchedRows: b.unmatchedRows || 0,
          status: b.status || 'Processed',
        }));
        localStorage.setItem(STORAGE_KEY_BATCHES, JSON.stringify(mapped));
        return mapped;
      }
    } catch (e) {
      console.debug('[DisputeManagementService] Backend batches fetch notice:', e?.message);
    }
    return this.getBatches();
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
      if (filters.functionCode && filters.functionCode !== 'ALL') queryParams.functionCode = filters.functionCode;
      if (filters.plazaId && filters.plazaId !== 'ALL') queryParams.plazaId = filters.plazaId;
      if (filters.scopedPlazaId && filters.scopedPlazaId !== 'ALL') queryParams.plazaId = filters.scopedPlazaId;
      if (filters.assignStatus) queryParams.assignStatus = filters.assignStatus;
      if (filters.disputeStatus && filters.disputeStatus !== 'ALL') queryParams.disputeStatus = filters.disputeStatus;
      if (filters.plazaAction) queryParams.plazaAction = filters.plazaAction;
      if (filters.search) queryParams.search = filters.search;

      const res = await httpClient.get('/api/disputes/workflow/queue', { params: queryParams });
      if (Array.isArray(res.data)) {
        const rows = res.data.map(mapDbRecordToUi);
        this.saveDisputes(rows, false);
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
  async assignRow(rowId, adminReason, evidenceList = [], actor = 'Master Admin', targetPlazaId = null) {
    if (!adminReason || !adminReason.trim()) {
      throw new Error('Reason / remarks explaining the dispute is mandatory.');
    }

    const rows = this.getStoredDisputes();
    const cleanId = String(rowId || '').trim();
    const row = rows.find((r) => String(r.rowId || '') === cleanId || String(r.disputeId || '') === cleanId);
    if (!row) throw new Error('Dispute row not found');
    const hasPlazaActed =
      row.disputeStatus === 'Approved' ||
      row.disputeStatus === 'Rejected' ||
      (row.plazaAction === 'Yes' && row.disputeStatus !== 'NA' && row.disputeStatus !== 'Pending');

    if (hasPlazaActed) {
      throw new Error('Admin cannot re-assign a dispute after the plaza has acted (Accept or Reject).');
    }

    const finalPlazaId = targetPlazaId ? String(targetPlazaId) : String(row.plazaId);
    const cachedPlazas = OnboardingService.getCachedPlazas() || [];
    const matchedApiPlaza = cachedPlazas.find((p) => String(p.id).trim() === finalPlazaId);
    const targetPlazaName = matchedApiPlaza?.name || PLAZA_MAP[finalPlazaId] || row.plazaName;

    try {
      await httpClient.put(`/api/disputes/workflow/assign/${cleanId}`, {
        plazaId: finalPlazaId,
        plazaName: targetPlazaName,
        adminRemarks: adminReason.trim(),
        actor,
      });
    } catch (err) {
      console.warn('[DisputeManagementService] DB assign notice:', err?.message);
    }

    if (evidenceList && evidenceList.length > 0) {
      evidenceStorage.saveAdminEvidence(cleanId, row.acqTxnId, evidenceList);
    }

    const updated = rows.map((r) => {
      if (String(r.rowId || '') === cleanId || String(r.disputeId || '') === cleanId) {
        return {
          ...r,
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
          adminEvidence: evidenceList.length > 0 ? evidenceList : (r.adminEvidence || []),
        };
      }
      return r;
    });

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
    const rows = this.getStoredDisputes();
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
    const rows = this.getStoredDisputes();
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
   * Plaza submits decision with persistence to Railway MySQL
   */
  async submitPlazaDecision(rowId, decision, plazaReason, evidenceList = [], actor = 'Plaza User', actorPlazaId = null) {
    const trimmedReason = (plazaReason || '').trim();
    if (decision === 'Rejected' && !trimmedReason) {
      throw new Error('Plaza remarks / justification are mandatory when rejecting a dispute.');
    }
    if (decision === 'Rejected' && (!evidenceList || evidenceList.length === 0)) {
      throw new Error('At least one counter-evidence file is mandatory when rejecting a dispute.');
    }
    const finalReason = trimmedReason || (decision === 'Approved' ? 'Accepted' : '');

    const rows = this.getStoredDisputes();
    const cleanId = String(rowId || '').trim();
    const row = rows.find((r) => String(r.rowId || '') === cleanId || String(r.disputeId || '') === cleanId);
    if (!row) throw new Error('Dispute row not found');
    if (row.disputeStatus !== 'NA' || row.plazaAction === 'Yes') {
      throw new Error('Decision has already been submitted and locked (single-submit rule)');
    }
    if (actorPlazaId && actorPlazaId !== 'ALL' && String(row.plazaId).trim() !== String(actorPlazaId).trim()) {
      throw new Error('Plaza cannot act on a dispute not mapped to its own plaza ID.');
    }

    const istNow = formatIstTimestamp();

    // Persist full evidence list in vault
    if (evidenceList && evidenceList.length > 0) {
      evidenceStorage.savePlazaEvidence(cleanId, row.acqTxnId, evidenceList);
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

    try {
      await httpClient.put(`/api/disputes/workflow/decision/${cleanId}`, {
        decision,
        plazaRemarks: finalReason,
        counterEvidenceName: evNames ? evNames.slice(0, 250) : null,
        counterEvidenceUrl: evUrl,
        actor,
        actorPlazaId,
        isMasterAdmin: actorPlazaId === 'ALL' || !actorPlazaId,
      });
    } catch (err) {
      console.warn('[DisputeManagementService] DB decision notice:', err?.message);
    }

    const updated = rows.map((r) => {
      if (String(r.rowId || '') === cleanId || String(r.disputeId || '') === cleanId) {
        return {
          ...r,
          plazaAction: 'Yes',
          disputeStatus: decision,
          lifecycleStatus: decision === 'Approved' ? 'Plaza Accepted' : 'Plaza Rejected',
          plazaRemarks: finalReason,
          plazaReason: finalReason,
          plazaEvidence: evidenceList.length > 0 ? evidenceList : (r.plazaEvidence || []),
          plazaActionTime: istNow,
          plazaActionBy: actor,
          decidedAt: new Date().toISOString(),
        };
      }
      return r;
    });

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
   * Match CSV rows against Transaction Master and Railway DB open records
   */
  matchCsvRows(parsedRows) {
    const existing = this.getStoredDisputes();
    const results = [];
    const errorRows = [];
    let matchedCount = 0;
    let unmatchedCount = 0;
    let duplicateCount = 0;

    // Integrate live onboarded plazas from OnboardingService API
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
      const funcCodeNum = Number(row['Function Code'] || row['functionCode'] || row['FunctionCode'] || 450);
      const rawSettlement = row['Settlement Date'] || row['settlementDate'] || row['Settlement_Date'] || '';
      const { formatted: settlementDate } = parseSettlementDate(rawSettlement);
      const tatDueDate = computeTatDueDate(settlementDate);

      if (!rrn) {
        errorRows.push({
          rowNumber: rowNum,
          rrn: 'EMPTY',
          reason: 'Missing RRN / Acq Txn ID',
        });
        unmatchedCount++;
        return;
      }

      const masterHit = TRANSACTION_MASTER[rrn];

      // A transaction can have only one open dispute at a time
      const hasOpenDispute = existing.some(
        (e) => e.acqTxnId === rrn && !e.closed
      );
      const isExactDuplicate = existing.some(
        (e) => e.acqTxnId === rrn && Number(e.functionCode) === funcCodeNum
      );
      const alreadyQueued = hasOpenDispute || isExactDuplicate;

      if (alreadyQueued) {
        duplicateCount++;
        errorRows.push({
          rowNumber: rowNum,
          rrn,
          reason: hasOpenDispute
            ? `Duplicate row: Transaction RRN ${rrn} already has an active open dispute in queue`
            : `Duplicate row: RRN ${rrn} with function code ${funcCodeNum} already exists in queue`,
        });
      }

      const csvPlazaId = (row['Plaza ID'] || row['Merchant ID'] || row['plazaId'] || row['Toll Plaza ID'] || '').trim();
      const resolvedPlazaName = apiPlazaMap[csvPlazaId] || PLAZA_MAP[csvPlazaId];
      const directPlazaHit = (csvPlazaId && resolvedPlazaName) ? {
        tollTxnId: row['Toll Txn ID'] || row['tollTxnId'] || `TXN-${rrn.slice(-6)}`,
        vrn: row['Vehicle Registration Number'] || row['VRN'] || row['vrn'] || '—',
        tagId: row['Tag ID'] || row['tagId'] || '—',
        plazaId: csvPlazaId,
        plazaName: resolvedPlazaName,
        txnDate: row['Txn Date'] || row['txnDate'] || '—',
        txnAmount: Number(row['Transaction Amount'] || row['txnAmount'] || row['Dispute Amount'] || 0),
      } : null;

      const hit = masterHit || directPlazaHit;

      if (hit) {
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

        results.push({
          rowNumber: rowNum,
          status: alreadyQueued ? 'Duplicate' : 'Matched',
          isMatched: true,
          alreadyQueued,
          rrn,
          tagId: hit.tagId || row['Tag ID'] || '—',
          functionCode: funcCodeNum,
          disputeType: FUNCTION_CODE_MAP[funcCodeNum] || `Code ${funcCodeNum}`,
          settlementDate,
          tatDueDate,
          txnAmount: hit.txnAmount || Number(row['Transaction Amount'] || 0),
          disputeAmount: hit.txnAmount || Number(row['Transaction Amount'] || 0),
          memberMessageText: memberMsgVal,
          cbReason: memberMsgVal,
          plazaId,
          plazaName,
          vrn: hit.vrn || row['Vehicle Registration Number'] || '—',
          tollTxnId: hit.tollTxnId || '—',
          txnDate: hit.txnDate || '—',
        });
      } else {
        unmatchedCount++;
        errorRows.push({
          rowNumber: rowNum,
          rrn,
          reason: `Unmatched: RRN ${rrn} not found in authoritative Transaction Master`,
        });
        results.push({
          rowNumber: rowNum,
          status: 'Unmatched',
          isMatched: false,
          alreadyQueued: false,
          rrn,
          tagId: row['Tag ID'] || '—',
          functionCode: funcCodeNum,
          disputeType: FUNCTION_CODE_MAP[funcCodeNum] || `Code ${funcCodeNum}`,
          settlementDate,
          tatDueDate,
          txnAmount: Number(row['Transaction Amount'] || 0),
          disputeAmount: Number(row['Transaction Amount'] || 0),
          memberMessageText: row['Member Message Text'] || '—',
          plazaId: row['Merchant ID'] || '—',
          plazaName: 'Unmapped',
          vrn: row['Vehicle Registration Number'] || '—',
          tollTxnId: '—',
          txnDate: '—',
        });
      }
    });

    return {
      totalRows: parsedRows.length,
      matchedCount,
      unmatchedCount,
      duplicateCount,
      results,
      errorRows,
    };
  }

  /**
   * Commit matched rows directly to Railway MySQL database
   */
  async commitMatchedRows(fileName, matchedResults, actor = 'Master Admin') {
    const existing = this.getStoredDisputes();
    const toInsert = [];

    matchedResults.forEach((r) => {
      if (!r.isMatched || r.alreadyQueued) return;
      const exists = existing.some(
        (e) => e.acqTxnId === r.rrn && Number(e.functionCode) === Number(r.functionCode)
      );
      if (exists) return;

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
        cbRaisedDate: new Date().toLocaleDateString('en-GB').replace(/\//g, '-'),
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

    // 1. Persist directly to Railway MySQL database
    try {
      await httpClient.post('/api/disputes/workflow/batches/upload', {
        batchId,
        fileName,
        uploadedBy: actor,
        totalRows: matchedResults.length,
        unmatchedRows: matchedResults.length - toInsert.length,
        rows: toInsert,
      });
    } catch (err) {
      console.warn('[DisputeManagementService] DB batch upload notice:', err?.message);
    }

    // 2. Re-sync from Railway MySQL to get fresh DB records
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
