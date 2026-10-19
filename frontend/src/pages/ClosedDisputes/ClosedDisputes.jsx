import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { FUNCTION_CODES, PLAZA_MAP } from '../../config/disputeConstants';
import DisputeManagementService from '../../services/dispute/DisputeManagementService';
import useOnboardedPlazas from '../../hooks/useOnboardedPlazas';
import { filterRecordsByPlazaScope } from '../../utils/plazaScopeUtils';
import TransactionDetailsModal from '../../components/DisputeModals/TransactionDetailsModal';
import EvidencePreviewModal from '../../components/DisputeModals/EvidencePreviewModal';
import TablePagination from '../../components/common/TablePagination';
import { formatFetchTime } from '../../utils/dateUtils';
import evidenceStorage from '../../services/dispute/evidenceStorage';
import './ClosedDisputes.scss';

export const ClosedDisputes = () => {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'Master Admin';
  const { plazas, isPlazaLocked, defaultPlazaId, assignedPlaza } = useOnboardedPlazas();
  const isPlazaUser = Boolean(
    isPlazaLocked ||
    currentUser?.plazaId ||
    (currentUser?.role && currentUser.role.toLowerCase().includes('plaza')) ||
    (!isAdmin && currentUser?.role !== 'Bank')
  );

  const [selectedPlazaId, setSelectedPlazaId] = useState(
    isPlazaLocked ? (defaultPlazaId || 'ALL') : (currentUser?.plazaId || 'ALL')
  );

  useEffect(() => {
    if (isPlazaLocked && defaultPlazaId && selectedPlazaId !== defaultPlazaId) {
      setSelectedPlazaId(defaultPlazaId);
    }
  }, [isPlazaLocked, defaultPlazaId, selectedPlazaId]);

  const activePlazaId = isPlazaLocked ? (defaultPlazaId || selectedPlazaId) : (selectedPlazaId || 'ALL');

  // Search criteria state
  const [fromDate, setFromDate] = useState('2026-09-01');
  const [toDate, setToDate] = useState('2026-10-31');
  const [dateType, setDateType] = useState('Plaza Action Date');
  const [functionCode, setFunctionCode] = useState('');
  const [decisionFilter, setDecisionFilter] = useState('ALL'); // ALL | Approved | Rejected
  const [acqTxnId, setAcqTxnId] = useState('');
  const [tollTxnId, setTollTxnId] = useState('');
  const [tagId, setTagId] = useState('');

  // Pagination & rows
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [fetchTime, setFetchTime] = useState('');

  // Modals state
  const [detailsModalRow, setDetailsModalRow] = useState(null);
  const [evidenceModalData, setEvidenceModalData] = useState(null); // { isOpen, row, fileList, source }

  // Sorting state
  const [sortConfig, setSortConfig] = useState({ field: 'actionDate', direction: 'desc' });

  const loadData = useCallback(async (overrides = {}) => {
    try {
      setLoading(true);
      const fDate = overrides.fromDate !== undefined ? overrides.fromDate : fromDate;
      const tDate = overrides.toDate !== undefined ? overrides.toDate : toDate;
      const dType = overrides.dateType !== undefined ? overrides.dateType : dateType;
      const fCode = overrides.functionCode !== undefined ? overrides.functionCode : functionCode;
      const decFilter = overrides.decisionFilter !== undefined ? overrides.decisionFilter : decisionFilter;
      const aTxn = (overrides.acqTxnId !== undefined ? overrides.acqTxnId : acqTxnId).trim().toLowerCase();
      const tTxn = (overrides.tollTxnId !== undefined ? overrides.tollTxnId : tollTxnId).trim().toLowerCase();
      const tTag = (overrides.tagId !== undefined ? overrides.tagId : tagId).trim().toLowerCase();
      const pId = overrides.plazaId !== undefined ? overrides.plazaId : activePlazaId;

      // Fetch all stored disputes
      const allDisputes = DisputeManagementService.getStoredDisputes();

      // Filter for ACTION TAKEN / CLOSED disputes only
      let actionedRows = allDisputes.filter((r) => {
        const isActionTaken =
          r.plazaAction === 'Yes' ||
          r.disputeStatus === 'Approved' ||
          r.disputeStatus === 'Rejected' ||
          r.closed === true;
        return isActionTaken;
      });

      // Filter by Plaza
      if (pId && pId !== 'ALL') {
        actionedRows = actionedRows.filter((r) => String(r.plazaId || '').trim() === String(pId).trim());
      }

      // Filter by Function Code
      if (fCode && fCode !== 'ALL') {
        actionedRows = actionedRows.filter((r) => String(r.functionCode) === String(fCode));
      }

      // Filter by Plaza Decision
      if (decFilter && decFilter !== 'ALL') {
        if (decFilter === 'Approved') {
          actionedRows = actionedRows.filter((r) => r.disputeStatus === 'Approved');
        } else if (decFilter === 'Rejected') {
          actionedRows = actionedRows.filter((r) => r.disputeStatus === 'Rejected');
        }
      }

      // Filter by IDs
      if (aTxn) {
        actionedRows = actionedRows.filter((r) => String(r.acqTxnId || '').toLowerCase().includes(aTxn));
      }
      if (tTxn) {
        actionedRows = actionedRows.filter((r) => String(r.tollTxnId || '').toLowerCase().includes(tTxn));
      }
      if (tTag) {
        actionedRows = actionedRows.filter((r) => String(r.tagId || '').toLowerCase().includes(tTag));
      }

      // Multi-tenant plaza scoping (strict for Plaza User)
      const scopedRows = filterRecordsByPlazaScope(actionedRows, plazas, currentUser);

      setRows(scopedRows);
      setFetchTime(formatFetchTime(new Date()));
      setCurrentPage(1);
    } catch (err) {
      console.error('[ClosedDisputes] Load error:', err);
    } finally {
      setLoading(false);
    }
  }, [activePlazaId, fromDate, toDate, dateType, functionCode, decisionFilter, acqTxnId, tollTxnId, tagId, plazas, currentUser]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Real-time synchronization
  useEffect(() => {
    const handleSync = () => loadData();
    window.addEventListener('paysonic:disputes_updated', handleSync);
    window.addEventListener('storage', handleSync);
    let bc;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel('paysonic_disputes_channel');
        bc.onmessage = () => loadData();
      } catch {}
    }
    return () => {
      window.removeEventListener('paysonic:disputes_updated', handleSync);
      window.removeEventListener('storage', handleSync);
      if (bc) bc.close();
    };
  }, [loadData]);

  const handleReset = () => {
    setFromDate('2026-09-01');
    setToDate('2026-10-31');
    setDateType('Plaza Action Date');
    setFunctionCode('');
    setDecisionFilter('ALL');
    setAcqTxnId('');
    setTollTxnId('');
    setTagId('');
    if (!isPlazaLocked) {
      setSelectedPlazaId('ALL');
    }
    setCurrentPage(1);
    loadData({
      fromDate: '2026-09-01',
      toDate: '2026-10-31',
      dateType: 'Plaza Action Date',
      functionCode: '',
      decisionFilter: 'ALL',
      acqTxnId: '',
      tollTxnId: '',
      tagId: '',
      plazaId: isPlazaLocked ? defaultPlazaId : 'ALL',
    });
  };

  // KPI Calculations
  const kpiStats = useMemo(() => {
    const total = rows.length;
    const accepted = rows.filter((r) => r.disputeStatus === 'Approved').length;
    const rejected = rows.filter((r) => r.disputeStatus === 'Rejected').length;
    const totalDisputeAmt = rows.reduce((acc, r) => acc + Number(r.disputeAmount || 0), 0);
    const acceptedAmt = rows
      .filter((r) => r.disputeStatus === 'Approved')
      .reduce((acc, r) => acc + Number(r.disputeAmount || 0), 0);
    const rejectedAmt = rows
      .filter((r) => r.disputeStatus === 'Rejected')
      .reduce((acc, r) => acc + Number(r.disputeAmount || 0), 0);
    return {
      total,
      accepted,
      rejected,
      totalDisputeAmt,
      acceptedAmt,
      rejectedAmt,
    };
  }, [rows]);

  // Sorting
  const handleSort = (field) => {
    setSortConfig((prev) => {
      if (prev.field === field) {
        return { field, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { field, direction: 'desc' };
    });
  };

  const sortedRows = useMemo(() => {
    if (!Array.isArray(rows)) return [];
    if (!sortConfig.field) return rows;
    return [...rows].sort((a, b) => {
      if (sortConfig.field === 'actionDate') {
        const timeA = a.decidedAt ? new Date(a.decidedAt).getTime() : (a.plazaActionTime ? 1 : 0);
        const timeB = b.decidedAt ? new Date(b.decidedAt).getTime() : (b.plazaActionTime ? 1 : 0);
        return sortConfig.direction === 'asc' ? timeA - timeB : timeB - timeA;
      }
      if (sortConfig.field === 'disputeAmount') {
        const amtA = Number(a.disputeAmount || 0);
        const amtB = Number(b.disputeAmount || 0);
        return sortConfig.direction === 'asc' ? amtA - amtB : amtB - amtA;
      }
      return 0;
    });
  }, [rows, sortConfig]);

  const paginatedRows = useMemo(() => {
    const from = (currentPage - 1) * pageSize;
    return sortedRows.slice(from, from + pageSize);
  }, [sortedRows, currentPage, pageSize]);

  // Open Evidence Preview Modal
  const handleOpenEvidence = (row, source = 'counter') => {
    const cleanId = row.disputeId || row.rowId;
    let list = [];
    if (source === 'counter') {
      const stored = evidenceStorage.getPlazaEvidence(cleanId, row.acqTxnId);
      list = stored && stored.length > 0 ? stored : (row.counterEvidence || []);
    } else {
      const stored = evidenceStorage.getAdminEvidence(cleanId, row.acqTxnId);
      list = stored && stored.length > 0 ? stored : (row.adminEvidence || []);
    }
    setEvidenceModalData({
      isOpen: true,
      row,
      fileList: list,
      source: source === 'counter' ? 'Plaza Counter-Evidence' : 'Acquirer Evidence',
    });
  };

  // Export to CSV
  const handleExportCsv = () => {
    if (!rows || rows.length === 0) return;
    const fetchTimeStr = formatFetchTime(new Date());

    const headers = [
      'Plaza Action Status', 'Plaza Decision', 'Acq Txn ID', 'Toll Txn ID', 'VRN', 'Tag ID',
      'Toll Plaza Name', 'Toll Plaza ID', 'Txn Date', 'Dispute Raise Date', 'TAT Due Date',
      'CB Raised Date', 'Function Code', 'Dispute Type', 'Txn Amount (₹)', 'Dispute Amount (₹)',
      'Plaza Action Date & Time', 'Plaza Remarks / Justification', 'Admin Remarks / Reason', 'Plaza Evidence Count'
    ];

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const csvRows = rows.map((r) => {
      const cleanId = r.disputeId || r.rowId;
      const counterEv = evidenceStorage.getPlazaEvidence(cleanId, r.acqTxnId);
      const evCount = counterEv ? counterEv.length : (r.counterEvidence?.length || 0);
      return [
        r.plazaAction === 'Yes' ? 'Action Taken' : 'Closed',
        r.disputeStatus === 'Approved' ? 'Accepted' : r.disputeStatus === 'Rejected' ? 'Rejected' : r.disputeStatus,
        r.acqTxnId,
        r.tollTxnId,
        r.vrn,
        r.tagId,
        r.plazaName,
        r.plazaId,
        r.txnDate,
        r.settlementDate || '—',
        r.tatDueDate || '—',
        r.cbRaisedDate || '—',
        r.functionCode,
        r.disputeType,
        Number(r.txnAmount || 0).toFixed(2),
        Number(r.disputeAmount || 0).toFixed(2),
        r.decidedAt || r.plazaActionTime || '—',
        r.plazaReason || '—',
        r.adminReason || r.adminRemarks || '—',
        evCount
      ].map(escapeCsv).join(',');
    });

    const totDispute = rows.reduce((s, r) => s + Number(r.disputeAmount || 0), 0).toFixed(2);
    const bannerRows = [
      `"PAYSONIC DISPUTE & CHARGEBACK MANAGEMENT — CLOSED DISPUTES AUDIT REPORT"`,
      `"Export Time: ${fetchTimeStr}   |   Total Actioned Records: ${rows.length}   |   Cumulative Dispute Value: ₹ ${totDispute}"`,
      ''
    ];

    const csvContent = '\uFEFF' + [
      ...bannerRows,
      headers.map(escapeCsv).join(','),
      ...csvRows
    ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Closed_Disputes_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Export to Excel (.xls)
  const handleExportExcel = () => {
    if (!rows || rows.length === 0) return;
    const fetchTimeStr = formatFetchTime(new Date());

    const xmlEsc = (str) =>
      String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

    const headers = [
      'Plaza Decision', 'Acq Txn ID', 'Toll Txn ID', 'VRN', 'Tag ID',
      'Toll Plaza Name', 'Toll Plaza ID', 'Txn Date', 'Dispute Raise Date', 'TAT Due Date',
      'CB Raised Date', 'Function Code', 'Dispute Type', 'Txn Amount', 'Dispute Amount',
      'Plaza Action Date & Time', 'Plaza Remarks / Justification', 'Admin Remarks / Reason'
    ];

    let dataXml = '';
    let totalTxnAmt = 0;
    let totalDisputeAmt = 0;

    rows.forEach((r) => {
      const isAccepted = r.disputeStatus === 'Approved';
      const isRejected = r.disputeStatus === 'Rejected';
      const statusStyle = isAccepted ? 'sBadgeGreen' : isRejected ? 'sBadgeRed' : 'sBadgeGray';
      const tAmt = Number(r.txnAmount || 0);
      const dAmt = Number(r.disputeAmount || 0);
      totalTxnAmt += tAmt;
      totalDisputeAmt += dAmt;

      dataXml += `
      <Row ss:Height="22">
        <Cell ss:StyleID="${statusStyle}"><Data ss:Type="String">${xmlEsc(isAccepted ? 'Accepted' : isRejected ? 'Rejected' : r.disputeStatus)}</Data></Cell>
        <Cell ss:StyleID="sDataCenter"><Data ss:Type="String">${xmlEsc(r.acqTxnId)}</Data></Cell>
        <Cell ss:StyleID="sDataCenter"><Data ss:Type="String">${xmlEsc(r.tollTxnId)}</Data></Cell>
        <Cell ss:StyleID="sDataCenter"><Data ss:Type="String">${xmlEsc(r.vrn)}</Data></Cell>
        <Cell ss:StyleID="sDataCenter"><Data ss:Type="String">${xmlEsc(r.tagId)}</Data></Cell>
        <Cell ss:StyleID="sDataText"><Data ss:Type="String">${xmlEsc(r.plazaName)}</Data></Cell>
        <Cell ss:StyleID="sDataCenter"><Data ss:Type="String">${xmlEsc(r.plazaId)}</Data></Cell>
        <Cell ss:StyleID="sDataCenter"><Data ss:Type="String">${xmlEsc(r.txnDate)}</Data></Cell>
        <Cell ss:StyleID="sDataCenter"><Data ss:Type="String">${xmlEsc(r.settlementDate || '—')}</Data></Cell>
        <Cell ss:StyleID="sDataCenter"><Data ss:Type="String">${xmlEsc(r.tatDueDate || '—')}</Data></Cell>
        <Cell ss:StyleID="sDataCenter"><Data ss:Type="String">${xmlEsc(r.cbRaisedDate || '—')}</Data></Cell>
        <Cell ss:StyleID="sDataCenter"><Data ss:Type="Number">${Number(r.functionCode || 0)}</Data></Cell>
        <Cell ss:StyleID="sDataText"><Data ss:Type="String">${xmlEsc(r.disputeType)}</Data></Cell>
        <Cell ss:StyleID="sDataAmt"><Data ss:Type="Number">${tAmt}</Data></Cell>
        <Cell ss:StyleID="sDataAmt"><Data ss:Type="Number">${dAmt}</Data></Cell>
        <Cell ss:StyleID="sDataCenter"><Data ss:Type="String">${xmlEsc(r.decidedAt || r.plazaActionTime || '—')}</Data></Cell>
        <Cell ss:StyleID="sDataText"><Data ss:Type="String">${xmlEsc(r.plazaReason || '—')}</Data></Cell>
        <Cell ss:StyleID="sDataText"><Data ss:Type="String">${xmlEsc(r.adminReason || r.adminRemarks || '—')}</Data></Cell>
      </Row>`;
    });

    const headerXml = `
      <Row ss:Height="26">
        ${headers.map((h) => `<Cell ss:StyleID="sMainHeader"><Data ss:Type="String">${xmlEsc(h)}</Data></Cell>`).join('')}
      </Row>`;

    const totalXml = `
      <Row ss:Height="24">
        <Cell ss:StyleID="sTotalLabel"><Data ss:Type="String">TOTAL</Data></Cell>
        <Cell ss:StyleID="sTotalLabel"><Data ss:Type="String">Records: ${rows.length}</Data></Cell>
        ${Array(11).fill('<Cell ss:StyleID="sTotalLabel"><Data ss:Type="String"></Data></Cell>').join('')}
        <Cell ss:StyleID="sTotalAmt"><Data ss:Type="Number">${totalTxnAmt.toFixed(2)}</Data></Cell>
        <Cell ss:StyleID="sTotalAmt"><Data ss:Type="Number">${totalDisputeAmt.toFixed(2)}</Data></Cell>
        <Cell ss:StyleID="sTotalLabel"><Data ss:Type="String"></Data></Cell>
        <Cell ss:StyleID="sTotalLabel"><Data ss:Type="String"></Data></Cell>
        <Cell ss:StyleID="sTotalLabel"><Data ss:Type="String"></Data></Cell>
      </Row>`;

    const colSpan = headers.length - 1;

    const excelXml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Author>Paysonic Operations</Author>
 </DocumentProperties>
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Borders/>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#1E293B"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
  <Style ss:ID="sTitle">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="15" ss:Bold="1" ss:Color="#002060"/>
  </Style>
  <Style ss:ID="sSubtitle">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#64748B"/>
  </Style>
  <Style ss:ID="sMainHeader">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#002060" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="sDataCenter">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="9.5" ss:Color="#334155"/>
  </Style>
  <Style ss:ID="sDataText">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="9.5" ss:Color="#334155"/>
  </Style>
  <Style ss:ID="sDataAmt">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="9.5" ss:Bold="1" ss:Color="#0F172A"/>
   <NumberFormat ss:Format="#,##0.00"/>
  </Style>
  <Style ss:ID="sBadgeGreen">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="9.5" ss:Bold="1" ss:Color="#166534"/>
   <Interior ss:Color="#DCFCE7" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="sBadgeRed">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="9.5" ss:Bold="1" ss:Color="#991B1B"/>
   <Interior ss:Color="#FEE2E2" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="sBadgeGray">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="9.5" ss:Bold="1" ss:Color="#475569"/>
   <Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="sTotalLabel">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#002060"/>
   <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="sTotalAmt">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#002060"/>
   <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>
   <NumberFormat ss:Format="#,##0.00"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Closed Disputes">
  <Table ss:DefaultRowHeight="20">
   <Column ss:Width="110"/>
   <Column ss:Width="180"/>
   <Column ss:Width="140"/>
   <Column ss:Width="110"/>
   <Column ss:Width="190"/>
   <Column ss:Width="160"/>
   <Column ss:Width="90"/>
   <Column ss:Width="130"/>
   <Column ss:Width="110"/>
   <Column ss:Width="120"/>
   <Column ss:Width="110"/>
   <Column ss:Width="90"/>
   <Column ss:Width="120"/>
   <Column ss:Width="110"/>
   <Column ss:Width="110"/>
   <Column ss:Width="160"/>
   <Column ss:Width="180"/>
   <Column ss:Width="180"/>
   <Row ss:Height="30">
    <Cell ss:MergeAcross="${colSpan}" ss:StyleID="sTitle"><Data ss:Type="String">PAYSONIC DISPUTE MANAGEMENT — CLOSED DISPUTES QUEUE</Data></Cell>
   </Row>
   <Row ss:Height="20">
    <Cell ss:MergeAcross="${colSpan}" ss:StyleID="sSubtitle"><Data ss:Type="String">Export Time: ${xmlEsc(fetchTimeStr)}   |   Total Actioned Records: ${rows.length}   |   Cumulative Dispute Amount: ₹ ${totalDisputeAmt.toFixed(2)}</Data></Cell>
   </Row>
   ${headerXml}
   ${dataXml}
   ${totalXml}
  </Table>
 </Worksheet>
</Workbook>`;

    const blob = new Blob([excelXml], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Closed_Disputes_${Date.now()}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="closed-disputes-page">
      {/* 1. Header */}
      <div className="page-header-block">
        <div>
          <h1>Closed Disputes</h1>
          <p className="subtitle">
            {isPlazaUser
              ? `Action-taken dispute records for plaza ${assignedPlaza?.name || defaultPlazaId}. Includes accepted and rejected decisions with audit trails and counter-evidence.`
              : 'Complete repository of all action-taken disputes across plazas. Review verified plaza decisions, counter-evidence, and audit histories.'}
          </p>
        </div>
      </div>

      {/* 2. KPI Summary Cards */}
      <div className="closed-kpi-grid">
        <div className="closed-kpi-card total-card">
          <div className="kpi-icon">📋</div>
          <div className="kpi-body">
            <span className="kpi-label">Total Actioned Disputes</span>
            <span className="kpi-value">{kpiStats.total}</span>
            <span className="kpi-sub">₹ {kpiStats.totalDisputeAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>

        <div className="closed-kpi-card accepted-card">
          <div className="kpi-icon">✅</div>
          <div className="kpi-body">
            <span className="kpi-label">Accepted by Plaza</span>
            <span className="kpi-value text-green">{kpiStats.accepted}</span>
            <span className="kpi-sub">₹ {kpiStats.acceptedAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>

        <div className="closed-kpi-card rejected-card">
          <div className="kpi-icon">❌</div>
          <div className="kpi-body">
            <span className="kpi-label">Rejected by Plaza</span>
            <span className="kpi-value text-red">{kpiStats.rejected}</span>
            <span className="kpi-sub">₹ {kpiStats.rejectedAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      {/* 3. Search Criteria */}
      <div className="search-criteria-card">
        <div className="card-title">Search Criteria</div>
        <div className="filters-grid">
          <div className="field-box">
            <label htmlFor="cdPlazaSelect">Toll Plaza</label>
            <select
              id="cdPlazaSelect"
              value={selectedPlazaId}
              onChange={(e) => setSelectedPlazaId(e.target.value)}
              disabled={isPlazaLocked || Boolean(currentUser?.plazaId)}
              title={isPlazaLocked ? `Locked to assigned plaza: ${assignedPlaza?.name || defaultPlazaId}` : 'Select Toll Plaza'}
            >
              {!isPlazaLocked && !currentUser?.plazaId && <option value="ALL">All Plazas (ALL)</option>}
              {plazas.map((p) => (
                <option key={p.id} value={p.id}>
                  {isPlazaLocked ? `🔒 ${p.name || p.codeLabel} (${p.id}) (Assigned Plaza)` : `${p.name || p.codeLabel} (${p.id})`}
                </option>
              ))}
            </select>
          </div>

          <div className="field-box">
            <label htmlFor="cdFromDate">From Date</label>
            <input
              id="cdFromDate"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>

          <div className="field-box">
            <label htmlFor="cdToDate">To Date</label>
            <input
              id="cdToDate"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>

          <div className="field-box">
            <label htmlFor="cdDateType">Date Type</label>
            <select
              id="cdDateType"
              value={dateType}
              onChange={(e) => setDateType(e.target.value)}
            >
              <option value="Plaza Action Date">Plaza Action Date</option>
              <option value="Transaction Date">Transaction Date</option>
              <option value="CB Raised Date">CB Raised Date</option>
            </select>
          </div>

          <div className="field-box">
            <label htmlFor="cdDecisionSelect">Plaza Decision</label>
            <select
              id="cdDecisionSelect"
              value={decisionFilter}
              onChange={(e) => setDecisionFilter(e.target.value)}
            >
              <option value="ALL">All Decisions</option>
              <option value="Approved">Accepted (Approved)</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          <div className="field-box">
            <label htmlFor="cdFuncCode">Function Code</label>
            <select
              id="cdFuncCode"
              value={functionCode}
              onChange={(e) => setFunctionCode(e.target.value)}
            >
              <option value="">Select Function Code</option>
              {FUNCTION_CODES.map((f) => (
                <option key={f.code} value={f.code}>
                  {f.code} - {f.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field-box">
            <label htmlFor="cdAcqTxnId">RRN / Acq Txn ID</label>
            <input
              id="cdAcqTxnId"
              type="text"
              placeholder="Enter RRN or Acq Txn ID"
              value={acqTxnId}
              onChange={(e) => setAcqTxnId(e.target.value)}
            />
          </div>

          <div className="field-box">
            <label htmlFor="cdTollTxnId">Plaza Txn ID / Toll Txn ID</label>
            <input
              id="cdTollTxnId"
              type="text"
              placeholder="Enter Plaza Txn ID"
              value={tollTxnId}
              onChange={(e) => setTollTxnId(e.target.value)}
            />
          </div>

          <div className="field-box">
            <label htmlFor="cdTagId">Tag ID</label>
            <input
              id="cdTagId"
              type="text"
              placeholder="Enter Tag ID"
              value={tagId}
              onChange={(e) => setTagId(e.target.value)}
            />
          </div>
        </div>

        <div className="filter-actions-row">
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={handleReset}>
            Reset
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => loadData()}>
            Search
          </button>
        </div>
      </div>

      {/* 4. Table Area */}
      <div className="table-wrapper">
        <div className="table-top-bar">
          <div className="table-title">Closed Disputes Working Queue</div>
          <div className="top-bar-right-actions">
            <span className="record-count-text">
              Showing {rows.length} records {fetchTime && `(Fetched: ${fetchTime})`}
            </span>
            <button
              type="button"
              className="btn btn-outline-success btn-sm"
              onClick={handleExportExcel}
              disabled={rows.length === 0}
              id="cdExportExcelBtn"
              title="Export closed disputes to Excel"
            >
              Export Excel
            </button>
            <button
              type="button"
              className="btn btn-outline-primary btn-sm"
              onClick={handleExportCsv}
              disabled={rows.length === 0}
              id="cdExportCsvBtn"
              title="Export closed disputes to CSV"
            >
              Export CSV
            </button>
          </div>
        </div>

        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Decision Status</th>
                <th>Acq Txn ID</th>
                <th>Toll Txn ID</th>
                <th>VRN</th>
                <th>Tag ID</th>
                <th>Toll Plaza</th>
                <th>Txn Date</th>
                <th>Txn Amount</th>
                <th
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => handleSort('disputeAmount')}
                  title="Click to sort by Dispute Amount"
                >
                  Dispute Amount {sortConfig.field === 'disputeAmount' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '↕'}
                </th>
                <th>Function Code</th>
                <th>Dispute Type</th>
                <th
                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onClick={() => handleSort('actionDate')}
                  title="Click to sort by Action Date & Time"
                >
                  Plaza Action Date &amp; Time {sortConfig.field === 'actionDate' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '↕'}
                </th>
                <th>Plaza Remarks / Reason</th>
                <th>Admin Reason</th>
                <th>Counter Evidence</th>
                <th>Acquirer Evidence</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="17" className="text-center py-4">
                    <span className="spinner-border spinner-border-sm me-2" />
                    Loading action-taken dispute records...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan="17" className="text-center py-5 empty-cell">
                    <div className="empty-state-box">
                      <div className="empty-state-icon">📂</div>
                      <div className="empty-state-title">No Closed / Action-Taken Disputes Found</div>
                      <div className="empty-state-sub">
                        Disputes will appear here immediately once a plaza validates and submits their decision (Accept or Reject).
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedRows.map((r, idx) => {
                  const cleanId = r.disputeId || r.rowId;
                  const isAccepted = r.disputeStatus === 'Approved';
                  const isRejected = r.disputeStatus === 'Rejected';
                  const counterEv = evidenceStorage.getPlazaEvidence(cleanId, r.acqTxnId) || r.counterEvidence || [];
                  const adminEv = evidenceStorage.getAdminEvidence(cleanId, r.acqTxnId) || r.adminEvidence || [];

                  return (
                    <tr key={cleanId || idx}>
                      <td>
                        <span className={`status-badge ${isAccepted ? 'badge-green' : isRejected ? 'badge-red' : 'badge-gray'}`}>
                          {isAccepted ? '✓ Accepted' : isRejected ? '✕ Rejected' : r.disputeStatus || 'Closed'}
                        </span>
                      </td>
                      <td className="font-mono text-center">{r.acqTxnId}</td>
                      <td className="font-mono text-center">{r.tollTxnId}</td>
                      <td className="font-bold text-center">{r.vrn}</td>
                      <td className="font-mono text-center">{r.tagId}</td>
                      <td>
                        <span className="plaza-pill">{r.plazaName || PLAZA_MAP[r.plazaId] || r.plazaId}</span>
                      </td>
                      <td className="text-center">{r.txnDate}</td>
                      <td className="text-right">₹ {Number(r.txnAmount || 0).toFixed(2)}</td>
                      <td className="text-right font-bold dispute-amt-cell">
                        ₹ {Number(r.disputeAmount || 0).toFixed(2)}
                      </td>
                      <td className="text-center">
                        <span className="code-pill">{r.functionCode}</span>
                      </td>
                      <td>{r.disputeType}</td>
                      <td className="text-center action-date-cell">
                        {r.decidedAt ? new Date(r.decidedAt).toLocaleString('en-IN') : (r.plazaActionTime || '—')}
                      </td>
                      <td className="reason-cell" title={r.plazaReason || '—'}>
                        {r.plazaReason || '—'}
                      </td>
                      <td className="reason-cell" title={r.adminReason || r.adminRemarks || '—'}>
                        {r.adminReason || r.adminRemarks || '—'}
                      </td>
                      <td className="text-center">
                        {counterEv.length > 0 ? (
                          <button
                            type="button"
                            className="btn btn-xs btn-outline-info"
                            onClick={() => handleOpenEvidence(r, 'counter')}
                            title="View plaza uploaded counter-evidence"
                          >
                            📎 View ({counterEv.length})
                          </button>
                        ) : (
                          <span className="empty-evidence-text">None</span>
                        )}
                      </td>
                      <td className="text-center">
                        {adminEv.length > 0 ? (
                          <button
                            type="button"
                            className="btn btn-xs btn-outline-secondary"
                            onClick={() => handleOpenEvidence(r, 'admin')}
                            title="View acquirer dispute evidence"
                          >
                            📎 View ({adminEv.length})
                          </button>
                        ) : (
                          <span className="empty-evidence-text">None</span>
                        )}
                      </td>
                      <td className="text-center">
                        <button
                          type="button"
                          className="btn btn-xs btn-outline-primary"
                          onClick={() => setDetailsModalRow(r)}
                          title="View complete transaction record"
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <TablePagination
          currentPage={currentPage}
          pageSize={pageSize}
          totalItems={rows.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
        />
      </div>

      {/* Transaction Details Modal */}
      {detailsModalRow && (
        <TransactionDetailsModal
          isOpen={Boolean(detailsModalRow)}
          onClose={() => setDetailsModalRow(null)}
          disputeRow={detailsModalRow}
        />
      )}

      {/* Evidence Preview Modal */}
      {evidenceModalData?.isOpen && (
        <EvidencePreviewModal
          isOpen={evidenceModalData.isOpen}
          onClose={() => setEvidenceModalData(null)}
          fileList={evidenceModalData.fileList}
          disputeRow={evidenceModalData.row}
          source={evidenceModalData.source}
        />
      )}
    </div>
  );
};

export default ClosedDisputes;
