import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { FUNCTION_CODES } from '../../config/disputeConstants';
import useOnboardedPlazas from '../../hooks/useOnboardedPlazas';
import { filterRecordsByPlazaScope } from '../../utils/plazaScopeUtils';
import DisputeManagementService, { resolveDisputeDates } from '../../services/dispute/DisputeManagementService';
import TransactionDetailsModal from '../../components/DisputeModals/TransactionDetailsModal';
import MoreInformationModal from '../../components/DisputeModals/MoreInformationModal';
import TablePagination from '../../components/common/TablePagination';
import { formatFetchTime, parseUtcTimestamp } from '../../utils/dateUtils';
import { downloadBulkDisputeEvidence } from '../../utils/evidenceDownloader';
import './ChargebackAssign.scss';

export const ChargebackAssign = () => {
  const { currentUser } = useAuth();
  const [rows, setRows] = useState([]);
  const { plazas, isPlazaLocked, defaultPlazaId, assignedPlaza } = useOnboardedPlazas();
  const [miniStats, setMiniStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchTime, setFetchTime] = useState('');
  const [downloadTime, setDownloadTime] = useState('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Filters
  const [fromDate, setFromDate] = useState('2026-09-01');
  const [toDate, setToDate] = useState('2026-10-31');
  const [dateType, setDateType] = useState('Transaction DateTime');
  const [functionCode, setFunctionCode] = useState('');
  const [tollPlazaId, setTollPlazaId] = useState(isPlazaLocked ? (defaultPlazaId || '') : '');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (isPlazaLocked && defaultPlazaId && tollPlazaId !== defaultPlazaId) {
      setTollPlazaId(defaultPlazaId);
    }
  }, [isPlazaLocked, defaultPlazaId, tollPlazaId]);

  // Bulk plaza selection chips
  const [selectedPlazaChips, setSelectedPlazaChips] = useState([]);
  const [bulkFeedback, setBulkFeedback] = useState('');

  // Row Selection State for Working Queue Table
  const [selectedRowIds, setSelectedRowIds] = useState(new Set());
  const [isDownloadingEvidence, setIsDownloadingEvidence] = useState(false);

  // Modals state
  const [txnModalRow, setTxnModalRow] = useState(null);
  const [cbModalRow, setCbModalRow] = useState(null);

  // Sorting state
  const [sortConfig, setSortConfig] = useState({ field: null, direction: 'asc' });

  const loadData = useCallback(async (overrides = {}) => {
    try {
      setLoading(true);
      const fDate = overrides.fromDate !== undefined ? overrides.fromDate : fromDate;
      const tDate = overrides.toDate !== undefined ? overrides.toDate : toDate;
      const dType = overrides.dateType !== undefined ? overrides.dateType : dateType;
      const fCode = overrides.functionCode !== undefined ? overrides.functionCode : functionCode;
      const pId = overrides.tollPlazaId !== undefined ? overrides.tollPlazaId : tollPlazaId;
      const search = overrides.search !== undefined ? overrides.search : searchQuery;

      const [fetchedRows, stats] = await Promise.all([
        DisputeManagementService.searchDisputes({
          fromDate: fDate,
          toDate: tDate,
          dateType: dType,
          functionCode: fCode,
          plazaId: pId,
          search: search ? search.trim() : undefined,
        }),
        DisputeManagementService.getAdminMiniDashboardStats(),
      ]);
      const scopedRows = filterRecordsByPlazaScope(fetchedRows, plazas, currentUser);
      // In Chargeback Assign, only show chargebacks needing assignment or awaiting plaza decision
      const chargebackQueueRows = scopedRows.filter((r) => {
        const isActionTaken =
          r.plazaAction === 'Yes' ||
          r.disputeStatus === 'Approved' ||
          r.disputeStatus === 'Rejected' ||
          r.closed === true;
        return !isActionTaken;
      });
      setRows(chargebackQueueRows);
      setMiniStats(stats);
      setFetchTime(formatFetchTime(new Date()));
      setCurrentPage(1);
      setSelectedRowIds(new Set());
    } catch (e) {
      console.error('[ChargebackAssign] Load error:', e);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, dateType, functionCode, tollPlazaId, searchQuery, plazas, currentUser]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const togglePlazaChip = (plazaId) => {
    const idStr = String(plazaId);
    setSelectedPlazaChips((prev) =>
      prev.includes(idStr) ? prev.filter((p) => p !== idStr) : [...prev, idStr]
    );
  };

  const handleSelectAllPlazas = () => {
    const allIds = (plazas || []).map((p) => String(p.id));
    setSelectedPlazaChips(allIds);
    setBulkFeedback(`Selected all ${allIds.length} plaza(s).`);
  };

  const handleUnselectAllPlazas = () => {
    setSelectedPlazaChips([]);
    setBulkFeedback('Cleared plaza selection.');
  };

  const handleBulkAssign = async () => {
    if (selectedPlazaChips.length === 0) {
      setBulkFeedback('Please pick at least one plaza chip first.');
      return;
    }
    try {
      setBulkFeedback('Assigning selected plazas...');
      const { updatedCount } = await DisputeManagementService.bulkAssignPlazas(selectedPlazaChips);
      if (updatedCount === 0) {
        setBulkFeedback(`ℹ️ No unassigned open disputes found for the selected plaza(s).`);
      } else {
        setBulkFeedback(`✓ ${updatedCount} row(s) assigned across ${selectedPlazaChips.length} plaza(s).`);
      }
      loadData();
    } catch (err) {
      setBulkFeedback(`⚠️ Failed to bulk assign: ${err.message}`);
    }
  };

  const handleBulkUnassign = async () => {
    if (selectedPlazaChips.length === 0) {
      setBulkFeedback('Please pick at least one plaza chip first.');
      return;
    }
    try {
      setBulkFeedback('Unassigning selected plazas...');
      const { updatedCount } = await DisputeManagementService.bulkUnassignPlazas(selectedPlazaChips);
      if (updatedCount === 0) {
        setBulkFeedback(`ℹ️ No assigned, undecided rows found for the selected plaza(s).`);
      } else {
        setBulkFeedback(`✓ ${updatedCount} open row(s) unassigned across ${selectedPlazaChips.length} plaza(s). Decided rows were kept.`);
      }
      loadData();
    } catch (err) {
      setBulkFeedback(`⚠️ Failed to bulk unassign: ${err.message}`);
    }
  };

  // Row Selection Handlers
  const handleToggleSelectAllRows = (e) => {
    if (e.target.checked) {
      const allIds = new Set(filteredRows.map((r) => String(r.rowId || r.disputeId)));
      setSelectedRowIds(allIds);
    } else {
      setSelectedRowIds(new Set());
    }
  };

  const handleToggleRowSelect = (rowId) => {
    const idStr = String(rowId);
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(idStr)) {
        next.delete(idStr);
      } else {
        next.add(idStr);
      }
      return next;
    });
  };

  // Bulk Evidence Download Handler (with RRN naming)
  const handleBulkDownloadEvidence = async (explicitRows = null) => {
    let targets = explicitRows;
    if (!targets) {
      if (selectedRowIds.size > 0) {
        targets = filteredRows.filter((r) => selectedRowIds.has(String(r.rowId || r.disputeId)));
      } else {
        targets = filteredRows;
      }
    }

    if (!targets || targets.length === 0) {
      alert('No dispute transactions found to download evidence.');
      return;
    }

    try {
      setIsDownloadingEvidence(true);
      setBulkFeedback(`⏳ Preparing bulk evidence download for ${targets.length} dispute(s)...`);
      const result = await downloadBulkDisputeEvidence(targets, {
        archiveName: `Chargeback_Evidence_Bulk_${Date.now()}.zip`,
      });
      setBulkFeedback(`✓ Successfully exported ${result.totalFiles} evidence file(s) for ${result.totalDisputes} dispute(s) organized into user folders.`);
    } catch (err) {
      console.error('[ChargebackAssign] Bulk evidence download error:', err);
      alert('Failed to download bulk evidence: ' + err.message);
      setBulkFeedback(`⚠️ Evidence download failed: ${err.message}`);
    } finally {
      setIsDownloadingEvidence(false);
    }
  };

  // Bulk Evidence Download for Selected Plazas
  const handleBulkDownloadPlazaEvidence = async () => {
    let targets = [];
    if (selectedPlazaChips.length > 0) {
      targets = rows.filter((r) => selectedPlazaChips.includes(String(r.plazaId)));
    } else if (selectedRowIds.size > 0) {
      targets = rows.filter((r) => selectedRowIds.has(String(r.rowId || r.disputeId)));
    } else {
      targets = filteredRows;
    }

    if (targets.length === 0) {
      setBulkFeedback('Please pick at least one plaza chip or select disputes first.');
      return;
    }

    await handleBulkDownloadEvidence(targets);
  };

  // Bulk Assign Selected Rows
  const handleBulkAssignSelectedRows = async () => {
    if (selectedRowIds.size === 0) {
      setBulkFeedback('Please select at least one dispute row.');
      return;
    }
    try {
      setBulkFeedback(`Assigning ${selectedRowIds.size} selected row(s)...`);
      const actorName = currentUser?.name || currentUser?.role || 'Master Admin';
      const { updatedCount } = await DisputeManagementService.bulkAssignDisputeIds(
        Array.from(selectedRowIds),
        actorName
      );
      setBulkFeedback(`✓ ${updatedCount} selected dispute(s) assigned to plaza.`);
      setSelectedRowIds(new Set());
      loadData();
    } catch (err) {
      setBulkFeedback(`⚠️ Failed to bulk assign selected rows: ${err.message}`);
    }
  };

  // Bulk Unassign Selected Rows
  const handleBulkUnassignSelectedRows = async () => {
    if (selectedRowIds.size === 0) {
      setBulkFeedback('Please select at least one dispute row.');
      return;
    }
    try {
      setBulkFeedback(`Unassigning ${selectedRowIds.size} selected row(s)...`);
      const actorName = currentUser?.name || currentUser?.role || 'Master Admin';
      const { updatedCount } = await DisputeManagementService.bulkUnassignDisputeIds(
        Array.from(selectedRowIds),
        actorName
      );
      setBulkFeedback(`✓ ${updatedCount} selected dispute(s) unassigned.`);
      setSelectedRowIds(new Set());
      loadData();
    } catch (err) {
      setBulkFeedback(`⚠️ Failed to bulk unassign selected rows: ${err.message}`);
    }
  };

  // Sync with realtime onboarded plaza updates and dispute state updates
  useEffect(() => {
    const handleSync = () => {
      loadData();
    };
    window.addEventListener('paysonic:plazas_updated', handleSync);
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
      window.removeEventListener('paysonic:plazas_updated', handleSync);
      window.removeEventListener('paysonic:disputes_updated', handleSync);
      window.removeEventListener('storage', handleSync);
      if (bc) bc.close();
    };
  }, [loadData]);

  // Live filtering on Date, Tag ID, RRN (Acq Txn ID), Plaza Txn ID, or VRN
  const filteredRows = useMemo(() => {
    if (!Array.isArray(rows)) return [];
    const q = (searchQuery || '').trim().toLowerCase();

    // Parse date bounds (from start of fromDate to end of toDate)
    let startMs = 0;
    let endMs = Infinity;
    if (fromDate) {
      const d = new Date(fromDate + 'T00:00:00');
      if (!isNaN(d.getTime())) startMs = d.getTime();
    }
    if (toDate) {
      const d = new Date(toDate + 'T23:59:59.999');
      if (!isNaN(d.getTime())) endMs = d.getTime();
    }

    return rows.filter((r) => {
      // 1. Function Code filter
      if (functionCode && String(r.functionCode) !== String(functionCode)) {
        return false;
      }

      // 2. Toll Plaza filter
      if (tollPlazaId && String(r.plazaId) !== String(tollPlazaId) && String(r.assignedToPlaza) !== String(tollPlazaId)) {
        return false;
      }

      // 3. Date filtering based on dateType
      if (startMs > 0 || endMs < Infinity) {
        let targetDateVal = null;
        if (dateType === 'Chargeback Date') {
          targetDateVal = r.cbRaisedDate || r.settlementDate;
        } else if (dateType === 'Plaza Action Date') {
          targetDateVal = r.plazaActionTime || r.plazaActionAt || r.decidedAt;
        } else {
          // Default: Transaction DateTime
          targetDateVal = r.txnDateTime || r.txnDate;
        }

        if (targetDateVal && targetDateVal !== '—' && targetDateVal !== 'Pending Plaza Decision') {
          const parsed = parseUtcTimestamp(targetDateVal);
          if (parsed && !isNaN(parsed.getTime())) {
            const time = parsed.getTime();
            if (time < startMs || time > endMs) {
              return false;
            }
          }
        }
      }

      // 4. Search query
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
        if (!(tagMatch || rrnMatch || plazaTxnMatch || vrnMatch)) {
          return false;
        }
      }

      return true;
    });
  }, [rows, searchQuery, fromDate, toDate, dateType, functionCode, tollPlazaId]);

  // Export CSV directly matching current filtered records with Paysonic theme
  const handleExportCsv = () => {
    if (!filteredRows || filteredRows.length === 0) return;
    const fetchTimeStr = formatFetchTime(new Date());
    setDownloadTime(fetchTimeStr);

    const headers = [
      'Assign Status',
      'Acq Txn ID',
      'Toll Txn ID',
      'VRN',
      'Tag ID',
      'Toll Plaza Name',
      'Toll Plaza ID',
      'Txn Date',
      'Dispute Raise Date',
      'TAT Due Date (T+8)',
      'CB Raised Date',
      'CB Reason',
      'Function Code',
      'Dispute Type',
      'Plaza Action',
      'Plaza Action Date & Time',
      'Dispute Status',
      'Plaza Reason',
      'Txn Amount',
      'Dispute Amount',
      'TAT'
    ];

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const csvRows = filteredRows.map((r) => {
      const tat = DisputeManagementService.getTatBadge(r);
      const dispDates = resolveDisputeDates(r);
      return [
        r.lifecycleStatus || (r.assigned ? 'Assigned' : 'Unassigned'),
        r.acqTxnId,
        r.tollTxnId,
        r.vrn,
        r.tagId,
        r.plazaName,
        r.plazaId,
        r.txnDate,
        dispDates.disputeRaiseDate || '—',
        dispDates.tatDueDate || '—',
        dispDates.disputeRaiseDate || '—',
        r.cbReason,
        r.functionCode,
        r.disputeType,
        r.plazaAction === 'Yes' ? 'Yes' : 'No',
        r.plazaActionTime || '—',
        r.disputeStatus,
        r.plazaReason,
        Number(r.txnAmount || 0).toFixed(2),
        Number(r.disputeAmount || 0).toFixed(2),
        tat.label
      ].map(escapeCsv).join(',');
    });

    const totTxn = filteredRows.reduce((s, r) => s + Number(r.txnAmount || 0), 0).toFixed(2);
    const totDispute = filteredRows.reduce((s, r) => s + Number(r.disputeAmount || 0), 0).toFixed(2);

    const totalRow = Array(headers.length).fill('""');
    totalRow[0] = '"TOTAL"';
    totalRow[18] = `"${totTxn}"`;
    totalRow[19] = `"${totDispute}"`;

    const bannerRows = [
      `"PAYSONIC DISPUTE & CHARGEBACK MANAGEMENT — WORKING QUEUE"`,
      `"Export Time: ${fetchTimeStr}   |   Total Queue Disputes: ${filteredRows.length}   |   Cumulative Dispute Value: ₹ ${totDispute}"`,
      ''
    ];

    const csvContent = '\uFEFF' + [
      ...bannerRows,
      headers.map(escapeCsv).join(','),
      ...csvRows,
      totalRow.join(',')
    ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Chargeback_Working_Queue_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Export Excel directly matching current filtered records with Paysonic branded theme
  const handleExportExcel = () => {
    if (!filteredRows || filteredRows.length === 0) return;
    const fetchTimeStr = formatFetchTime(new Date());
    setDownloadTime(fetchTimeStr);

    const xmlEsc = (str) =>
      String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

    const headers = [
      'Assign Status', 'Acq Txn ID', 'Toll Txn ID', 'VRN', 'Tag ID',
      'Toll Plaza Name', 'Toll Plaza ID', 'Txn Date', 'Dispute Raise Date', 'TAT Due Date (T+8)',
      'CB Raised Date', 'CB Reason', 'Function Code', 'Dispute Type', 'Plaza Action',
      'Plaza Action Date & Time', 'Dispute Status', 'Plaza Reason', 'Txn Amount', 'Dispute Amount', 'TAT'
    ];

    let dataXml = '';
    let totalTxnAmt = 0;
    let totalDisputeAmt = 0;

    filteredRows.forEach((r) => {
      const tat = DisputeManagementService.getTatBadge(r);
      const isAssigned = Boolean(r.assigned);
      const isAccepted = r.disputeStatus === 'Approved';
      const isRejected = r.disputeStatus === 'Rejected';
      const statusStyle = isAccepted ? 'sBadgeGreen' : isRejected ? 'sBadgeRed' : isAssigned ? 'sBadgeBlue' : 'sBadgeAmber';

      const tatStyle = tat.status === 'safe' ? 'sBadgeGreen' : tat.status === 'at-risk' ? 'sBadgeAmber' : tat.status === 'overdue' ? 'sBadgeRed' : 'sDataCenter';

      const tAmt = Number(r.txnAmount || 0);
      const dAmt = Number(r.disputeAmount || 0);
      totalTxnAmt += tAmt;
      totalDisputeAmt += dAmt;

      dataXml += `
      <Row ss:Height="21">
        <Cell ss:StyleID="${statusStyle}"><Data ss:Type="String">${xmlEsc(r.lifecycleStatus || (isAssigned ? 'Assigned' : 'Unassigned'))}</Data></Cell>
        <Cell ss:StyleID="sDataCenter"><Data ss:Type="String">${xmlEsc(r.acqTxnId)}</Data></Cell>
        <Cell ss:StyleID="sDataCenter"><Data ss:Type="String">${xmlEsc(r.tollTxnId)}</Data></Cell>
        <Cell ss:StyleID="sDataCenter"><Data ss:Type="String">${xmlEsc(r.vrn)}</Data></Cell>
        <Cell ss:StyleID="sDataCenter"><Data ss:Type="String">${xmlEsc(r.tagId)}</Data></Cell>
        <Cell ss:StyleID="sDataText"><Data ss:Type="String">${xmlEsc(r.plazaName)}</Data></Cell>
        <Cell ss:StyleID="sDataCenter"><Data ss:Type="String">${xmlEsc(r.plazaId)}</Data></Cell>
        <Cell ss:StyleID="sDataCenter"><Data ss:Type="String">${xmlEsc(r.txnDate)}</Data></Cell>
        <Cell ss:StyleID="sDataCenter"><Data ss:Type="String">${xmlEsc(r.settlementDate || '—')}</Data></Cell>
        <Cell ss:StyleID="sDataCenter"><Data ss:Type="String">${xmlEsc(r.tatDueDate || '—')}</Data></Cell>
        <Cell ss:StyleID="sDataCenter"><Data ss:Type="String">${xmlEsc(r.settlementDate || r.cbRaisedDate || '—')}</Data></Cell>
        <Cell ss:StyleID="sDataText"><Data ss:Type="String">${xmlEsc(r.cbReason)}</Data></Cell>
        <Cell ss:StyleID="sDataCenter"><Data ss:Type="Number">${Number(r.functionCode || 0)}</Data></Cell>
        <Cell ss:StyleID="sDataText"><Data ss:Type="String">${xmlEsc(r.disputeType)}</Data></Cell>
        <Cell ss:StyleID="sDataCenter"><Data ss:Type="String">${xmlEsc(r.plazaAction === 'Yes' ? 'Yes' : 'No')}</Data></Cell>
        <Cell ss:StyleID="sDataCenter"><Data ss:Type="String">${xmlEsc(r.plazaActionTime || '—')}</Data></Cell>
        <Cell ss:StyleID="sDataCenter"><Data ss:Type="String">${xmlEsc(r.disputeStatus)}</Data></Cell>
        <Cell ss:StyleID="sDataText"><Data ss:Type="String">${xmlEsc(r.plazaReason)}</Data></Cell>
        <Cell ss:StyleID="sDataAmt"><Data ss:Type="Number">${tAmt}</Data></Cell>
        <Cell ss:StyleID="sDataAmt"><Data ss:Type="Number">${dAmt}</Data></Cell>
        <Cell ss:StyleID="${tatStyle}"><Data ss:Type="String">${xmlEsc(tat.label)}</Data></Cell>
      </Row>`;
    });

    const headerXml = `
      <Row ss:Height="26">
        ${headers.map((h) => `<Cell ss:StyleID="sMainHeader"><Data ss:Type="String">${xmlEsc(h)}</Data></Cell>`).join('')}
      </Row>`;

    const totalXml = `
      <Row ss:Height="24">
        <Cell ss:StyleID="sTotalLabel"><Data ss:Type="String">TOTAL</Data></Cell>
        <Cell ss:StyleID="sTotalLabel"><Data ss:Type="String">Total Disputes: ${filteredRows.length}</Data></Cell>
        ${Array(16).fill('<Cell ss:StyleID="sTotalLabel"><Data ss:Type="String"></Data></Cell>').join('')}
        <Cell ss:StyleID="sTotalAmt"><Data ss:Type="Number">${totalTxnAmt.toFixed(2)}</Data></Cell>
        <Cell ss:StyleID="sTotalAmt"><Data ss:Type="Number">${totalDisputeAmt.toFixed(2)}</Data></Cell>
        <Cell ss:StyleID="sTotalLabel"><Data ss:Type="String"></Data></Cell>
      </Row>`;

    const colSpan = headers.length - 1;

    const colWidths = [
      120, // Assign Status
      185, // Acq Txn ID
      140, // Toll Txn ID
      115, // VRN
      195, // Tag ID
      160, // Toll Plaza Name
      90,  // Toll Plaza ID
      135, // Txn Date
      115, // Dispute Raise Date
      135, // TAT Due Date (T+8)
      115, // CB Raised Date
      160, // CB Reason
      95,  // Function Code
      115, // Dispute Type
      100, // Plaza Action
      150, // Plaza Action Date & Time
      120, // Dispute Status
      160, // Plaza Reason
      110, // Txn Amount
      110, // Dispute Amount
      105  // TAT
    ];

    const excelXml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Author>Paysonic Toll Operations</Author>
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
   <Font ss:FontName="Calibri" ss:Size="16" ss:Bold="1" ss:Color="#002060"/>
  </Style>
  <Style ss:ID="sSubtitle">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#64748B"/>
  </Style>
  <Style ss:ID="sGreenBar">
   <Interior ss:Color="#10B981" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="sMainHeader">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="10.5" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#0F2F6B" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="sDataText">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#1E293B"/>
  </Style>
  <Style ss:ID="sDataCenter">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#1E293B"/>
  </Style>
  <Style ss:ID="sDataAmt">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#1E293B"/>
   <NumberFormat ss:Format="#,##0.00"/>
  </Style>
  <Style ss:ID="sBadgeGreen">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="9.5" ss:Bold="1" ss:Color="#047857"/>
   <Interior ss:Color="#D1FAE5" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="sBadgeRed">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="9.5" ss:Bold="1" ss:Color="#B91C1C"/>
   <Interior ss:Color="#FEE2E2" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="sBadgeAmber">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="9.5" ss:Bold="1" ss:Color="#B45309"/>
   <Interior ss:Color="#FEF3C7" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="sBadgeBlue">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="9.5" ss:Bold="1" ss:Color="#1D4ED8"/>
   <Interior ss:Color="#DBEAFE" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="sTotalLabel">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Double" ss:Weight="3" ss:Color="#002060"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#002060"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#002060"/>
   <Interior ss:Color="#E8F0FE" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="sTotalAmt">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Double" ss:Weight="3" ss:Color="#002060"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#002060"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#002060"/>
   <Interior ss:Color="#E8F0FE" ss:Pattern="Solid"/>
   <NumberFormat ss:Format="#,##0.00"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Chargeback Queue">
  <Table ss:DefaultRowHeight="20">
   ${colWidths.map((w) => `<Column ss:Width="${w}"/>`).join('\n   ')}
   <Row ss:Height="30">
    <Cell ss:MergeAcross="${colSpan}" ss:StyleID="sTitle"><Data ss:Type="String">PAYSONIC DISPUTE &amp; CHARGEBACK OPERATIONS — WORKING QUEUE</Data></Cell>
   </Row>
   <Row ss:Height="20">
    <Cell ss:MergeAcross="${colSpan}" ss:StyleID="sSubtitle"><Data ss:Type="String">Export Time: ${xmlEsc(fetchTimeStr)}   |   Total Queue Records: ${filteredRows.length}   |   Cumulative Dispute Amount: ₹ ${totalDisputeAmt.toFixed(2)}</Data></Cell>
   </Row>
   <Row ss:Height="4">
    ${Array(headers.length).fill('<Cell ss:StyleID="sGreenBar"/>').join('')}
   </Row>
   ${headerXml}
   ${dataXml}
   ${totalXml}
  </Table>
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
   <Selected/>
   <FreezePanes/>
   <FrozenNoSplit/>
   <SplitHorizontal>4</SplitHorizontal>
   <TopRowBottomPane>4</TopRowBottomPane>
   <ActivePane>2</ActivePane>
  </WorksheetOptions>
 </Worksheet>
</Workbook>`;

    const blob = new Blob([excelXml], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Chargeback_Working_Queue_${Date.now()}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleClearAllDisputes = async () => {
    if (window.confirm('Are you sure you want to clear all dispute records from Railway MySQL database? This will completely reset the dispute queue.')) {
      try {
        setLoading(true);
        await DisputeManagementService.clearAllDisputes();
        await loadData();
      } catch (err) {
        alert('Failed to clear dispute records: ' + err.message);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleCloseDispute = async (rowId) => {
    if (!window.confirm(`Are you sure you want to close dispute ${rowId}? This action will finalize the dispute.`)) {
      return;
    }
    try {
      const actorName = currentUser?.name || currentUser?.role || 'Master Admin';
      await DisputeManagementService.closeDispute(rowId, '', actorName);
      loadData();
    } catch (err) {
      alert(`Error closing dispute: ${err.message}`);
    }
  };

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
      if (sortConfig.field === 'plazaActionDate') {
        const timeA = a.decidedAt ? new Date(a.decidedAt).getTime() : (a.plazaActionTime ? 1 : 0);
        const timeB = b.decidedAt ? new Date(b.decidedAt).getTime() : (b.plazaActionTime ? 1 : 0);
        return sortConfig.direction === 'asc' ? timeA - timeB : timeB - timeA;
      }
      return 0;
    });
  }, [filteredRows, sortConfig]);

  const paginatedRows = useMemo(() => {
    if (!Array.isArray(sortedRows)) return [];
    const from = (currentPage - 1) * pageSize;
    return sortedRows.slice(from, from + pageSize);
  }, [sortedRows, currentPage, pageSize]);

  return (
    <div className="chargeback-assign-page">
      <div className="page-header-block">
        <div>
          <h1>Chargeback Assign</h1>
          <p className="subtitle">
            The single working queue for every dispute the acquirer needs to assign, track or review. Assign by row or bulk-assign by plaza to hand off for review.
          </p>
        </div>
        {(!currentUser?.role || currentUser.role === 'MASTER_ADMIN' || currentUser.role === 'ADMIN') && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleClearAllDisputes}
              title="Clear all dispute records from Railway database"
              style={{ color: '#ef4444', borderColor: '#fca5a5' }}
            >
              🗑️ Clear DB Disputes
            </button>
          </div>
        )}
      </div>

      {/* 6.1 Mini Dashboard (Top Strip) */}
      {miniStats && (
        <div className="mini-dashboard-grid">
          <div className="stat-box">
            <span>Unassigned Chargebacks</span>
            <strong style={{ color: '#dc2626' }}>{miniStats.unassigned}</strong>
            <small>Needs an owner plaza</small>
          </div>
          <div className="stat-box">
            <span>Assigned Chargebacks</span>
            <strong style={{ color: '#2563eb' }}>{miniStats.assigned}</strong>
            <small>With plaza for review</small>
          </div>
          <div className="stat-box">
            <span>Plaza Reverts Today</span>
            <strong style={{ color: '#16a34a' }}>{miniStats.plazaRevertsToday}</strong>
            <small>Decisions received today</small>
          </div>
          <div className="stat-box">
            <span>Approaching TAT (≤2 days)</span>
            <strong style={{ color: '#d97706' }}>{miniStats.approachingTat}</strong>
            <small>Urgent follow-up needed</small>
          </div>
          <div className="stat-box">
            <span>Total Dispute Value</span>
            <strong>
              ₹ {Number(miniStats.totalDisputeValue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </strong>
            <small>Across active disputes</small>
          </div>
        </div>
      )}

      {/* 6.2 Search Filters */}
      <div className="search-filters-card">
        <div className="card-title">Search &amp; Filter Queue</div>
        <div className="filters-grid">
          <div className="field-box">
            <label htmlFor="assignFromDate">From Date *</label>
            <input
              id="assignFromDate"
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          <div className="field-box">
            <label htmlFor="assignToDate">To Date *</label>
            <input
              id="assignToDate"
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          <div className="field-box">
            <label htmlFor="assignDateType">Date Type</label>
            <select
              id="assignDateType"
              value={dateType}
              onChange={(e) => {
                setDateType(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="Transaction DateTime">Transaction DateTime</option>
              <option value="Chargeback Date">Chargeback Date</option>
              <option value="Plaza Action Date">Plaza Action Date</option>
            </select>
          </div>

          <div className="field-box">
            <label htmlFor="assignFuncCode">Function Code</label>
            <select
              id="assignFuncCode"
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
            <label htmlFor="assignPlazaSelect">Toll Plaza ID</label>
            <select
              id="assignPlazaSelect"
              value={tollPlazaId}
              onChange={(e) => setTollPlazaId(e.target.value)}
              disabled={isPlazaLocked}
              title={isPlazaLocked ? `Locked to assigned plaza: ${assignedPlaza?.name || defaultPlazaId}` : 'Select Toll Plaza'}
            >
              {!isPlazaLocked && <option value="">--Select Toll Plaza Id--</option>}
              {plazas.map((p) => (
                <option key={p.id} value={p.id}>
                  {isPlazaLocked ? `🔒 ${p.name || p.codeLabel} - ${p.id} (Assigned Plaza)` : `${p.name || p.codeLabel} - ${p.id}`}
                </option>
              ))}
            </select>
          </div>

          <div className="field-box search-field-box">
            <label htmlFor="assignSearch">Search (Tag ID, RRN, Plaza Txn ID)</label>
            <div className="search-input-wrapper">
              <span className="search-icon">🔍</span>
              <input
                id="assignSearch"
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
        </div>

        <div className="filter-actions-row">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              const targetPlaza = isPlazaLocked ? (defaultPlazaId || '') : '';
              setFromDate('2026-09-01');
              setToDate('2026-10-31');
              setDateType('Transaction DateTime');
              setFunctionCode('');
              setTollPlazaId(targetPlaza);
              setSearchQuery('');
              loadData({
                fromDate: '2026-09-01',
                toDate: '2026-10-31',
                dateType: 'Transaction DateTime',
                functionCode: '',
                tollPlazaId: targetPlaza,
                search: '',
              });
            }}
          >
            Clear Filters
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => loadData({ search: searchQuery })}
          >
            Search
          </button>
        </div>
      </div>

      {/* 6.4 Dedicated Bulk Control Card */}
      <div className="bulk-control-card">
        <div className="card-top-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '8px' }}>
          <div>
            <div className="card-title">Bulk Assign / Unassign — by Plaza</div>
            <p className="bulk-hint">
              Pick one or more plazas and apply to every open row for those plazas in one go.
            </p>
          </div>
          <div className="plaza-selection-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-outline-primary btn-sm"
              onClick={handleSelectAllPlazas}
              title="Select all plazas"
              id="cbaSelectAllPlazasBtn"
              style={{ fontSize: '0.78rem', padding: '4px 10px', borderRadius: '6px' }}
            >
              ✓ Select All ({plazas.length})
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={handleUnselectAllPlazas}
              disabled={selectedPlazaChips.length === 0}
              title="Clear plaza selection"
              id="cbaUnselectAllPlazasBtn"
              style={{ fontSize: '0.78rem', padding: '4px 10px', borderRadius: '6px' }}
            >
              ✕ Unselect All
            </button>
            {selectedPlazaChips.length > 0 && (
              <span
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  backgroundColor: '#eff6ff',
                  color: '#1d4ed8',
                  padding: '3px 8px',
                  borderRadius: '12px',
                  border: '1px solid #bfdbfe',
                }}
              >
                {selectedPlazaChips.length} of {plazas.length} selected
              </span>
            )}
          </div>
        </div>

        <div className="plaza-chips-row">
          {plazas.map((p) => {
            const isPicked = selectedPlazaChips.includes(String(p.id));
            return (
              <button
                key={p.id}
                type="button"
                className={`chip-btn ${isPicked ? 'picked' : ''}`}
                onClick={() => togglePlazaChip(p.id)}
              >
                {p.name} - {p.id}
              </button>
            );
          })}
        </div>

        <div className="bulk-buttons-row">
          <button
            type="button"
            className="btn btn-success btn-sm"
            onClick={handleBulkAssign}
          >
            Assign Selected Plazas
          </button>
          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={handleBulkUnassign}
          >
            Unassign Selected Plazas
          </button>
          <button
            type="button"
            className="btn btn-outline-primary btn-sm"
            onClick={handleBulkDownloadPlazaEvidence}
            disabled={isDownloadingEvidence || (selectedPlazaChips.length === 0 && filteredRows.length === 0)}
            title="Download bulk evidence for all disputes in the selected plaza(s) organized into user folders"
            id="cbaBulkPlazaEvidenceDownloadBtn"
          >
            {isDownloadingEvidence ? '⏳ Downloading Evidence...' : '📥 Download Plaza Evidence (Bulk)'}
          </button>
          {bulkFeedback && <span className="feedback-msg">{bulkFeedback}</span>}
        </div>
      </div>

      {/* 6.3 Working Queue Table Area */}
      <div className="table-wrapper">
        <div className="table-top-bar">
          <div className="table-title">Chargeback Working Queue</div>
          <div className="top-bar-right-actions">
            <div className="table-quick-search">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Quick search Tag ID, RRN, Plaza Txn ID..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={() => {
                    setSearchQuery('');
                    setCurrentPage(1);
                  }}
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>
            <span className="record-count-text">
              Showing {filteredRows.length}{filteredRows.length !== rows.length ? ` of ${rows.length}` : ''} records
            </span>
            <button
              type="button"
              className="btn btn-outline-info btn-sm"
              onClick={() => handleBulkDownloadEvidence()}
              disabled={filteredRows.length === 0 || isDownloadingEvidence}
              id="cbaBulkEvidenceDownloadBtn"
              title={selectedRowIds.size > 0 ? `Download evidence for ${selectedRowIds.size} selected dispute(s) organized into user folders` : 'Download evidence for all current disputes organized into user folders'}
            >
              {isDownloadingEvidence ? '⏳ Downloading...' : '📥 Bulk Evidence Download'}
            </button>
            <button
              type="button"
              className="btn btn-outline-success btn-sm"
              onClick={handleExportExcel}
              disabled={filteredRows.length === 0}
              id="cbaExportExcelBtn"
              title="Export chargeback queue to Excel (.xls)"
            >
              Export Excel
            </button>
            <button
              type="button"
              className="btn btn-outline-primary btn-sm"
              onClick={handleExportCsv}
              disabled={filteredRows.length === 0}
              id="cbaExportCsvBtn"
              title="Export chargeback queue to CSV"
            >
              Export CSV
            </button>
          </div>
        </div>

        {/* Row Selection Action Bar */}
        {selectedRowIds.size > 0 && (
          <div className="table-selection-action-bar">
            <div className="selection-info">
              <span>✓ <strong>{selectedRowIds.size}</strong> dispute(s) selected</span>
              <button
                type="button"
                className="btn-link"
                onClick={() => setSelectedRowIds(new Set())}
              >
                Clear Selection
              </button>
            </div>
            <div className="selection-actions">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => handleBulkDownloadEvidence()}
                disabled={isDownloadingEvidence}
                id="cbaDownloadSelectedEvidenceBtn"
                title="Download bulk evidence files organized into user folders"
              >
                {isDownloadingEvidence ? '⏳ Downloading...' : `📥 Download Evidence (${selectedRowIds.size})`}
              </button>
              <button
                type="button"
                className="btn btn-success btn-sm"
                onClick={handleBulkAssignSelectedRows}
                title="Assign selected disputes to their plaza"
                id="cbaAssignSelectedRowsBtn"
              >
                ✓ Bulk Assign ({selectedRowIds.size})
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={handleBulkUnassignSelectedRows}
                title="Unassign selected disputes"
                id="cbaUnassignSelectedRowsBtn"
              >
                ✕ Bulk Unassign ({selectedRowIds.size})
              </button>
            </div>
          </div>
        )}

        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th style={{ width: '42px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    id="cbaSelectAllCheckbox"
                    checked={filteredRows.length > 0 && selectedRowIds.size === filteredRows.length}
                    onChange={handleToggleSelectAllRows}
                    title="Select all disputes"
                    style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                  />
                </th>
                <th>Assign Status</th>
                <th style={{ textAlign: 'center' }}>Action</th>
                <th>Acq Txn ID</th>
                <th>Toll Txn ID</th>
                <th>VRN</th>
                <th>Tag ID</th>
                <th>Toll Plaza</th>
                <th>Txn Date</th>
                <th>Dispute Raise Date</th>
                <th>TAT Due Date</th>
                <th>CB Reason</th>
                <th>Function Code</th>
                <th>Dispute Type</th>
                <th>Plaza Action</th>
                <th
                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onClick={() => handleSort('plazaActionDate')}
                  title="Click to sort by Plaza Action Date & Time"
                >
                  Plaza Action Date &amp; Time {sortConfig.field === 'plazaActionDate' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '↕'}
                </th>
                <th>Dispute Status</th>
                <th>Plaza Reason</th>
                <th style={{ textAlign: 'right' }}>Txn Amt</th>
                <th style={{ textAlign: 'right' }}>Dispute Amt</th>
                <th>TAT</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="21" style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                    Loading dispute queue...
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan="21" style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                    {searchQuery ? `No disputes match "${searchQuery}".` : 'No disputes found for the selected criteria.'}
                  </td>
                </tr>
              ) : (
                paginatedRows.map((r) => {
                  const tat = DisputeManagementService.getTatBadge(r);
                  const canClose = (r.disputeStatus === 'Approved' || r.disputeStatus === 'Rejected') && !r.closed;
                  const isSelected = selectedRowIds.has(String(r.rowId || r.disputeId));
                  const { disputeRaiseDate, tatDueDate } = resolveDisputeDates(r);
                  return (
                    <tr key={r.rowId} className={isSelected ? 'row-selected' : ''}>
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleRowSelect(r.rowId || r.disputeId)}
                          title={`Select dispute RRN: ${r.acqTxnId}`}
                          style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                        />
                      </td>
                      <td>
                        {r.closed ? (
                          <span className="badge badge-gray">Closed</span>
                        ) : r.lifecycleStatus === 'Plaza Accepted' ? (
                          <span className="badge badge-green">Plaza Accepted</span>
                        ) : r.lifecycleStatus === 'Plaza Rejected' ? (
                          <span className="badge badge-red">Plaza Rejected</span>
                        ) : r.assigned ? (
                          <span className="badge tag-assigned">Assigned to Plaza</span>
                        ) : (
                          <span className="badge tag-cb-assign">Pending Assignment</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                          <button
                            type="button"
                            className={`btn ${r.assigned ? 'btn-secondary' : 'btn-primary'} btn-sm`}
                            onClick={() => setCbModalRow(r)}
                          >
                            {r.assigned ? 'View' : 'CB Assign'}
                          </button>

                          {canClose && (
                            <button
                              type="button"
                              className="btn btn-outline-primary btn-sm"
                              onClick={() => handleCloseDispute(r.rowId)}
                              title="Close this dispute"
                              style={{ padding: '4px 8px', fontSize: '0.78rem' }}
                            >
                              Close
                            </button>
                          )}
                        </div>
                      </td>
                      <td>
                        <span
                          className="txn-link"
                          onClick={() => setTxnModalRow(r)}
                          title="Click to view Transaction Details"
                        >
                          {r.acqTxnId}
                        </span>
                      </td>
                      <td className="code-cell">{r.tollTxnId}</td>
                      <td style={{ fontWeight: 600 }}>{r.vrn}</td>
                      <td className="code-cell" style={{ whiteSpace: 'nowrap' }} title={r.tagId}>{r.tagId || '—'}</td>
                      <td>{r.plazaName} ({r.plazaId})</td>
                      <td>{r.txnDate}</td>
                      <td>{disputeRaiseDate}</td>
                      <td style={{ fontWeight: 600, color: '#0369a1' }}>{tatDueDate}</td>
                      <td>{r.cbReason}</td>
                      <td className="code-cell" style={{ textAlign: 'center' }}>{r.functionCode}</td>
                      <td>{r.disputeType}</td>
                      <td>
                        <span className={`badge ${r.plazaAction === 'Yes' ? 'badge-blue' : 'badge-gray'}`}>
                          {r.plazaAction === 'Yes' ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                        {r.plazaActionTime || '—'}
                      </td>
                      <td>
                        {r.disputeStatus === 'Approved' ? (
                          <span className="badge badge-green">Approved</span>
                        ) : r.disputeStatus === 'Rejected' ? (
                          <span className="badge badge-red">Rejected</span>
                        ) : (
                          <span className="badge badge-gray">NA</span>
                        )}
                      </td>
                      <td style={{ maxWidth: '200px' }} title={r.plazaReason || 'NA'}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {r.plazaReason || 'NA'}
                          </span>
                          {r.plazaReason && r.plazaReason !== 'NA' && r.plazaReason !== '—' && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (navigator?.clipboard?.writeText) {
                                  navigator.clipboard.writeText(r.plazaReason);
                                }
                              }}
                              title="Copy Plaza Remarks to clipboard"
                              style={{
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '1px 4px',
                                fontSize: '0.8rem',
                                opacity: 0.7,
                                flexShrink: 0,
                              }}
                            >
                              📋
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="amt-cell">₹ {Number(r.txnAmount || 0).toFixed(2)}</td>
                      <td className="bold-amt">₹ {Number(r.disputeAmount || 0).toFixed(2)}</td>
                      <td>
                        <span className={`badge ${tat.colorClass}`}>{tat.label}</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Pagination Bar */}
        <TablePagination
          totalItems={filteredRows.length}
          currentPage={currentPage}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
          pageSizeOptions={[10, 25, 50, 100]}
        />

        <div className="table-footer-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            Total disputes in working queue: <strong>{filteredRows.length}</strong>
            {filteredRows.length !== rows.length && (
              <span style={{ color: '#64748b', marginLeft: '6px' }}>
                (filtered from {rows.length})
              </span>
            )}
          </div>
          <div style={{ color: '#0369a1', fontWeight: 600 }}>
            <span>📥 Export Download Time: </span>
            <span style={{ fontFamily: 'monospace', color: downloadTime ? '#0369a1' : '#64748b', fontWeight: downloadTime ? 600 : 400 }}>
              {downloadTime || 'Not exported yet'}
            </span>
          </div>
        </div>
      </div>

      {/* Transaction Details Hyperlink Modal */}
      <TransactionDetailsModal
        isOpen={Boolean(txnModalRow)}
        onClose={() => setTxnModalRow(null)}
        disputeRow={txnModalRow}
      />

      {/* More Information Modal (CB Assign / View) */}
      <MoreInformationModal
        isOpen={Boolean(cbModalRow)}
        onClose={() => setCbModalRow(null)}
        disputeRow={cbModalRow}
        onUpdated={loadData}
      />
    </div>
  );
};

export default ChargebackAssign;
