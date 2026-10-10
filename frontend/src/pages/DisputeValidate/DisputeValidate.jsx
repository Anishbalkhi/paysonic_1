import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { FUNCTION_CODES } from '../../config/disputeConstants';
import DisputeManagementService from '../../services/dispute/DisputeManagementService';
import useOnboardedPlazas from '../../hooks/useOnboardedPlazas';
import { filterRecordsByPlazaScope } from '../../utils/plazaScopeUtils';
import TransactionDetailsModal from '../../components/DisputeModals/TransactionDetailsModal';
import TakeActionModal from '../../components/DisputeModals/TakeActionModal';
import ReportKpiGrid from '../../components/ReportKpiGrid/ReportKpiGrid';
import TablePagination from '../../components/common/TablePagination';
import { formatFetchTime } from '../../utils/dateUtils';
import './DisputeValidate.scss';

export const DisputeValidate = () => {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'Master Admin';
  const { plazas, isPlazaLocked, defaultPlazaId, assignedPlaza } = useOnboardedPlazas();
  const [selectedPlazaId, setSelectedPlazaId] = useState(
    isPlazaLocked ? (defaultPlazaId || 'ALL') : (currentUser?.plazaId || 'ALL')
  );

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [fetchTime, setFetchTime] = useState('');
  const [downloadTime, setDownloadTime] = useState('');

  useEffect(() => {
    if (isPlazaLocked && defaultPlazaId && selectedPlazaId !== defaultPlazaId) {
      setSelectedPlazaId(defaultPlazaId);
    }
  }, [isPlazaLocked, defaultPlazaId, selectedPlazaId]);

  const activePlazaId = isPlazaLocked ? (defaultPlazaId || selectedPlazaId) : (selectedPlazaId || 'ALL');
  const activePlaza =
    activePlazaId === 'ALL'
      ? { id: 'ALL', name: 'All Plazas' }
      : plazas.find((p) => String(p.id) === String(activePlazaId)) || {
          id: activePlazaId,
          name: assignedPlaza?.name || 'MUMBAI PLAZA NH-04',
        };

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters (Section 9)
  const [fromDate, setFromDate] = useState('2026-09-01');
  const [toDate, setToDate] = useState('2026-10-31');
  const [dateType, setDateType] = useState('Transaction DateTime');
  const [functionCode, setFunctionCode] = useState('');
  const [plazaAction, setPlazaAction] = useState('');
  const [disputeStatus, setDisputeStatus] = useState('');
  const [acqTxnId, setAcqTxnId] = useState('');
  const [tollTxnId, setTollTxnId] = useState('');
  const [tagId, setTagId] = useState('');

  // Modals state
  const [txnModalRow, setTxnModalRow] = useState(null);
  const [actionModalRow, setActionModalRow] = useState(null);

  const loadData = useCallback(async (overrides = {}) => {
    try {
      setLoading(true);
      const fDate = overrides.fromDate !== undefined ? overrides.fromDate : fromDate;
      const tDate = overrides.toDate !== undefined ? overrides.toDate : toDate;
      const dType = overrides.dateType !== undefined ? overrides.dateType : dateType;
      const fCode = overrides.functionCode !== undefined ? overrides.functionCode : functionCode;
      const pAct = overrides.plazaAction !== undefined ? overrides.plazaAction : plazaAction;
      const dStat = overrides.disputeStatus !== undefined ? overrides.disputeStatus : disputeStatus;
      const aTxn = overrides.acqTxnId !== undefined ? overrides.acqTxnId : acqTxnId;
      const tTxn = overrides.tollTxnId !== undefined ? overrides.tollTxnId : tollTxnId;
      const tId = overrides.tagId !== undefined ? overrides.tagId : tagId;

      const fetched = await DisputeManagementService.searchDisputes({
        scopedPlazaId: activePlazaId !== 'ALL' ? activePlazaId : undefined,
        fromDate: fDate,
        toDate: tDate,
        dateType: dType,
        functionCode: fCode,
        plazaAction: pAct,
        disputeStatus: dStat,
        acqTxnId: aTxn,
        tollTxnId: tTxn,
        tagId: tId,
      });
      const assignedRows = (fetched || []).filter((r) => {
        if (!r.assigned) return false;
        if (pAct === 'Yes') return r.plazaAction === 'Yes';
        if (pAct === 'No') return r.plazaAction !== 'Yes';
        if (dStat) return r.disputeStatus === dStat;
        // Spec rule: By default on Validate Dispute, acted disputes drop off this list
        return r.disputeStatus === 'NA' || !r.disputeStatus || r.disputeStatus === 'Pending';
      });
      const scopedRows = filterRecordsByPlazaScope(assignedRows, plazas, currentUser);
      setRows(scopedRows);
      setFetchTime(formatFetchTime(new Date()));
      setCurrentPage(1);
    } catch (e) {
      console.error('[DisputeValidate] Load error:', e);
    } finally {
      setLoading(false);
    }
  }, [activePlazaId, fromDate, toDate, dateType, functionCode, plazaAction, disputeStatus, acqTxnId, tollTxnId, tagId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Synchronize across browser tabs/windows when Master Admin assigns disputes
  useEffect(() => {
    const handleDisputesChange = () => {
      loadData();
    };
    window.addEventListener('paysonic:disputes_updated', handleDisputesChange);
    window.addEventListener('storage', handleDisputesChange);
    let bc;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel('paysonic_disputes_channel');
        bc.onmessage = () => loadData();
      } catch {}
    }
    return () => {
      window.removeEventListener('paysonic:disputes_updated', handleDisputesChange);
      window.removeEventListener('storage', handleDisputesChange);
      if (bc) bc.close();
    };
  }, [loadData]);

  const handleReset = () => {
    setFromDate('2026-09-01');
    setToDate('2026-10-31');
    setDateType('Transaction DateTime');
    setFunctionCode('');
    setPlazaAction('');
    setDisputeStatus('');
    setAcqTxnId('');
    setTollTxnId('');
    setTagId('');
    setCurrentPage(1);
    loadData({
      fromDate: '2026-09-01',
      toDate: '2026-10-31',
      dateType: 'Transaction DateTime',
      functionCode: '',
      plazaAction: '',
      disputeStatus: '',
      acqTxnId: '',
      tollTxnId: '',
      tagId: '',
    });
  };

  const paginatedRows = useMemo(() => {
    const from = (currentPage - 1) * pageSize;
    return rows.slice(from, from + pageSize);
  }, [rows, currentPage, pageSize]);

  const handleExportCsv = () => {
    if (!rows || rows.length === 0) return;
    const fetchTimeStr = formatFetchTime(new Date());
    setDownloadTime(fetchTimeStr);

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const headers = [
      'Acq Txn ID',
      'Toll Txn ID',
      'VRN',
      'Tag ID',
      'Toll Plaza ID',
      'Toll Plaza Name',
      'Txn Date',
      'Settlement Date',
      'TAT Due Date (T+8)',
      'CB Raised Date',
      'CB Reason',
      'Function Code',
      'Plaza Action',
      'Dispute Status',
      'Plaza Reason',
      'Dispute Amount',
      'SLA Status'
    ];

    const csvRows = rows.map((r) => {
      const tat = DisputeManagementService.getTatBadge(r);
      return [
        r.acqTxnId,
        r.tollTxnId,
        r.vrn,
        r.tagId,
        r.plazaId,
        r.plazaName,
        r.txnDate,
        r.settlementDate || '—',
        r.tatDueDate || '—',
        r.cbRaisedDate,
        r.cbReason,
        r.functionCode,
        r.plazaAction,
        r.disputeStatus,
        r.plazaReason,
        Number(r.disputeAmount || 0).toFixed(2),
        tat.label
      ].map(escapeCsv).join(',');
    });

    const totDispute = rows.reduce((s, r) => s + Number(r.disputeAmount || 0), 0).toFixed(2);

    const totalRow = Array(headers.length).fill('""');
    totalRow[0] = '"TOTAL"';
    totalRow[15] = `"${totDispute}"`;

    const bannerRows = [
      `"PAYSONIC DISPUTE MANAGEMENT — VALIDATE DISPUTES QUEUE"`,
      `"Plaza: ${activePlaza.name} (${activePlazaId})   |   Export Time: ${fetchTimeStr}   |   Assigned Disputes: ${rows.length}   |   Total Value: ₹ ${totDispute}"`,
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
    link.setAttribute('download', `Validate_Disputes_Plaza_${activePlazaId}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportExcel = () => {
    if (!rows || rows.length === 0) return;
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
      'Acq Txn ID',
      'Toll Txn ID',
      'VRN',
      'Tag ID',
      'Toll Plaza ID',
      'Toll Plaza Name',
      'Txn Date',
      'Settlement Date',
      'TAT Due Date (T+8)',
      'CB Raised Date',
      'CB Reason',
      'Function Code',
      'Plaza Action',
      'Dispute Status',
      'Plaza Reason',
      'Dispute Amount',
      'SLA Status'
    ];

    let dataXml = '';
    let totalDisputeAmt = 0;

    rows.forEach((r) => {
      const tat = DisputeManagementService.getTatBadge(r);
      const isAccepted = r.disputeStatus === 'Approved';
      const isRejected = r.disputeStatus === 'Rejected';
      const isDecided = isAccepted || isRejected;
      const statusStyle = isAccepted ? 'sBadgeGreen' : isRejected ? 'sBadgeRed' : 'sBadgeAmber';
      const actionStyle = r.plazaAction === 'Yes' ? 'sBadgeGreen' : 'sBadgeAmber';
      const tatStyle = tat.status === 'safe' ? 'sBadgeGreen' : tat.status === 'at-risk' ? 'sBadgeAmber' : tat.status === 'overdue' ? 'sBadgeRed' : 'sDataCenter';

      const dAmt = Number(r.disputeAmount || 0);
      totalDisputeAmt += dAmt;

      dataXml += `
      <Row ss:Height="21">
        <Cell ss:StyleID="sDataCenter"><Data ss:Type="String">${xmlEsc(r.acqTxnId)}</Data></Cell>
        <Cell ss:StyleID="sDataCenter"><Data ss:Type="String">${xmlEsc(r.tollTxnId)}</Data></Cell>
        <Cell ss:StyleID="sDataCenter"><Data ss:Type="String">${xmlEsc(r.vrn)}</Data></Cell>
        <Cell ss:StyleID="sDataCenter"><Data ss:Type="String">${xmlEsc(r.tagId)}</Data></Cell>
        <Cell ss:StyleID="sDataCenter"><Data ss:Type="String">${xmlEsc(r.plazaId)}</Data></Cell>
        <Cell ss:StyleID="sDataText"><Data ss:Type="String">${xmlEsc(r.plazaName)}</Data></Cell>
        <Cell ss:StyleID="sDataCenter"><Data ss:Type="String">${xmlEsc(r.txnDate)}</Data></Cell>
        <Cell ss:StyleID="sDataCenter"><Data ss:Type="String">${xmlEsc(r.settlementDate || '—')}</Data></Cell>
        <Cell ss:StyleID="sDataCenter"><Data ss:Type="String">${xmlEsc(r.tatDueDate || '—')}</Data></Cell>
        <Cell ss:StyleID="sDataCenter"><Data ss:Type="String">${xmlEsc(r.cbRaisedDate)}</Data></Cell>
        <Cell ss:StyleID="sDataText"><Data ss:Type="String">${xmlEsc(r.cbReason)}</Data></Cell>
        <Cell ss:StyleID="sDataCenter"><Data ss:Type="Number">${Number(r.functionCode || 0)}</Data></Cell>
        <Cell ss:StyleID="${actionStyle}"><Data ss:Type="String">${xmlEsc(r.plazaAction)}</Data></Cell>
        <Cell ss:StyleID="${statusStyle}"><Data ss:Type="String">${xmlEsc(r.disputeStatus)}</Data></Cell>
        <Cell ss:StyleID="sDataText"><Data ss:Type="String">${xmlEsc(r.plazaReason)}</Data></Cell>
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
        <Cell ss:StyleID="sTotalLabel" ss:MergeAcross="13"><Data ss:Type="String">Total Assigned Disputes: ${rows.length}</Data></Cell>
        <Cell ss:StyleID="sTotalAmt"><Data ss:Type="Number">${totalDisputeAmt}</Data></Cell>
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
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
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
 <Worksheet ss:Name="Validate Disputes">
  <Table>
   <Row ss:Height="32">
    <Cell ss:MergeAcross="${colSpan}" ss:StyleID="sTitle"><Data ss:Type="String">PAYSONIC DISPUTE MANAGEMENT — VALIDATE DISPUTES</Data></Cell>
   </Row>
   <Row ss:Height="20">
    <Cell ss:MergeAcross="${colSpan}" ss:StyleID="sSubtitle"><Data ss:Type="String">Toll Plaza: ${xmlEsc(activePlaza.name)} (${xmlEsc(activePlazaId)})   |   Export Time: ${xmlEsc(fetchTimeStr)}   |   Total Records: ${rows.length}   |   Total Value: ₹ ${totalDisputeAmt.toFixed(2)}</Data></Cell>
   </Row>
   <Row ss:Height="4">
    <Cell ss:MergeAcross="${colSpan}" ss:StyleID="sGreenBar"><Data ss:Type="String"></Data></Cell>
   </Row>
   <Row ss:Height="12"></Row>
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
    link.setAttribute('download', `Validate_Disputes_Plaza_${activePlazaId}_${Date.now()}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="dispute-validate-page">
      <div className="page-header-block" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1>Validate Dispute</h1>
          <p className="subtitle">
            Disputes assigned to plaza {activePlaza.name} ({activePlazaId}). Review the acquirer's evidence and reason, and submit your verified decision (Accept or Reject) with counter-evidence.
          </p>
        </div>
      </div>

      {/* Search Criteria Card */}
      <div className="search-criteria-card">
        <div className="card-title">Search Criteria</div>
        <div className="filters-grid">
          <div className="field-box">
            <label htmlFor="vdPlazaSelect">Toll Plaza</label>
            <select
              id="vdPlazaSelect"
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
            <label htmlFor="vdFromDate">From Date *</label>
            <input
              id="vdFromDate"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>

          <div className="field-box">
            <label htmlFor="vdToDate">To Date *</label>
            <input
              id="vdToDate"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>

          <div className="field-box">
            <label htmlFor="vdDateType">Date Type</label>
            <select
              id="vdDateType"
              value={dateType}
              onChange={(e) => setDateType(e.target.value)}
            >
              <option value="Transaction DateTime">Transaction DateTime</option>
              <option value="Chargeback Date">Chargeback Date</option>
            </select>
          </div>

          <div className="field-box">
            <label htmlFor="vdFuncCode">Function Code</label>
            <select
              id="vdFuncCode"
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
            <label htmlFor="vdPlazaAction">Plaza Action</label>
            <select
              id="vdPlazaAction"
              value={plazaAction}
              onChange={(e) => setPlazaAction(e.target.value)}
            >
              <option value="">Select Plaza Action</option>
              <option value="No">0 (No)</option>
              <option value="Yes">1 (Yes)</option>
            </select>
          </div>

          <div className="field-box">
            <label htmlFor="vdDisputeStatus">Dispute Status</label>
            <select
              id="vdDisputeStatus"
              value={disputeStatus}
              onChange={(e) => setDisputeStatus(e.target.value)}
            >
              <option value="">Select Dispute Status</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          <div className="field-box">
            <label htmlFor="vdAcqTxnId">Acq Txn ID</label>
            <input
              id="vdAcqTxnId"
              type="text"
              placeholder="Enter Acq Txn ID (partial match)"
              value={acqTxnId}
              onChange={(e) => setAcqTxnId(e.target.value)}
            />
          </div>

          <div className="field-box">
            <label htmlFor="vdTollTxnId">Toll Txn ID</label>
            <input
              id="vdTollTxnId"
              type="text"
              placeholder="Enter Toll Txn ID"
              value={tollTxnId}
              onChange={(e) => setTollTxnId(e.target.value)}
            />
          </div>

          <div className="field-box">
            <label htmlFor="vdTagId">Tag ID</label>
            <input
              id="vdTagId"
              type="text"
              placeholder="Enter Tag ID"
              value={tagId}
              onChange={(e) => setTagId(e.target.value)}
            />
          </div>
        </div>

        <div className="filter-actions-row">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleReset}
          >
            Reset
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={loadData}
          >
            Search
          </button>
        </div>
      </div>

      {/* Summary KPI Cards / Mini Dashboard */}
      <ReportKpiGrid
        cards={[
          {
            label: 'Total Assigned Disputes',
            value: rows.length,
            sub: `Plaza: ${activePlaza.name} (${activePlazaId})`
          },
          {
            label: 'Total Dispute Amount',
            value: `₹ ${rows.reduce((sum, r) => sum + Number(r.disputeAmount || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            sub: 'Cumulative Queue Value',
            highlight: 'blue'
          },
          {
            label: 'Pending Plaza Action',
            value: rows.filter(r => r.disputeStatus === 'NA').length,
            sub: `Decided: ${rows.filter(r => r.disputeStatus !== 'NA').length}`,
            highlight: rows.some(r => r.disputeStatus === 'NA') ? 'amber' : 'green'
          }
        ]}
      />

      {/* Export Toolbar */}
      <div className="table-toolbar-row">
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleExportCsv}
            disabled={!rows || rows.length === 0}
            id="valExportCsvBtn"
          >
            Export CSV
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleExportExcel}
            disabled={!rows || rows.length === 0}
            id="valExportExcelBtn"
          >
            Export Excel
          </button>
        </div>
        <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
          Showing {rows.length} assigned disputes
        </div>
      </div>

      {/* Data Table */}
      <div className="table-wrapper">
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th style={{ textAlign: 'center' }}>Take Action</th>
                <th>Acquirer Txn ID</th>
                <th>Toll Txn ID</th>
                <th>VRN</th>
                <th>Tag ID</th>
                <th>Toll Plaza</th>
                <th>Txn Date</th>
                <th>Settlement Date</th>
                <th>TAT Due Date</th>
                <th>CB Reason</th>
                <th>Function Code</th>
                <th>Plaza Action</th>
                <th>Dispute Status</th>
                <th style={{ textAlign: 'center' }}>Attachments</th>
                <th>SLA Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="15" style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                    Loading plaza disputes...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan="15" style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                    No disputes assigned to your plaza match the filters.
                  </td>
                </tr>
              ) : (
                paginatedRows.map((r) => {
                  const tat = DisputeManagementService.getTatBadge(r);
                  const isDecided = r.disputeStatus !== 'NA';
                  const adminEvCount = (r.adminEvidence || []).length;
                  const plazaEvCount = (r.plazaEvidence || []).length;
                  const hasAnyEvidence = adminEvCount > 0 || plazaEvCount > 0;

                  return (
                    <tr key={r.rowId}>
                      <td style={{ textAlign: 'center' }}>
                        {isDecided ? (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setActionModalRow(r)}
                          >
                            View
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => setActionModalRow(r)}
                          >
                            Take Action
                          </button>
                        )}
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
                      <td className="code-cell">{r.tagId ? `${r.tagId.slice(0, 10)}…` : '—'}</td>
                      <td>{r.plazaName ? `${r.plazaName} (${r.plazaId})` : `${activePlaza.name} (${r.plazaId})`}</td>
                      <td>{r.txnDate}</td>
                      <td>{r.settlementDate || r.cbRaisedDate || '—'}</td>
                      <td style={{ fontWeight: 600, color: '#0369a1' }}>{r.tatDueDate || '—'}</td>
                      <td>{r.cbReason}</td>
                      <td className="code-cell" style={{ textAlign: 'center' }}>{r.functionCode}</td>
                      <td>
                        <span className={`badge ${r.plazaAction === 'Yes' ? 'badge-blue' : 'badge-gray'}`}>
                          {r.plazaAction === 'Yes' ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td>
                        {r.disputeStatus === 'Approved' ? (
                          <span className="badge badge-green">Plaza Accepted</span>
                        ) : r.disputeStatus === 'Rejected' ? (
                          <span className="badge badge-red">Plaza Rejected</span>
                        ) : (
                          <span className="badge badge-gray">Pending Action</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {hasAnyEvidence ? (
                          <div
                            style={{
                              display: 'inline-flex',
                              gap: '4px',
                              cursor: 'pointer',
                            }}
                            onClick={() => setActionModalRow(r)}
                            title="Click to view all attachments"
                          >
                            {adminEvCount > 0 && (
                              <span
                                className="badge"
                                style={{ background: '#dbeafe', color: '#1e40af', fontSize: '0.7rem' }}
                              >
                                Acq 📎 {adminEvCount}
                              </span>
                            )}
                            {plazaEvCount > 0 && (
                              <span
                                className="badge"
                                style={{ background: '#dcfce7', color: '#166534', fontSize: '0.7rem' }}
                              >
                                Plaza 📎 {plazaEvCount}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>—</span>
                        )}
                      </td>
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
          totalItems={rows.length}
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
            Total records: <strong>{rows.length}</strong>
          </div>
          <div style={{ color: '#0369a1', fontWeight: 600 }}>
            <span>📥 Export Download Time: </span>
            <span style={{ fontFamily: 'monospace', color: downloadTime ? '#0369a1' : '#64748b', fontWeight: downloadTime ? 600 : 400 }}>
              {downloadTime || 'Not exported yet'}
            </span>
          </div>
        </div>
      </div>

      {/* Transaction Details Modal */}
      <TransactionDetailsModal
        isOpen={Boolean(txnModalRow)}
        onClose={() => setTxnModalRow(null)}
        disputeRow={txnModalRow}
      />

      {/* Take Action Modal */}
      <TakeActionModal
        isOpen={Boolean(actionModalRow)}
        onClose={() => setActionModalRow(null)}
        disputeRow={actionModalRow}
        onUpdated={loadData}
      />
    </div>
  );
};

export default DisputeValidate;
