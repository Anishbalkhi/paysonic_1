import {
  FUNCTION_CODE_MAP,
  PLAZA_MAP,
  DEFAULT_PLAZAS,
  TRANSACTION_MASTER,
  DEFAULT_TAT_DAYS,
} from '../../config/disputeConstants';
import httpClient from '../api/httpClient';
import OnboardingService from '../onboarding/OnboardingService';

const STORAGE_KEY_DISPUTES = 'paysonic_disputes_v1';
const STORAGE_KEY_BATCHES = 'paysonic_dispute_batches_v1';
const STORAGE_KEY_AUDIT = 'paysonic_dispute_audit_v1';

const INITIAL_SEED_ROWS = [
  {
    rowId: 'DISP-1001',
    acqTxnId: '102047735808524718',
    tollTxnId: 'AM020905',
    vrn: 'MH12VL3467',
    tagId: '34161FA820328EB002947820',
    plazaId: '501101',
    plazaName: 'MUMBAI PLAZA NH-04',
    txnDate: '02-09-2026 05:30:00',
    txnAmount: 5.0,
    disputeAmount: 80.0,
    cbRaisedDate: '27-09-2026',
    cbRaisedDaysAgo: 6,
    cbReason: 'Testing 04',
    functionCode: 450,
    disputeType: 'Debit Chargeback Raised',
    plazaAction: 'No',
    disputeStatus: 'NA',
    plazaReason: 'NA',
    assigned: false,
    adminReason: '',
    adminEvidence: [],
    plazaEvidence: [],
    decidedAt: null,
  },
  {
    rowId: 'DISP-1002',
    acqTxnId: '102047735808524720',
    tollTxnId: 'AM020906',
    vrn: 'MH12VL3467',
    tagId: '34161FA820328EB002947820',
    plazaId: '502202',
    plazaName: 'PUNE BYPASS PLAZA',
    txnDate: '02-09-2026 06:30:00',
    txnAmount: 5.0,
    disputeAmount: 80.0,
    cbRaisedDate: '28-09-2026',
    cbRaisedDaysAgo: 5,
    cbReason: 'Testing 05',
    functionCode: 450,
    disputeType: 'Debit Chargeback Raised',
    plazaAction: 'No',
    disputeStatus: 'NA',
    plazaReason: 'NA',
    assigned: false,
    adminReason: '',
    adminEvidence: [],
    plazaEvidence: [],
    decidedAt: null,
  },
  {
    rowId: 'DISP-1003',
    acqTxnId: '102047735808524714',
    tollTxnId: 'AM020903',
    vrn: 'MH12VL3467',
    tagId: '34161FA820328EB002947820',
    plazaId: '503303',
    plazaName: 'NASHIK TOLL PLAZA',
    txnDate: '02-09-2026 03:30:00',
    txnAmount: 5.0,
    disputeAmount: 80.0,
    cbRaisedDate: '02-09-2026',
    cbRaisedDaysAgo: 1,
    cbReason: 'Testing 02',
    functionCode: 450,
    disputeType: 'Debit Chargeback Raised',
    plazaAction: 'Yes',
    disputeStatus: 'Approved',
    plazaReason: 'Valid toll transaction fee refunded.',
    assigned: true,
    adminReason: 'Reviewed and assigned for plaza verification.',
    adminEvidence: ['dispute_proof_scan.pdf'],
    plazaEvidence: ['plaza_cctv_snapshot.jpg'],
    decidedAt: '2026-10-05T09:15:00Z',
  },
  {
    rowId: 'DISP-1004',
    acqTxnId: '102047735808524716',
    tollTxnId: 'AM020904',
    vrn: 'MH12VL3467',
    tagId: '34161FA820328EB002947820',
    plazaId: '504404',
    plazaName: 'KOLHAPUR PLAZA',
    txnDate: '02-09-2026 04:30:00',
    txnAmount: 5.0,
    disputeAmount: 80.0,
    cbRaisedDate: '02-09-2026',
    cbRaisedDaysAgo: 1,
    cbReason: 'Testing 03',
    functionCode: 450,
    disputeType: 'Debit Chargeback Raised',
    plazaAction: 'Yes',
    disputeStatus: 'Rejected',
    plazaReason: 'Vehicle physically passed through lane 2.',
    assigned: true,
    adminReason: 'Reviewed and assigned for plaza verification.',
    adminEvidence: ['dispute_proof_scan.pdf'],
    plazaEvidence: ['plaza_anpr_camera.jpg'],
    decidedAt: '2026-10-05T09:20:00Z',
  },
  {
    rowId: 'DISP-1005',
    acqTxnId: '102047735808524712',
    tollTxnId: 'AM020902',
    vrn: 'MH12VL3467',
    tagId: '34161FA820328EB002947820',
    plazaId: '505505',
    plazaName: 'SOLAPUR PLAZA NH-65',
    txnDate: '02-09-2026 02:30:00',
    txnAmount: 5.0,
    disputeAmount: 80.0,
    cbRaisedDate: '02-09-2026',
    cbRaisedDaysAgo: 1,
    cbReason: 'Testing 01',
    functionCode: 450,
    disputeType: 'Debit Chargeback Raised',
    plazaAction: 'Yes',
    disputeStatus: 'Approved',
    plazaReason: 'NA',
    assigned: true,
    adminReason: 'Assigned for immediate plaza audit.',
    adminEvidence: ['bank_intimation.pdf'],
    plazaEvidence: [],
    decidedAt: '2026-10-04T14:10:00Z',
  },
  {
    rowId: 'DISP-1006',
    acqTxnId: '102047735808524722',
    tollTxnId: 'AM020907',
    vrn: 'MH12VL3467',
    tagId: '34161FA820328EB002947820',
    plazaId: '908895',
    plazaName: 'JAIPUR',
    txnDate: '02-09-2026 07:30:00',
    txnAmount: 5.0,
    disputeAmount: 80.0,
    cbRaisedDate: '02-09-2026',
    cbRaisedDaysAgo: 1,
    cbReason: 'Testing 06',
    functionCode: 450,
    disputeType: 'Debit Chargeback Raised',
    plazaAction: 'Yes',
    disputeStatus: 'Rejected',
    plazaReason: 'Automatic toll boom opened and lane barrier sensor triggered.',
    assigned: true,
    adminReason: 'Assigned for evidence check.',
    adminEvidence: ['statement_copy.pdf'],
    plazaEvidence: ['lane_log_extract.txt'],
    decidedAt: '2026-10-04T16:45:00Z',
  },
  {
    rowId: 'DISP-1007',
    acqTxnId: '102047735808524706',
    tollTxnId: 'SK030902',
    vrn: '34MH51FA820',
    tagId: '34161FA82032866C03B7B640',
    plazaId: '787887',
    plazaName: 'JEET',
    txnDate: '03-09-2026 10:00:00',
    txnAmount: 25.0,
    disputeAmount: 25.0,
    cbRaisedDate: '03-09-2026',
    cbRaisedDaysAgo: 1,
    cbReason: 'Chargeback raised for extra debited amount',
    functionCode: 450,
    disputeType: 'Debit Chargeback Raised',
    plazaAction: 'Yes',
    disputeStatus: 'Rejected',
    plazaReason: 'Dummy Testing',
    assigned: true,
    adminReason: 'Verify if multiple debits occurred.',
    adminEvidence: ['customer_complaint.pdf'],
    plazaEvidence: ['avc_classification_report.pdf'],
    decidedAt: '2026-10-05T08:00:00Z',
  },
  {
    rowId: 'DISP-1008',
    acqTxnId: '102047735808524702',
    tollTxnId: 'ZP030902',
    vrn: 'GH92DD6152',
    tagId: '34161FA82033E8260213B680',
    plazaId: '787878',
    plazaName: 'PLAZA 1',
    txnDate: '02-09-2026 02:00:00',
    txnAmount: 5.0,
    disputeAmount: 5.0,
    cbRaisedDate: '26-09-2026',
    cbRaisedDaysAgo: 7,
    cbReason: 'Pre Arb',
    functionCode: 471,
    disputeType: 'Pre-Arbitration Raised',
    plazaAction: 'No',
    disputeStatus: 'NA',
    plazaReason: 'NA',
    assigned: false,
    adminReason: '',
    adminEvidence: [],
    plazaEvidence: [],
    decidedAt: null,
  },
  {
    rowId: 'DISP-1009',
    acqTxnId: '102047735808524700',
    tollTxnId: 'ZP030901',
    vrn: 'GH92DD6152',
    tagId: '34161FA82033E8260213B680',
    plazaId: '121212',
    plazaName: 'OCTOBER',
    txnDate: '02-09-2026 01:00:00',
    txnAmount: 5.0,
    disputeAmount: 5.0,
    cbRaisedDate: '02-09-2026',
    cbRaisedDaysAgo: 1,
    cbReason: 'Goodfaith',
    functionCode: 680,
    disputeType: 'Goodfaith Raised',
    plazaAction: 'No',
    disputeStatus: 'NA',
    plazaReason: 'NA',
    assigned: false,
    adminReason: '',
    adminEvidence: [],
    plazaEvidence: [],
    decidedAt: null,
  },
  {
    rowId: 'DISP-1010',
    acqTxnId: '102047735808524702',
    tollTxnId: 'ZP030902',
    vrn: 'GH92DD6152',
    tagId: '34161FA82033E8260213B680',
    plazaId: '111111',
    plazaName: 'PAY PAY 1',
    txnDate: '02-09-2026 02:00:00',
    txnAmount: 5.0,
    disputeAmount: 5.0,
    cbRaisedDate: '02-09-2026',
    cbRaisedDaysAgo: 1,
    cbReason: 'Arbitration',
    functionCode: 479,
    disputeType: 'Arbitration Raised',
    plazaAction: 'No',
    disputeStatus: 'NA',
    plazaReason: 'NA',
    assigned: false,
    adminReason: '',
    adminEvidence: [],
    plazaEvidence: [],
    decidedAt: null,
  },
  {
    rowId: 'DISP-1011',
    acqTxnId: '102047735808524698',
    tollTxnId: 'ZP020929',
    vrn: 'GH92DD6152',
    tagId: '34161FA82032866C020F7D20',
    plazaId: '161616',
    plazaName: 'ARCON',
    txnDate: '02-09-2026 11:00:00',
    txnAmount: 80.0,
    disputeAmount: 80.0,
    cbRaisedDate: '02-09-2026',
    cbRaisedDaysAgo: 2,
    cbReason: 'Arbitration',
    functionCode: 479,
    disputeType: 'Arbitration Raised',
    plazaAction: 'No',
    disputeStatus: 'NA',
    plazaReason: 'NA',
    assigned: false,
    adminReason: '',
    adminEvidence: [],
    plazaEvidence: [],
    decidedAt: null,
  },
  {
    rowId: 'DISP-1012',
    acqTxnId: '102047735808524696',
    tollTxnId: 'ZP020928',
    vrn: 'GH92DD6152',
    tagId: '34161FA82032866C020F7D20',
    plazaId: '745643',
    plazaName: 'ERHSHR',
    txnDate: '02-09-2026 10:00:00',
    txnAmount: 80.0,
    disputeAmount: 80.0,
    cbRaisedDate: '02-09-2026',
    cbRaisedDaysAgo: 2,
    cbReason: 'Testing CB',
    functionCode: 450,
    disputeType: 'Debit Chargeback Raised',
    plazaAction: 'No',
    disputeStatus: 'NA',
    plazaReason: 'NA',
    assigned: false,
    adminReason: '',
    adminEvidence: [],
    plazaEvidence: [],
    decidedAt: null,
  },
];

class DisputeManagementService {
  constructor() {
    this.initStore();
  }

  initStore() {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY_DISPUTES);
      if (!raw) {
        localStorage.setItem(STORAGE_KEY_DISPUTES, JSON.stringify(INITIAL_SEED_ROWS));
      } else {
        // Automatically migrate any legacy prototype records if found
        this.migrateLegacyDisputes(JSON.parse(raw));
      }
      const rawBatches = localStorage.getItem(STORAGE_KEY_BATCHES);
      if (!rawBatches) {
        const seedBatches = [
          {
            batchId: 'BATCH-2026-0901',
            fileName: '011IBKL2590002223106.csv',
            uploadedAt: '01-09-2026 14:22:10',
            uploadedBy: 'Master Admin',
            totalRows: 6,
            matchedRows: 5,
            unmatchedRows: 1,
            status: 'Processed',
          },
        ];
        localStorage.setItem(STORAGE_KEY_BATCHES, JSON.stringify(seedBatches));
      }
    } catch (e) {
      console.warn('[DisputeManagementService] Store init warning:', e);
    }
  }

  migrateLegacyDisputes(rows, customPool = null) {
    if (!Array.isArray(rows)) return INITIAL_SEED_ROWS;
    let modified = false;

    // Dynamically retrieve realtime onboarded plazas from OnboardingService
    const onboardedList = (Array.isArray(customPool) && customPool.length > 0)
      ? customPool
      : (OnboardingService.getCachedPlazas()?.length > 0
          ? OnboardingService.getCachedPlazas()
          : DEFAULT_PLAZAS);

    const validPlazas = onboardedList.filter((p) => {
      const id = String(p.id || p.plazaId || '').trim();
      const name = (p.name || p.plazaName || '').trim().toLowerCase();
      return id && id !== '600601' && id !== '600602' && id !== '778999' && id !== '778899' && !name.includes('dummy') && name !== 'gluten';
    });

    const activePool = validPlazas.length > 0 ? validPlazas : DEFAULT_PLAZAS;
    const validIdSet = new Set(activePool.map((p) => String(p.id || p.plazaId)));

    const updated = rows.map((r, idx) => {
      const pId = String(r.plazaId || '').trim();
      const pName = (r.plazaName || '').trim();
      const pNameLower = pName.toLowerCase();

      const isLegacy =
        !pName ||
        !pId ||
        pNameLower.includes('dummy') ||
        pNameLower === 'gluten' ||
        pId === '600601' ||
        pId === '600602' ||
        pId === '778899' ||
        pId === '778999' ||
        !validIdSet.has(pId);

      if (isLegacy) {
        modified = true;
        const target = activePool[idx % activePool.length];
        const tid = String(target.id || target.plazaId);
        const tname = target.name || target.plazaName || `Plaza ${tid}`;
        return {
          ...r,
          plazaId: tid,
          plazaName: tname,
        };
      }
      return r;
    });

    if (modified) {
      try {
        localStorage.setItem(STORAGE_KEY_DISPUTES, JSON.stringify(updated));
      } catch (e) {
        console.warn('[DisputeManagementService] Migration save warning:', e);
      }
    }
    return updated;
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

  getStoredDisputes(overridePool = null) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_DISPUTES);
      const parsed = raw ? JSON.parse(raw) : INITIAL_SEED_ROWS;
      return this.migrateLegacyDisputes(parsed, overridePool);
    } catch {
      return INITIAL_SEED_ROWS;
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

  logAudit(action, details) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_AUDIT);
      const list = raw ? JSON.parse(raw) : [];
      list.unshift({
        id: `AUDIT-${Date.now()}`,
        action,
        details,
        timestamp: new Date().toISOString(),
        actor: localStorage.getItem('actorId') || 'Master Admin',
      });
      localStorage.setItem(STORAGE_KEY_AUDIT, JSON.stringify(list.slice(0, 100)));
    } catch (e) {
      console.warn('[DisputeManagementService] Audit error:', e);
    }
  }

  computeDaysLeft(row) {
    const daysAgo = row.cbRaisedDaysAgo ?? 1;
    return DEFAULT_TAT_DAYS - daysAgo;
  }

  getTatBadge(row) {
    if (row.assigned && row.disputeStatus !== 'NA') {
      return { status: 'closed', label: 'Closed', colorClass: 'badge-gray' };
    }
    const daysLeft = this.computeDaysLeft(row);
    if (daysLeft <= 0) {
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
    let livePlazas = [];
    try {
      livePlazas = await OnboardingService.getPlazas();
    } catch {
      livePlazas = OnboardingService.getCachedPlazas();
    }
    let rows = this.getStoredDisputes(livePlazas);

    // Plaza scope filter if user is Plaza role
    if (filters.scopedPlazaId) {
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
      } else if (filters.assignStatus === 'Unassigned' || filters.assignStatus === 'UnAssigned') {
        rows = rows.filter((r) => r.assigned === false);
      }
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
    let livePlazas = [];
    try {
      livePlazas = await OnboardingService.getPlazas();
    } catch {
      livePlazas = OnboardingService.getCachedPlazas();
    }
    const rows = this.getStoredDisputes(livePlazas);
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
    const plazaRows = plazaId
      ? all.filter((r) => String(r.plazaId) === String(plazaId))
      : all;

    const openRows = plazaRows.filter((r) => r.disputeStatus === 'NA');
    const closedRows = plazaRows.filter((r) => r.disputeStatus !== 'NA');

    const openValue = openRows.reduce((acc, r) => acc + Number(r.disputeAmount || 0), 0);
    const closedValue = closedRows.reduce((acc, r) => acc + Number(r.disputeAmount || 0), 0);
    const totalValue = openValue + closedValue;

    const approvedCount = plazaRows.filter((r) => r.disputeStatus === 'Approved').length;
    const rejectedCount = plazaRows.filter((r) => r.disputeStatus === 'Rejected').length;

    // TAT Warning Items
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
  async bulkAssignPlazas(selectedPlazaIds, defaultReason = 'Bulk-assigned for plaza review') {
    const rows = this.getStoredDisputes();
    let updatedCount = 0;

    const newRows = rows.map((r) => {
      if (selectedPlazaIds.includes(String(r.plazaId)) && !r.assigned) {
        updatedCount++;
        return {
          ...r,
          assigned: true,
          adminReason: r.adminReason || defaultReason,
        };
      }
      return r;
    });

    this.saveDisputes(newRows);
    this.logAudit('BULK_ASSIGN', `Assigned ${updatedCount} rows for plazas: ${selectedPlazaIds.join(', ')}`);
    return { updatedCount };
  }

  /**
   * Bulk unassign selected plazas (Section 6.4)
   */
  async bulkUnassignPlazas(selectedPlazaIds) {
    const rows = this.getStoredDisputes();
    let updatedCount = 0;

    const newRows = rows.map((r) => {
      if (
        selectedPlazaIds.includes(String(r.plazaId)) &&
        r.assigned &&
        r.disputeStatus === 'NA'
      ) {
        updatedCount++;
        return {
          ...r,
          assigned: false,
        };
      }
      return r;
    });

    this.saveDisputes(newRows);
    this.logAudit('BULK_UNASSIGN', `Unassigned ${updatedCount} open rows for plazas: ${selectedPlazaIds.join(', ')}`);
    return { updatedCount };
  }

  /**
   * Assign a single row with admin evidence and reason (Section 7.2)
   */
  async assignRow(rowId, adminReason, evidenceList = []) {
    const rows = this.getStoredDisputes();
    const row = rows.find((r) => r.rowId === rowId);
    if (!row) throw new Error('Dispute row not found');
    if (row.assigned) throw new Error('Row is already assigned (locked for audit)');

    const updated = rows.map((r) => {
      if (r.rowId === rowId) {
        return {
          ...r,
          assigned: true,
          adminReason,
          adminEvidence: evidenceList.length > 0 ? evidenceList : r.adminEvidence,
        };
      }
      return r;
    });

    this.saveDisputes(updated);
    this.logAudit('ROW_ASSIGN', `Assigned dispute ${rowId} to plaza ${row.plazaId}`);
    return { success: true };
  }

  /**
   * Plaza submits decision (Section 10)
   */
  async submitPlazaDecision(rowId, decision, plazaReason, evidenceList = []) {
    const rows = this.getStoredDisputes();
    const row = rows.find((r) => r.rowId === rowId);
    if (!row) throw new Error('Dispute row not found');
    if (row.disputeStatus !== 'NA') throw new Error('Decision has already been submitted and locked');

    const updated = rows.map((r) => {
      if (r.rowId === rowId) {
        return {
          ...r,
          plazaAction: 'Yes',
          disputeStatus: decision,
          plazaReason,
          plazaEvidence: evidenceList.length > 0 ? evidenceList : r.plazaEvidence,
          decidedAt: new Date().toISOString(),
        };
      }
      return r;
    });

    this.saveDisputes(updated);
    this.logAudit('PLAZA_DECISION', `Plaza decided ${decision} for dispute ${rowId}`);
    return { success: true };
  }

  /**
   * Match parsed CSV rows against Transaction Master (Section 5.2)
   */
  matchCsvRows(parsedRows) {
    const existing = this.getStoredDisputes();
    const results = [];
    let matchedCount = 0;
    let unmatchedCount = 0;

    parsedRows.forEach((row) => {
      const rrn = (row['RRN'] || row['rrn'] || '').trim();
      const funcCodeNum = Number(row['Function Code'] || row['functionCode'] || 450);
      const masterHit = TRANSACTION_MASTER[rrn];

      // Check deduplication key (RRN, Function Code)
      const alreadyQueued = existing.some(
        (e) => e.acqTxnId === rrn && Number(e.functionCode) === funcCodeNum
      );

      if (masterHit) {
        matchedCount++;
        results.push({
          status: alreadyQueued ? 'Duplicate' : 'Matched',
          isMatched: true,
          alreadyQueued,
          rrn,
          tagId: masterHit.tagId || row['Tag ID'] || '—',
          functionCode: funcCodeNum,
          disputeType: FUNCTION_CODE_MAP[funcCodeNum] || `Code ${funcCodeNum}`,
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
        results.push({
          status: 'Unmatched',
          isMatched: false,
          alreadyQueued: false,
          rrn,
          tagId: row['Tag ID'] || '—',
          functionCode: funcCodeNum,
          disputeType: FUNCTION_CODE_MAP[funcCodeNum] || `Code ${funcCodeNum}`,
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
      results,
    };
  }

  /**
   * Add verified matched rows to Chargeback Assign queue
   */
  async commitMatchedRows(fileName, matchedResults) {
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
        txnAmount: r.txnAmount,
        disputeAmount: r.disputeAmount,
        cbRaisedDate: new Date().toLocaleDateString('en-GB').replace(/\//g, '-'),
        cbRaisedDaysAgo: 0,
        cbReason: r.memberMessageText,
        functionCode: r.functionCode,
        disputeType: r.disputeType,
        plazaAction: 'No',
        disputeStatus: 'NA',
        plazaReason: 'NA',
        assigned: false,
        adminReason: '',
        adminEvidence: [],
        plazaEvidence: [],
        decidedAt: null,
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
      uploadedBy: localStorage.getItem('actorId') || 'Master Admin',
      totalRows: matchedResults.length,
      matchedRows: inserted,
      unmatchedRows: matchedResults.length - inserted,
      status: 'Processed',
    });

    this.logAudit('FILE_UPLOAD', `Uploaded ${fileName}: added ${inserted} disputes`);
    return { inserted };
  }
}

export default new DisputeManagementService();
