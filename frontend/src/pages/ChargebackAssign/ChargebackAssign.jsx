import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { FUNCTION_CODES } from '../../config/disputeConstants';
import useOnboardedPlazas from '../../hooks/useOnboardedPlazas';
import { filterRecordsByPlazaScope } from '../../utils/plazaScopeUtils';
import DisputeManagementService from '../../services/dispute/DisputeManagementService';
import TransactionDetailsModal from '../../components/DisputeModals/TransactionDetailsModal';
import MoreInformationModal from '../../components/DisputeModals/MoreInformationModal';
import TablePagination from '../../components/common/TablePagination';
import { formatFetchTime } from '../../utils/dateUtils';
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
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [dateType, setDateType] = useState('');
  const [functionCode, setFunctionCode] = useState('');
  const [plazaAction, setPlazaAction] = useState('');
  const [assignStatus, setAssignStatus] = useState('');
  const [disputeStatus, setDisputeStatus] = useState('');
  const [tollPlazaId, setTollPlazaId] = useState(isPlazaLocked ? (defaultPlazaId || '') : '');

  useEffect(() => {
    if (isPlazaLocked && defaultPlazaId && tollPlazaId !== defaultPlazaId) {
      setTollPlazaId(defaultPlazaId);
    }
  }, [isPlazaLocked, defaultPlazaId, tollPlazaId]);

  // Bulk plaza selection chips
  const [selectedPlazaChips, setSelectedPlazaChips] = useState([]);
  const [bulkFeedback, setBulkFeedback] = useState('');

  // Modals state
  const [txnModalRow, setTxnModalRow] = useState(null);
  const [cbModalRow, setCbModalRow] = useState(null);

  const loadData = useCallback(async (overrides = {}) => {
    try {
      setLoading(true);
      const fDate = overrides.fromDate !== undefined ? overrides.fromDate : fromDate;
      const tDate = overrides.toDate !== undefined ? overrides.toDate : toDate;
      const dType = overrides.dateType !== undefined ? overrides.dateType : dateType;
      const fCode = overrides.functionCode !== undefined ? overrides.functionCode : functionCode;
      const pAct = overrides.plazaAction !== undefined ? overrides.plazaAction : plazaAction;
      const aStat = overrides.assignStatus !== undefined ? overrides.assignStatus : assignStatus;
      const dStat = overrides.disputeStatus !== undefined ? overrides.disputeStatus : disputeStatus;
      const pId = overrides.tollPlazaId !== undefined ? overrides.tollPlazaId : tollPlazaId;

      const [fetchedRows, stats] = await Promise.all([
        DisputeManagementService.searchDisputes({
          fromDate: fDate,
          toDate: tDate,
          dateType: dType,
          functionCode: fCode,
          plazaAction: pAct,
          assignStatus: aStat,
          disputeStatus: dStat,
          plazaId: pId,
        }),
        DisputeManagementService.getAdminMiniDashboardStats(),
      ]);
      const scopedRows = filterRecordsByPlazaScope(fetchedRows, plazas, currentUser);
      setRows(scopedRows);
      setMiniStats(stats);
      setFetchTime(formatFetchTime(new Date()));
      setCurrentPage(1);
    } catch (e) {
      console.error('[ChargebackAssign] Load error:', e);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, dateType, functionCode, plazaAction, assignStatus, disputeStatus, tollPlazaId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const togglePlazaChip = (plazaId) => {
    const idStr = String(plazaId);
    setSelectedPlazaChips((prev) =>
      prev.includes(idStr) ? prev.filter((p) => p !== idStr) : [...prev, idStr]
    );
  };

  const handleBulkAssign = async () => {
    if (selectedPlazaChips.length === 0) {
      setBulkFeedback('Please pick at least one plaza chip first.');
      return;
    }
    const { updatedCount } = await DisputeManagementService.bulkAssignPlazas(selectedPlazaChips);
    setBulkFeedback(`✓ ${updatedCount} row(s) assigned across ${selectedPlazaChips.length} plaza(s).`);
    loadData();
  };

  const handleBulkUnassign = async () => {
    if (selectedPlazaChips.length === 0) {
      setBulkFeedback('Please pick at least one plaza chip first.');
      return;
    }
    const { updatedCount } = await DisputeManagementService.bulkUnassignPlazas(selectedPlazaChips);
    setBulkFeedback(`✓ ${updatedCount} open row(s) unassigned. Decided rows were kept.`);
    loadData();
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

  // Export CSV directly matching current filtered records
  const handleExportCsv = () => {
    if (!rows || rows.length === 0) return;
    setDownloadTime(formatFetchTime(new Date()));

    const headers = [
      'Assign Status',
      'Acq Txn ID',
      'Toll Txn ID',
      'VRN',
      'Tag ID',
      'Toll Plaza Name',
      'Toll Plaza ID',
      'Txn Date',
      'Settlement Date',
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

    const csvRows = rows.map((r) => {
      const tat = DisputeManagementService.getTatBadge(r);
      return [
        r.lifecycleStatus || (r.assigned ? 'Assigned' : 'Unassigned'),
        r.acqTxnId,
        r.tollTxnId,
        r.vrn,
        r.tagId,
        r.plazaName,
        r.plazaId,
        r.txnDate,
        r.settlementDate || '—',
        r.tatDueDate || '—',
        r.cbRaisedDate,
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

    const csvContent = '\uFEFF' + [headers.map(escapeCsv).join(','), ...csvRows].join('\r\n');
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

  // Export Excel directly matching current filtered records with real onboarded plazas
  const handleExportExcel = () => {
    if (!rows || rows.length === 0) return;
    setDownloadTime(formatFetchTime(new Date()));

    const xmlEsc = (str) =>
      String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

    const headers = [
      'Assign Status', 'Acq Txn ID', 'Toll Txn ID', 'VRN', 'Tag ID',
      'Toll Plaza Name', 'Toll Plaza ID', 'Txn Date', 'Settlement Date', 'TAT Due Date (T+8)',
      'CB Raised Date', 'CB Reason', 'Function Code', 'Dispute Type', 'Plaza Action',
      'Plaza Action Date & Time', 'Dispute Status', 'Plaza Reason', 'Txn Amount', 'Dispute Amount', 'TAT'
    ];

    let dataXml = '';
    rows.forEach((r) => {
      const tat = DisputeManagementService.getTatBadge(r);
      dataXml += `
      <Row ss:Height="20">
        <Cell><Data ss:Type="String">${xmlEsc(r.lifecycleStatus || (r.assigned ? 'Assigned' : 'Unassigned'))}</Data></Cell>
        <Cell><Data ss:Type="String">${xmlEsc(r.acqTxnId)}</Data></Cell>
        <Cell><Data ss:Type="String">${xmlEsc(r.tollTxnId)}</Data></Cell>
        <Cell><Data ss:Type="String">${xmlEsc(r.vrn)}</Data></Cell>
        <Cell><Data ss:Type="String">${xmlEsc(r.tagId)}</Data></Cell>
        <Cell><Data ss:Type="String">${xmlEsc(r.plazaName)}</Data></Cell>
        <Cell><Data ss:Type="String">${xmlEsc(r.plazaId)}</Data></Cell>
        <Cell><Data ss:Type="String">${xmlEsc(r.txnDate)}</Data></Cell>
        <Cell><Data ss:Type="String">${xmlEsc(r.settlementDate || '—')}</Data></Cell>
        <Cell><Data ss:Type="String">${xmlEsc(r.tatDueDate || '—')}</Data></Cell>
        <Cell><Data ss:Type="String">${xmlEsc(r.cbRaisedDate)}</Data></Cell>
        <Cell><Data ss:Type="String">${xmlEsc(r.cbReason)}</Data></Cell>
        <Cell><Data ss:Type="Number">${Number(r.functionCode || 0)}</Data></Cell>
        <Cell><Data ss:Type="String">${xmlEsc(r.disputeType)}</Data></Cell>
        <Cell><Data ss:Type="String">${xmlEsc(r.plazaAction === 'Yes' ? 'Yes' : 'No')}</Data></Cell>
        <Cell><Data ss:Type="String">${xmlEsc(r.plazaActionTime || '—')}</Data></Cell>
        <Cell><Data ss:Type="String">${xmlEsc(r.disputeStatus)}</Data></Cell>
        <Cell><Data ss:Type="String">${xmlEsc(r.plazaReason)}</Data></Cell>
        <Cell><Data ss:Type="Number">${Number(r.txnAmount || 0)}</Data></Cell>
        <Cell><Data ss:Type="Number">${Number(r.disputeAmount || 0)}</Data></Cell>
        <Cell><Data ss:Type="String">${xmlEsc(tat.label)}</Data></Cell>
      </Row>`;
    });

    const headerXml = `
      <Row ss:Height="24">
        ${headers.map((h) => `<Cell><Data ss:Type="String">${xmlEsc(h)}</Data></Cell>`).join('')}
      </Row>`;

    const excelXml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Chargeback Queue">
  <Table>
   ${headerXml}
   ${dataXml}
  </Table>
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

  const handleCloseDispute = async (rowId) => {
    if (!window.confirm(`Are you sure you want to close dispute ${rowId}? This action will finalize the dispute.`)) {
      return;
    }
    try {
      const actorName = currentUser?.name || currentUser?.role || 'Master Admin';
      await DisputeManagementService.closeDispute(rowId, actorName);
      loadData();
    } catch (err) {
      alert(`Error closing dispute: ${err.message}`);
    }
  };

  // Sorting state
  const [sortConfig, setSortConfig] = useState({ field: null, direction: 'asc' });

  const handleSort = (field) => {
    setSortConfig((prev) => {
      if (prev.field === field) {
        return { field, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { field, direction: 'desc' };
    });
  };

  const sortedRows = useMemo(() => {
    if (!sortConfig.field) return rows;
    return [...rows].sort((a, b) => {
      if (sortConfig.field === 'plazaActionDate') {
        const timeA = a.decidedAt ? new Date(a.decidedAt).getTime() : (a.plazaActionTime ? 1 : 0);
        const timeB = b.decidedAt ? new Date(b.decidedAt).getTime() : (b.plazaActionTime ? 1 : 0);
        return sortConfig.direction === 'asc' ? timeA - timeB : timeB - timeA;
      }
      return 0;
    });
  }, [rows, sortConfig]);

  const paginatedRows = useMemo(() => {
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
            <strong style={{ color: '#0f172a' }}>
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
            <label htmlFor="assignFromDate">From Date</label>
            <input
              id="assignFromDate"
              type="text"
              placeholder="dd-mm-yyyy hh:mm:ss"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>

          <div className="field-box">
            <label htmlFor="assignToDate">To Date</label>
            <input
              id="assignToDate"
              type="text"
              placeholder="dd-mm-yyyy hh:mm:ss"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>

          <div className="field-box">
            <label htmlFor="assignDateType">Date Type</label>
            <select
              id="assignDateType"
              value={dateType}
              onChange={(e) => setDateType(e.target.value)}
            >
              <option value="">Select Date Type</option>
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
            <label htmlFor="assignPlazaAction">Plaza Action</label>
            <select
              id="assignPlazaAction"
              value={plazaAction}
              onChange={(e) => setPlazaAction(e.target.value)}
            >
              <option value="">Select Plaza Action</option>
              <option value="No">0 (No)</option>
              <option value="Yes">1 (Yes)</option>
            </select>
          </div>

          <div className="field-box">
            <label htmlFor="assignStatusSelect">Assign Status</label>
            <select
              id="assignStatusSelect"
              value={assignStatus}
              onChange={(e) => setAssignStatus(e.target.value)}
            >
              <option value="">Select Assign Status</option>
              <option value="Assigned">Assigned</option>
              <option value="Unassigned">UnAssigned</option>
            </select>
          </div>

          <div className="field-box">
            <label htmlFor="assignDisputeStatus">Dispute Status</label>
            <select
              id="assignDisputeStatus"
              value={disputeStatus}
              onChange={(e) => setDisputeStatus(e.target.value)}
            >
              <option value="">Select Dispute Status</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
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
        </div>

        <div className="filter-actions-row">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              const targetPlaza = isPlazaLocked ? (defaultPlazaId || '') : '';
              setFromDate('');
              setToDate('');
              setDateType('');
              setFunctionCode('');
              setPlazaAction('');
              setAssignStatus('');
              setDisputeStatus('');
              setTollPlazaId(targetPlaza);
              loadData({
                fromDate: '',
                toDate: '',
                dateType: '',
                functionCode: '',
                plazaAction: '',
                assignStatus: '',
                disputeStatus: '',
                tollPlazaId: targetPlaza,
              });
            }}
          >
            Clear Filters
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => loadData()}
          >
            Search
          </button>
        </div>
      </div>

      {/* 6.4 Dedicated Bulk Control Card */}
      <div className="bulk-control-card">
        <div className="card-title">Bulk Assign / Unassign — by Plaza</div>
        <p className="bulk-hint">
          Pick one or more plazas and apply to every currently-filtered, unassigned row for those plazas in one go.
        </p>

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
          {bulkFeedback && <span className="feedback-msg">{bulkFeedback}</span>}
        </div>
      </div>

      {/* 6.3 Working Queue Table Area */}
      <div className="table-wrapper">
        <div className="table-top-bar">
          <div className="table-title">Chargeback Working Queue</div>
          <div className="top-bar-right-actions">
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
              Showing {rows.length} records
            </span>
            <button
              type="button"
              className="btn btn-outline-success btn-sm"
              onClick={handleExportExcel}
              disabled={rows.length === 0}
              id="cbaExportExcelBtn"
              title="Export chargeback queue to Excel (.xls)"
            >
              Export Excel
            </button>
            <button
              type="button"
              className="btn btn-outline-primary btn-sm"
              onClick={handleExportCsv}
              disabled={rows.length === 0}
              id="cbaExportCsvBtn"
              title="Export chargeback queue to CSV"
            >
              Export CSV
            </button>
          </div>
        </div>

        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Assign Status</th>
                <th>Acq Txn ID</th>
                <th>Toll Txn ID</th>
                <th>VRN</th>
                <th>Tag ID</th>
                <th>Toll Plaza</th>
                <th>Txn Date</th>
                <th>Settlement Date</th>
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
                <th style={{ textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="20" style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                    Loading dispute queue...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan="20" style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                    No disputes found for the selected criteria.
                  </td>
                </tr>
              ) : (
                paginatedRows.map((r) => {
                  const tat = DisputeManagementService.getTatBadge(r);
                  const canClose = (r.disputeStatus === 'Approved' || r.disputeStatus === 'Rejected') && !r.closed;
                  return (
                    <tr key={r.rowId}>
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
                      <td>{r.plazaName} ({r.plazaId})</td>
                      <td>{r.txnDate}</td>
                      <td>{r.settlementDate || r.cbRaisedDate || '—'}</td>
                      <td style={{ fontWeight: 600, color: '#0369a1' }}>{r.tatDueDate || '—'}</td>
                      <td>{r.cbReason}</td>
                      <td className="code-cell" style={{ textAlign: 'center' }}>{r.functionCode}</td>
                      <td>{r.disputeType}</td>
                      <td>
                        <span className={`badge ${r.plazaAction === 'Yes' ? 'badge-blue' : 'badge-gray'}`}>
                          {r.plazaAction === 'Yes' ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.82rem', whiteSpace: 'nowrap', color: '#0f172a' }}>
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
                      <td style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {r.plazaReason}
                      </td>
                      <td className="amt-cell">₹ {Number(r.txnAmount || 0).toFixed(2)}</td>
                      <td className="bold-amt">₹ {Number(r.disputeAmount || 0).toFixed(2)}</td>
                      <td>
                        <span className={`badge ${tat.colorClass}`}>{tat.label}</span>
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
            Total disputes in working queue: <strong>{rows.length}</strong>
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
