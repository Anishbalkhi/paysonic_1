import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { FUNCTION_CODES, PLAZA_MAP } from '../../config/disputeConstants';
import DisputeManagementService, { resolveDisputeDates } from '../../services/dispute/DisputeManagementService';
import useOnboardedPlazas from '../../hooks/useOnboardedPlazas';
import { filterRecordsByPlazaScope } from '../../utils/plazaScopeUtils';
import TransactionDetailsModal from '../../components/DisputeModals/TransactionDetailsModal';
import EvidencePreviewModal from '../../components/DisputeModals/EvidencePreviewModal';
import TablePagination from '../../components/common/TablePagination';
import { formatFetchTime, formatDateTime, parseUtcTimestamp } from '../../utils/dateUtils';
import evidenceStorage from '../../services/dispute/evidenceStorage';
import { downloadBulkDisputeEvidence } from '../../utils/evidenceDownloader';
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
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination & rows
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [fetchTime, setFetchTime] = useState('');
  const [isDownloadingEvidence, setIsDownloadingEvidence] = useState(false);

  // Modals state
  const [detailsModalRow, setDetailsModalRow] = useState(null);
  const [evidenceModalData, setEvidenceModalData] = useState(null); // { isOpen, row, fileList, source }

  // Sorting state
  const [sortConfig, setSortConfig] = useState({ field: 'actionDate', direction: 'desc' });

  const getPlazaActionTimeDisplay = useCallback((r) => {
    if (!r) return '—';
    if (r.plazaActionTime && r.plazaActionTime !== 'Pending Plaza Decision' && r.plazaActionTime !== '—') {
      return formatDateTime(r.plazaActionTime);
    }
    if (r.plazaActionAt) {
      return formatDateTime(r.plazaActionAt);
    }
    if (r.decidedAt && r.decidedAt !== '—') {
      return formatDateTime(r.decidedAt);
    }
    return '—';
  }, []);

  const loadData = useCallback(async (overrides = {}) => {
    try {
      setLoading(true);
      const fDate = overrides.fromDate !== undefined ? overrides.fromDate : fromDate;
      const tDate = overrides.toDate !== undefined ? overrides.toDate : toDate;
      const dType = overrides.dateType !== undefined ? overrides.dateType : dateType;
      const fCode = overrides.functionCode !== undefined ? overrides.functionCode : functionCode;
      const decFilter = overrides.decisionFilter !== undefined ? overrides.decisionFilter : decisionFilter;
      const aTxn = (overrides.acqTxnId !== undefined ? overrides.acqTxnId : acqTxnId).trim();
      const tTxn = (overrides.tollTxnId !== undefined ? overrides.tollTxnId : tollTxnId).trim();
      const tTag = (overrides.tagId !== undefined ? overrides.tagId : tagId).trim();
      const search = (overrides.search !== undefined ? overrides.search : searchQuery).trim();
      const pId = overrides.plazaId !== undefined ? overrides.plazaId : activePlazaId;

      const effectiveSearch = (search || aTxn || tTxn || tTag || '').trim();

      // Fetch fresh disputes from live Railway backend or cache fallback
      const fetched = await DisputeManagementService.searchDisputes({
        scopedPlazaId: pId !== 'ALL' ? pId : undefined,
        plazaId: pId !== 'ALL' ? pId : undefined,
        fromDate: fDate,
        toDate: tDate,
        dateType: dType,
        functionCode: fCode && fCode !== 'ALL' ? fCode : undefined,
        search: effectiveSearch || undefined,
        acqTxnId: aTxn,
        tollTxnId: tTxn,
        tagId: tTag,
      });

      const allDisputes = Array.isArray(fetched) && fetched.length > 0
        ? fetched
        : DisputeManagementService.getStoredDisputes();

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
  }, [activePlazaId, fromDate, toDate, dateType, functionCode, decisionFilter, acqTxnId, tollTxnId, tagId, searchQuery, plazas, currentUser]);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleReset = () => {
    setFromDate('2026-09-01');
    setToDate('2026-10-31');
    setDateType('Plaza Action Date');
    setFunctionCode('');
    setDecisionFilter('ALL');
    setAcqTxnId('');
    setTollTxnId('');
    setTagId('');
    setSearchQuery('');
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
      search: '',
      plazaId: isPlazaLocked ? defaultPlazaId : 'ALL',
    });
  };

  // Live filtering on Tag ID, RRN (Acq Txn ID), Plaza Txn ID (Toll Txn ID), or VRN
  const filteredRows = useMemo(() => {
    if (!Array.isArray(rows)) return [];
    const q = (searchQuery || '').trim().toLowerCase();
    const acqQ = (acqTxnId || '').trim().toLowerCase();
    const tollQ = (tollTxnId || '').trim().toLowerCase();
    const tagQ = (tagId || '').trim().toLowerCase();

    return rows.filter((r) => {
      if (acqQ) {
        const rrnMatch =
          (r.acqTxnId && String(r.acqTxnId).toLowerCase().includes(acqQ)) ||
          (r.rrn && String(r.rrn).toLowerCase().includes(acqQ));
        if (!rrnMatch) return false;
      }
      if (tollQ) {
        const tollMatch =
          (r.tollTxnId && String(r.tollTxnId).toLowerCase().includes(tollQ)) ||
          (r.toll_txn_id && String(r.toll_txn_id).toLowerCase().includes(tollQ));
        if (!tollMatch) return false;
      }
      if (tagQ) {
        const tagMatch = r.tagId && String(r.tagId).toLowerCase().includes(tagQ);
        if (!tagMatch) return false;
      }
      if (q) {
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
        if (!(tagMatch || rrnMatch || plazaTxnMatch || vrnMatch)) return false;
      }
      return true;
    });
  }, [rows, searchQuery, acqTxnId, tollTxnId, tagId]);

  // KPI Calculations on filteredRows
  const kpiStats = useMemo(() => {
    const total = filteredRows.length;
    const accepted = filteredRows.filter((r) => r.disputeStatus === 'Approved').length;
    const rejected = filteredRows.filter((r) => r.disputeStatus === 'Rejected').length;
    const totalDisputeAmt = filteredRows.reduce((acc, r) => acc + Number(r.disputeAmount || 0), 0);
    const acceptedAmt = filteredRows
      .filter((r) => r.disputeStatus === 'Approved')
      .reduce((acc, r) => acc + Number(r.disputeAmount || 0), 0);
    const rejectedAmt = filteredRows
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
  }, [filteredRows]);

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
    if (!Array.isArray(filteredRows)) return [];
    if (!sortConfig.field) return filteredRows;
    return [...filteredRows].sort((a, b) => {
      if (sortConfig.field === 'actionDate') {
        const timeA = a.plazaActionTime ? (parseUtcTimestamp(a.plazaActionTime)?.getTime() || 0) : (a.plazaActionAt ? (parseUtcTimestamp(a.plazaActionAt)?.getTime() || 0) : (a.decidedAt ? (parseUtcTimestamp(a.decidedAt)?.getTime() || 0) : 0));
        const timeB = b.plazaActionTime ? (parseUtcTimestamp(b.plazaActionTime)?.getTime() || 0) : (b.plazaActionAt ? (parseUtcTimestamp(b.plazaActionAt)?.getTime() || 0) : (b.decidedAt ? (parseUtcTimestamp(b.decidedAt)?.getTime() || 0) : 0));
        return sortConfig.direction === 'asc' ? timeA - timeB : timeB - timeA;
      }
      if (sortConfig.field === 'disputeAmount') {
        const amtA = Number(a.disputeAmount || 0);
        const amtB = Number(b.disputeAmount || 0);
        return sortConfig.direction === 'asc' ? amtA - amtB : amtB - amtA;
      }
      return 0;
    });
  }, [filteredRows, sortConfig]);

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

  // Bulk Evidence Download Handler - Plaza attached counter-evidence only
  const handleBulkEvidenceDownload = async () => {
    if (!filteredRows || filteredRows.length === 0) {
      alert('No closed disputes available to download evidence.');
      return;
    }
    try {
      setIsDownloadingEvidence(true);
      await downloadBulkDisputeEvidence(filteredRows, {
        archiveName: `Closed_Disputes_Plaza_Evidence_Bulk_${Date.now()}.zip`,
        onlyPlaza: true,
      });
    } catch (err) {
      console.error('[ClosedDisputes] Bulk evidence download error:', err);
      alert(err.message || 'Failed to download bulk evidence: ' + err.message);
    } finally {
      setIsDownloadingEvidence(false);
    }
  };

  // Export to CSV
  const handleExportCsv = () => {
    if (!filteredRows || filteredRows.length === 0) return;
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

    const csvRows = filteredRows.map((r) => {
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
        resolveDisputeDates(r).disputeRaiseDate || '—',
        resolveDisputeDates(r).tatDueDate || '—',
        resolveDisputeDates(r).disputeRaiseDate || '—',
        r.functionCode,
        r.disputeType,
        Number(r.txnAmount || 0).toFixed(2),
        Number(r.disputeAmount || 0).toFixed(2),
        getPlazaActionTimeDisplay(r),
        r.plazaReason || '—',
        r.adminReason || r.adminRemarks || '—',
        evCount
      ].map(escapeCsv).join(',');
    });

    const totDispute = filteredRows.reduce((s, r) => s + Number(r.disputeAmount || 0), 0).toFixed(2);
    const bannerRows = [
      `"PAYSONIC DISPUTE & CHARGEBACK MANAGEMENT — CLOSED DISPUTES AUDIT REPORT"`,
      `"Export Time: ${fetchTimeStr}   |   Total Actioned Records: ${filteredRows.length}   |   Cumulative Dispute Value: ₹ ${totDispute}"`,
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
    if (!filteredRows || filteredRows.length === 0) return;
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

    filteredRows.forEach((r) => {
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
        <Cell ss:StyleID="sDataCenter"><Data ss:Type="String">${xmlEsc(getPlazaActionTimeDisplay(r))}</Data></Cell>
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
        <Cell ss:StyleID="sTotalLabel"><Data ss:Type="String">Records: ${filteredRows.length}</Data></Cell>
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
    <Cell ss:MergeAcross="${colSpan}" ss:StyleID="sSubtitle"><Data ss:Type="String">Export Time: ${xmlEsc(fetchTimeStr)}   |   Total Actioned Records: ${filteredRows.length}   |   Cumulative Dispute Amount: ₹ ${totalDisputeAmt.toFixed(2)}</Data></Cell>
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

          <div className="field-box search-field-box">
            <label htmlFor="cdSearch">Search (Tag ID, RRN, Plaza Txn ID)</label>
            <div className="search-input-wrapper">
              <span className="search-icon">🔍</span>
              <input
                id="cdSearch"
                type="text"
                placeholder="Search Tag ID, RRN, Plaza Txn ID..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    loadData({ search: searchQuery });
                  }
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={() => {
                    setSearchQuery('');
                    setCurrentPage(1);
                    loadData({ search: '' });
                  }}
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>
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
            <div className="table-quick-search">
              <div className="search-input-wrapper">
                <span className="search-icon">🔍</span>
                <input
                  id="cdQuickSearch"
                  type="text"
                  placeholder="Search Tag ID, RRN, Plaza Txn ID..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      loadData({ search: searchQuery });
                    }
                  }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="search-clear-btn"
                    onClick={() => {
                      setSearchQuery('');
                      setCurrentPage(1);
                      loadData({ search: '' });
                    }}
                    title="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
            <span className="record-count-text">
              Showing <strong>{filteredRows.length}</strong> {searchQuery ? `of ${rows.length}` : ''} records {fetchTime && `(Fetched: ${fetchTime})`}
            </span>
            <button
              type="button"
              className="btn btn-outline-info btn-sm"
              onClick={handleBulkEvidenceDownload}
              disabled={filteredRows.length === 0 || isDownloadingEvidence}
              id="cdBulkEvidenceDownloadBtn"
              title="Download plaza attached counter-evidence for closed disputes in queue"
            >
              {isDownloadingEvidence ? '⏳ Downloading...' : '📥 Bulk Evidence Download'}
            </button>
            <button
              type="button"
              className="btn btn-outline-success btn-sm"
              onClick={handleExportExcel}
              disabled={filteredRows.length === 0}
              id="cdExportExcelBtn"
              title="Export closed disputes to Excel"
            >
              Export Excel
            </button>
            <button
              type="button"
              className="btn btn-outline-primary btn-sm"
              onClick={handleExportCsv}
              disabled={filteredRows.length === 0}
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
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan="17" className="text-center py-5 empty-cell">
                    <div className="empty-state-box">
                      <div className="empty-state-icon">{searchQuery ? '🔍' : '📂'}</div>
                      <div className="empty-state-title">
                        {searchQuery ? `No Closed Disputes Matching "${searchQuery}"` : 'No Closed / Action-Taken Disputes Found'}
                      </div>
                      <div className="empty-state-sub">
                        {searchQuery ? 'Try clearing or modifying your search query to see other records.' : 'Disputes will appear here immediately once a plaza validates and submits their decision (Accept or Reject).'}
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
                        {getPlazaActionTimeDisplay(r)}
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
          totalItems={filteredRows.length}
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
