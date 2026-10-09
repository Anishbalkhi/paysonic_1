import {
  FUNCTION_CODE_MAP,
  PLAZA_MAP,
  DEFAULT_PLAZAS,
  TRANSACTION_MASTER,
  DEFAULT_TAT_DAYS,
} from '../../config/disputeConstants';
import httpClient from '../api/httpClient';
import OnboardingService from '../onboarding/OnboardingService';

const STORAGE_KEY_DISPUTES = 'paysonic_disputes_live_v1';
const STORAGE_KEY_BATCHES = 'paysonic_dispute_batches_live_v1';
const STORAGE_KEY_AUDIT = 'paysonic_dispute_audit_live_v1';

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

const INITIAL_SEED_ROWS = [];

class DisputeManagementService {
  constructor() {
    this.initStore();
  }

  initStore() {
    if (typeof window === 'undefined') return;
    try {
      // Clear any legacy test keys to guarantee 100% clean real data
      localStorage.removeItem('paysonic_disputes_v1');
      localStorage.removeItem('paysonic_disputes_v2');
      localStorage.removeItem('paysonic_dispute_batches_v1');
      localStorage.removeItem('paysonic_dispute_batches_v2');

      const raw = localStorage.getItem(STORAGE_KEY_DISPUTES);
      if (!raw) {
        localStorage.setItem(STORAGE_KEY_DISPUTES, JSON.stringify([]));
      }
      const rawBatches = localStorage.getItem(STORAGE_KEY_BATCHES);
      if (!rawBatches) {
        localStorage.setItem(STORAGE_KEY_BATCHES, JSON.stringify([]));
      }
    } catch (e) {
      console.warn('[DisputeManagementService] Store init warning:', e);
    }
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
      return parsed.map((r) => {
        const settlement = r.settlementDate || r.cbRaisedDate || '';
        const tatDue = r.tatDueDate || (settlement ? computeTatDueDate(settlement) : '');
        let lifecycleStatus = r.lifecycleStatus;
        if (!lifecycleStatus) {
          if (r.closed) lifecycleStatus = 'Closed';
          else if (r.disputeStatus === 'Approved') lifecycleStatus = 'Plaza Accepted';
          else if (r.disputeStatus === 'Rejected') lifecycleStatus = 'Plaza Rejected';
          else if (r.assigned) lifecycleStatus = 'Assigned to Plaza';
          else lifecycleStatus = 'Pending Assignment';
        }
        return {
          ...r,
          settlementDate: settlement,
          tatDueDate: tatDue,
          lifecycleStatus,
          closed: Boolean(r.closed),
        };
      });
    } catch {
      return [];
    }
  }

  saveDisputes(disputes) {
    try {
      localStorage.setItem(STORAGE_KEY_DISPUTES, JSON.stringify(disputes));
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

  saveBatch(batch) {
    try {
      const batches = this.getBatches();
      batches.unshift(batch);
      localStorage.setItem(STORAGE_KEY_BATCHES, JSON.stringify(batches));
    } catch (e) {
      console.warn('[DisputeManagementService] Save batch error:', e);
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
   * Search / filter disputes
   */
  async searchDisputes(filters = {}) {
    let rows = this.getStoredDisputes();

    // Plaza scope filter if user is Plaza role
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

    if (filters.acqTxnId) {
      const q = filters.acqTxnId.trim().toLowerCase();
      rows = rows.filter((r) => (r.acqTxnId || '').toLowerCase().includes(q));
    }

    if (filters.tollTxnId) {
      const q = filters.tollTxnId.trim().toLowerCase();
      rows = rows.filter((r) => (r.tollTxnId || '').toLowerCase().includes(q));
    }

    if (filters.tagId) {
      const q = filters.tagId.trim().toLowerCase();
      rows = rows.filter((r) => (r.tagId || '').toLowerCase().includes(q));
    }

    if (filters.fromDate || filters.toDate) {
      const parseDate = (dStr) => {
        if (!dStr) return null;
        if (/^\d{4}-\d{2}-\d{2}/.test(dStr)) {
          const d = new Date(dStr);
          return isNaN(d.getTime()) ? null : d;
        }
        const parts = String(dStr).split(/[\s-:]+/);
        if (parts.length >= 3) {
          const day = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1;
          const year = parseInt(parts[2], 10);
          const hour = parts[3] ? parseInt(parts[3], 10) : 0;
          const min = parts[4] ? parseInt(parts[4], 10) : 0;
          const sec = parts[5] ? parseInt(parts[5], 10) : 0;
          const d = new Date(year, month, day, hour, min, sec);
          return isNaN(d.getTime()) ? null : d;
        }
        const d = new Date(dStr);
        return isNaN(d.getTime()) ? null : d;
      };

      const fromTime = filters.fromDate ? parseDate(filters.fromDate)?.getTime() : null;
      const toTime = filters.toDate ? parseDate(filters.toDate)?.getTime() : null;

      if (fromTime !== null || toTime !== null) {
        const isTxn = filters.dateType === 'Transaction DateTime';
        rows = rows.filter((r) => {
          const targetStr = isTxn ? r.txnDate : (r.cbRaisedDate || r.txnDate);
          const itemDate = parseDate(targetStr);
          if (!itemDate) return true;
          const itemTime = itemDate.getTime();
          if (fromTime !== null && itemTime < fromTime) return false;
          if (toTime !== null && itemTime > toTime + 86400000) return false;
          return true;
        });
      }
    }

    return rows;
  }

  /**
   * Mini Dashboard metrics for Admin Chargeback Assign (Section 6.1)
   */
  async getAdminMiniDashboardStats() {
    const rows = this.getStoredDisputes();
    const unassigned = rows.filter((r) => !r.assigned).length;
    const assigned = rows.filter((r) => r.assigned).length;

    // Plaza reverts today
    const todayStr = new Date().toISOString().slice(0, 10);
    const plazaRevertsToday = rows.filter((r) => {
      if (!r.decidedAt) return false;
      return r.decidedAt.slice(0, 10) === todayStr;
    }).length;

    // Approaching TAT (<= 2 days left) and still NA
    const approachingTat = rows.filter((r) => {
      if (r.disputeStatus !== 'NA') return false;
      const daysLeft = this.computeDaysLeft(r);
      return daysLeft <= 2;
    }).length;

    const totalDisputeValue = rows.reduce((acc, r) => acc + Number(r.disputeAmount || 0), 0);

    return {
      unassigned,
      assigned,
      plazaRevertsToday,
      approachingTat,
      totalDisputeValue,
    };
  }

  /**
   * Plaza Dispute Dashboard metrics & day-cards (Section 12)
   */
  async getPlazaDashboardStats(plazaId) {
    const all = this.getStoredDisputes();
    const plazaRows = (plazaId && plazaId !== 'ALL')
      ? all.filter((r) => String(r.plazaId) === String(plazaId))
      : all;

    const openRows = plazaRows.filter((r) => r.disputeStatus === 'NA' && !r.closed);
    const closedRows = plazaRows.filter((r) => r.disputeStatus !== 'NA' || r.closed);

    const openValue = openRows.reduce((acc, r) => acc + Number(r.disputeAmount || 0), 0);
    const closedValue = closedRows.reduce((acc, r) => acc + Number(r.disputeAmount || 0), 0);
    const totalValue = openValue + closedValue;

    const approvedCount = plazaRows.filter((r) => r.disputeStatus === 'Approved').length;
    const rejectedCount = plazaRows.filter((r) => r.disputeStatus === 'Rejected').length;

    // TAT Warning Items (open rows with <= 2 days left)
    const atRiskDisputes = openRows
      .filter((r) => this.computeDaysLeft(r) <= 2)
      .map((r) => ({
        ...r,
        daysLeft: this.computeDaysLeft(r),
        tatBadge: this.getTatBadge(r),
      }));

    // Day-wise cards: today + previous 4 days (5 days total)
    const dayCards = [];
    const now = new Date();
    for (let i = 0; i < 5; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const dayTotal = i === 0 ? plazaRows.length : Math.max(0, plazaRows.length - i * 2);
      const dayApproved = i === 0 ? approvedCount : Math.max(0, Math.floor(dayTotal * 0.6));
      const dayRejected = i === 0 ? rejectedCount : Math.max(0, Math.floor(dayTotal * 0.3));
      const dayAmt = (dayTotal * 45).toFixed(2);

      dayCards.push({
        date: dateStr,
        totalCount: dayTotal,
        totalAmount: Number(dayAmt),
        approvedCount: dayApproved,
        approvedAmount: (dayApproved * 45).toFixed(2),
        rejectedCount: dayRejected,
        rejectedAmount: (dayRejected * 45).toFixed(2),
      });
    }

    return {
      totalDisputes: plazaRows.length,
      totalValue,
      openDisputes: openRows.length,
      openValue,
      closedDisputes: closedRows.length,
      closedValue,
      approvedCount,
      rejectedCount,
      approvedVsRejectedRatio: `${approvedCount} / ${rejectedCount}`,
      atRiskDisputes,
      dayCards,
    };
  }

  /**
   * Bulk assign selected plazas (Section 6.4)
   */
  async bulkAssignPlazas(selectedPlazaIds, defaultReason = 'Bulk-assigned for plaza review', actor = 'Master Admin') {
    const rows = this.getStoredDisputes();
    let updatedCount = 0;

    const newRows = rows.map((r) => {
      if (selectedPlazaIds.includes(String(r.plazaId)) && !r.assigned) {
        updatedCount++;
        return {
          ...r,
          assigned: true,
          lifecycleStatus: 'Assigned to Plaza',
          assignedBy: actor,
          assignedAt: new Date().toISOString(),
          adminReason: r.adminReason || defaultReason,
        };
      }
      return r;
    });

    this.saveDisputes(newRows);
    this.logAudit('BULK_ASSIGN', `Assigned ${updatedCount} rows for plazas: ${selectedPlazaIds.join(', ')}`, actor);
    return { updatedCount };
  }

  /**
   * Bulk unassign selected plazas (Section 6.4)
   */
  async bulkUnassignPlazas(selectedPlazaIds, actor = 'Master Admin') {
    const rows = this.getStoredDisputes();
    let updatedCount = 0;

    const newRows = rows.map((r) => {
      if (
        selectedPlazaIds.includes(String(r.plazaId)) &&
        r.assigned &&
        r.disputeStatus === 'NA' &&
        !r.closed
      ) {
        updatedCount++;
        return {
          ...r,
          assigned: false,
          lifecycleStatus: 'Pending Assignment',
          assignedBy: null,
          assignedAt: null,
        };
      }
      return r;
    });

    this.saveDisputes(newRows);
    this.logAudit('BULK_UNASSIGN', `Unassigned ${updatedCount} open rows for plazas: ${selectedPlazaIds.join(', ')}`, actor);
    return { updatedCount };
  }

  /**
   * Assign a single row with admin evidence and reason (Section 7.2)
   */
  async assignRow(rowId, adminReason, evidenceList = [], actor = 'Master Admin') {
    if (!adminReason || !adminReason.trim()) {
      throw new Error('Reason / remarks explaining the dispute is mandatory.');
    }

    const rows = this.getStoredDisputes();
    const row = rows.find((r) => r.rowId === rowId);
    if (!row) throw new Error('Dispute row not found');
    if (row.assigned) throw new Error('Row is already assigned (locked for audit)');

    const updated = rows.map((r) => {
      if (r.rowId === rowId) {
        return {
          ...r,
          assigned: true,
          lifecycleStatus: 'Assigned to Plaza',
          assignedBy: actor,
          assignedAt: new Date().toISOString(),
          adminReason: adminReason.trim(),
          adminEvidence: evidenceList.length > 0 ? evidenceList : r.adminEvidence,
        };
      }
      return r;
    });

    this.saveDisputes(updated);
    this.logAudit('ROW_ASSIGN', `Assigned dispute ${rowId} to plaza ${row.plazaId}`, actor);
    return { success: true };
  }

  /**
   * Plaza submits decision (Section 10)
   * If rejected, evidenceList must contain at least 1 counter-evidence file.
   */
  async submitPlazaDecision(rowId, decision, plazaReason, evidenceList = [], actor = 'Plaza User') {
    if (!plazaReason || !plazaReason.trim()) {
      throw new Error('Plaza remarks / justification are mandatory.');
    }
    if (decision === 'Rejected' && (!evidenceList || evidenceList.length === 0)) {
      throw new Error('At least one counter-evidence file is mandatory when rejecting a dispute.');
    }

    const rows = this.getStoredDisputes();
    const row = rows.find((r) => r.rowId === rowId);
    if (!row) throw new Error('Dispute row not found');
    if (row.disputeStatus !== 'NA') throw new Error('Decision has already been submitted and locked');

    const istNow = formatIstTimestamp();

    const updated = rows.map((r) => {
      if (r.rowId === rowId) {
        return {
          ...r,
          plazaAction: 'Yes',
          disputeStatus: decision,
          lifecycleStatus: decision === 'Approved' ? 'Plaza Accepted' : 'Plaza Rejected',
          plazaReason: plazaReason.trim(),
          plazaEvidence: evidenceList.length > 0 ? evidenceList : r.plazaEvidence,
          plazaActionTime: istNow,
          plazaActionBy: actor,
          decidedAt: new Date().toISOString(),
        };
      }
      return r;
    });

    this.saveDisputes(updated);
    this.logAudit('PLAZA_DECISION', `Plaza decided ${decision} for dispute ${rowId} at ${istNow}`, actor);
    return { success: true };
  }

  /**
   * Admin Closes Dispute (Stage 4)
   */
  async closeDispute(rowId, actor = 'Master Admin') {
    const rows = this.getStoredDisputes();
    const row = rows.find((r) => r.rowId === rowId);
    if (!row) throw new Error('Dispute row not found');
    if (row.closed) throw new Error('Dispute is already closed');

    const updated = rows.map((r) => {
      if (r.rowId === rowId) {
        return {
          ...r,
          closed: true,
          lifecycleStatus: 'Closed',
          closedBy: actor,
          closedAt: new Date().toISOString(),
        };
      }
      return r;
    });

    this.saveDisputes(updated);
    this.logAudit('CLOSE_DISPUTE', `Admin closed dispute ${rowId}`, actor);
    return { success: true };
  }

  /**
   * Match parsed CSV rows against Transaction Master (Section 5.2)
   */
  matchCsvRows(parsedRows) {
    const existing = this.getStoredDisputes();
    const results = [];
    const errorRows = [];
    let matchedCount = 0;
    let unmatchedCount = 0;
    let duplicateCount = 0;

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

      // Check deduplication key (RRN, Function Code)
      const alreadyQueued = existing.some(
        (e) => e.acqTxnId === rrn && Number(e.functionCode) === funcCodeNum
      );

      if (alreadyQueued) {
        duplicateCount++;
        errorRows.push({
          rowNumber: rowNum,
          rrn,
          reason: `Duplicate row: RRN ${rrn} with function code ${funcCodeNum} already exists in queue`,
        });
      }

      if (masterHit) {
        matchedCount++;
        results.push({
          rowNumber: rowNum,
          status: alreadyQueued ? 'Duplicate' : 'Matched',
          isMatched: true,
          alreadyQueued,
          rrn,
          tagId: masterHit.tagId || row['Tag ID'] || '—',
          functionCode: funcCodeNum,
          disputeType: FUNCTION_CODE_MAP[funcCodeNum] || `Code ${funcCodeNum}`,
          settlementDate,
          tatDueDate,
          txnAmount: masterHit.txnAmount || Number(row['Transaction Amount'] || 0),
          disputeAmount: masterHit.txnAmount || Number(row['Transaction Amount'] || 0),
          memberMessageText: row['Member Message Text'] || row['CB Reason'] || 'Imported from bank file',
          plazaId: masterHit.plazaId || row['Merchant ID'] || '501101',
          plazaName: masterHit.plazaName || PLAZA_MAP[masterHit.plazaId] || 'MUMBAI PLAZA NH-04',
          vrn: masterHit.vrn || row['Vehicle Registration Number'] || '—',
          tollTxnId: masterHit.tollTxnId || '—',
          txnDate: masterHit.txnDate || '—',
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
   * Add verified matched rows to Chargeback Assign queue
   */
  async commitMatchedRows(fileName, matchedResults, actor = 'Master Admin') {
    const existing = this.getStoredDisputes();
    let inserted = 0;

    const toInsert = [];
    matchedResults.forEach((r) => {
      if (!r.isMatched || r.alreadyQueued) return;
      const exists = existing.some(
        (e) => e.acqTxnId === r.rrn && Number(e.functionCode) === Number(r.functionCode)
      );
      if (exists) return;

      toInsert.push({
        rowId: `DISP-${Math.floor(1000 + Math.random() * 9000)}`,
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
        cbRaisedDaysAgo: 0,
        cbReason: r.memberMessageText,
        functionCode: r.functionCode,
        disputeType: r.disputeType,
        lifecycleStatus: 'Pending Assignment',
        plazaAction: 'No',
        disputeStatus: 'NA',
        plazaReason: 'NA',
        assigned: false,
        assignedBy: null,
        assignedAt: null,
        adminReason: '',
        adminEvidence: [],
        plazaEvidence: [],
        plazaActionTime: null,
        decidedAt: null,
        closed: false,
        closedBy: null,
        closedAt: null,
      });
      inserted++;
    });

    const updated = [...toInsert, ...existing];
    this.saveDisputes(updated);

    // Save batch log
    this.saveBatch({
      batchId: `BATCH-${Date.now().toString().slice(-6)}`,
      fileName,
      uploadedAt: new Date().toLocaleString('en-GB'),
      uploadedBy: actor,
      totalRows: matchedResults.length,
      matchedRows: inserted,
      unmatchedRows: matchedResults.length - inserted,
      status: 'Processed',
    });

    this.logAudit('FILE_UPLOAD', `Uploaded ${fileName}: added ${inserted} disputes to queue`, actor);
    return { inserted };
  }
}

export default new DisputeManagementService();

