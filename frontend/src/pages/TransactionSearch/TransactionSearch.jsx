import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import TransactionSearchNormalService from '../../services/transactionSearch/TransactionSearchNormalService';
import TransactionSearchDisputeService from '../../services/transactionSearch/TransactionSearchDisputeService';
import useOnboardedPlazas from '../../hooks/useOnboardedPlazas';
import { useAuth } from '../../context/AuthContext';
import { filterRecordsByPlazaScope } from '../../utils/plazaScopeUtils';
import { normalizePlazaForRecord } from '../../utils/plazaNormalizer';
import { formatFetchTime } from '../../utils/dateUtils';
import ReportKpiGrid from '../../components/ReportKpiGrid/ReportKpiGrid';
import './TransactionSearch.scss';

export const TransactionSearch = () => {
  const { currentUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { plazas, isPlazaLocked, defaultPlazaId, assignedPlaza } = useOnboardedPlazas();

  // Mode: 'NORMAL' vs 'DISPUTE' (synced with ?type= URL search param)
  const initialType = (searchParams.get('type') || '').toLowerCase() === 'dispute' ? 'DISPUTE' : 'NORMAL';
  const [txnType, setTxnType] = useState(initialType);

  // Sync state if URL changes externally
  useEffect(() => {
    const qType = (searchParams.get('type') || '').toLowerCase();
    if (qType === 'dispute' && txnType !== 'DISPUTE') {
      setTxnType('DISPUTE');
    } else if (qType === 'normal' && txnType !== 'NORMAL') {
      setTxnType('NORMAL');
    }
  }, [searchParams]);

  // Default date ranges
  const getDefaultDateRange = () => ({
    from: '2026-08-01T00:00:00',
    to: '2026-09-30T23:59:59'
  });

  const initialRange = getDefaultDateRange();
  const [fromDate, setFromDate] = useState(initialRange.from);
  const [toDate, setToDate] = useState(initialRange.to);
  const [plazaId, setPlazaId] = useState(isPlazaLocked ? (defaultPlazaId || 'ALL') : 'ALL');

  useEffect(() => {
    if (isPlazaLocked && defaultPlazaId && plazaId !== defaultPlazaId) {
      setPlazaId(defaultPlazaId);
    }
  }, [isPlazaLocked, defaultPlazaId, plazaId]);

  // Normal-specific filter
  const [normalStatus, setNormalStatus] = useState('ALL');

  // Dispute-specific filter
  const [disputeFuncCode, setDisputeFuncCode] = useState('ALL');

  // Shared search term across table
  const [searchTerm, setSearchTerm] = useState('');

  // Records & Pagination
  const [records, setRecords] = useState([]);
  const [fetchTime, setFetchTime] = useState('');
  const [downloadTime, setDownloadTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [serverSummary, setServerSummary] = useState(null);

  // Date range validation
  const validateDates = (start, end) => {
    if (!start || !end) {
      setErrorMsg('Both From Date and To Date are required.');
      return false;
    }
    const fromTime = new Date(start).getTime();
    const toTime = new Date(end).getTime();

    if (fromTime > toTime) {
      setErrorMsg('From Date cannot be later than To Date.');
      return false;
    }

    setErrorMsg('');
    return true;
  };

  // Switch between Normal and Disputed
  const handleTypeChange = (newType) => {
    if (newType === txnType) return;
    setTxnType(newType);
    setSearchParams({ type: newType.toLowerCase() });
    setRecords([]);
    setPage(0);
    setErrorMsg('');
  };

  // Perform search based on active mode
  const handleSearch = useCallback(async (newPage = 0, newSize = pageSize, overrides = {}) => {
    const currentMode = overrides.txnType !== undefined ? overrides.txnType : txnType;
    const fDate = overrides.fromDate !== undefined ? overrides.fromDate : fromDate;
    const tDate = overrides.toDate !== undefined ? overrides.toDate : toDate;
    const pId = overrides.plazaId !== undefined ? overrides.plazaId : plazaId;
    const nStatus = overrides.normalStatus !== undefined ? overrides.normalStatus : normalStatus;
    const dCode = overrides.disputeFuncCode !== undefined ? overrides.disputeFuncCode : disputeFuncCode;
    const sTerm = overrides.searchTerm !== undefined ? overrides.searchTerm : searchTerm;

    if (!validateDates(fDate, tDate)) return;

    setLoading(true);
    setErrorMsg('');

    if (currentMode === 'NORMAL') {
      try {
        const data = await TransactionSearchNormalService.search({
          fromDate: fDate,
          toDate: tDate,
          plazaId: pId,
          status: nStatus,
          vrn: sTerm.trim() || undefined,
          tagId: sTerm.trim() || undefined,
          acqTxnId: sTerm.trim() || undefined,
          page: newPage,
          size: newSize
        });

        let content = data?.content || (Array.isArray(data) ? data : []);
        content = filterRecordsByPlazaScope(content, plazas, currentUser);
        setRecords(content);
        setTotalElements(data?.totalElements ?? content.length);
        setTotalPages(data?.totalPages ?? (content.length > 0 ? 1 : 0));
        setPage(data?.number ?? 0);
        if (data?.summary) {
          setServerSummary(data.summary);
        }
        setFetchTime(formatFetchTime(new Date()));
      } catch (err) {
        console.error('[TransactionSearch] Normal query failed:', err);
        const msg = err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Database error occurred';
        setErrorMsg(`Normal Transactions Query Error: ${msg}`);
        setRecords([]);
        setTotalElements(0);
        setTotalPages(0);
      } finally {
        setLoading(false);
      }
    } else {
      // DISPUTE Mode
      try {
        const data = await TransactionSearchDisputeService.searchDisputes({
          fromDate: fDate,
          toDate: tDate,
          plazaId: pId,
          functionCode: dCode,
          page: newPage,
          size: newSize
        });

        let content = data?.content ? data.content : Array.isArray(data) ? data : [];
        content = filterRecordsByPlazaScope(content, plazas, currentUser);
        setRecords(content);
        setTotalElements(data?.totalElements ?? content.length);
        setTotalPages(data?.totalPages ?? (content.length > 0 ? 1 : 0));
        setPage(data?.number ?? 0);
        setFetchTime(formatFetchTime(new Date()));
      } catch (err) {
        console.error('[TransactionSearch] Dispute query failed:', err);
        const msg = err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Database error occurred';
        setErrorMsg(`Dispute Transactions Query Error: ${msg}`);
        setRecords([]);
        setTotalElements(0);
        setTotalPages(0);
      } finally {
        setLoading(false);
      }
    }
  }, [txnType, fromDate, toDate, plazaId, normalStatus, disputeFuncCode, searchTerm, pageSize]);

  // Trigger search on mount and when transaction type switches
  useEffect(() => {
    handleSearch(0, pageSize);
  }, [txnType]);

  const handleReset = () => {
    const def = getDefaultDateRange();
    const targetPlaza = isPlazaLocked ? (defaultPlazaId || 'ALL') : 'ALL';
    setFromDate(def.from);
    setToDate(def.to);
    setPlazaId(targetPlaza);
    setNormalStatus('ALL');
    setDisputeFuncCode('ALL');
    setSearchTerm('');
    handleSearch(0, pageSize, {
      fromDate: def.from,
      toDate: def.to,
      plazaId: targetPlaza,
      normalStatus: 'ALL',
      disputeFuncCode: 'ALL',
      searchTerm: ''
    });
  };

  const handlePageChange = (newPage) => {
    if (newPage < 0 || newPage >= totalPages || newPage === page) return;
    handleSearch(newPage, pageSize);
  };

  const handlePageSizeChange = (e) => {
    const newSize = Number(e.target.value);
    setPageSize(newSize);
    handleSearch(0, newSize);
  };

  // Excel export
  const handleExportExcel = async () => {
    if (records.length === 0) return;
    setExportingExcel(true);
    try {
      if (txnType === 'NORMAL') {
        await TransactionSearchNormalService.exportExcel({
          fromDate,
          toDate,
          plazaId,
          status: normalStatus,
          vrn: searchTerm.trim() || undefined,
          tagId: searchTerm.trim() || undefined,
          acqTxnId: searchTerm.trim() || undefined
        });
      } else {
        await TransactionSearchDisputeService.exportExcel({
          fromDate,
          toDate,
          plazaId,
          functionCode: disputeFuncCode
        });
      }
      setDownloadTime(formatFetchTime(new Date()));
    } catch (err) {
      console.error('[TransactionSearch] Excel export failed:', err);
      setErrorMsg('Export failed. Please verify live database connection.');
    } finally {
      setExportingExcel(false);
    }
  };

  // CSV export
  const handleExportCsv = async () => {
    if (records.length === 0) return;
    setExportingCsv(true);
    try {
      if (txnType === 'NORMAL') {
        await TransactionSearchNormalService.exportCsv({
          fromDate,
          toDate,
          plazaId,
          status: normalStatus,
          vrn: searchTerm.trim() || undefined,
          tagId: searchTerm.trim() || undefined,
          acqTxnId: searchTerm.trim() || undefined
        });
      } else {
        await TransactionSearchDisputeService.exportCsv({
          fromDate,
          toDate,
          plazaId,
          functionCode: disputeFuncCode
        });
      }
      setDownloadTime(formatFetchTime(new Date()));
    } catch (err) {
      console.error('[TransactionSearch] CSV export failed:', err);
      setErrorMsg('Export failed. Please verify live database connection.');
    } finally {
      setExportingCsv(false);
    }
  };

  // Client-side quick filter
  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const term = searchTerm.toLowerCase().trim();

    return records.filter((r) => {
      if (txnType === 'NORMAL') {
        return (
          (r.vehicleNo && r.vehicleNo.toLowerCase().includes(term)) ||
          (r.tagId && r.tagId.toLowerCase().includes(term)) ||
          (r.acqTxnId && r.acqTxnId.toLowerCase().includes(term)) ||
          (r.tollTxnId && r.tollTxnId.toLowerCase().includes(term)) ||
          (r.plazaName && r.plazaName.toLowerCase().includes(term)) ||
          (r.plazaId && String(r.plazaId).toLowerCase().includes(term)) ||
          (r.laneId && r.laneId.toLowerCase().includes(term)) ||
          (r.status && r.status.toLowerCase().includes(term)) ||
          (r.reason && r.reason.toLowerCase().includes(term))
        );
      } else {
        return (
          (r.vehicleNo && r.vehicleNo.toLowerCase().includes(term)) ||
          (r.tagId && r.tagId.toLowerCase().includes(term)) ||
          (r.tid && r.tid.toLowerCase().includes(term)) ||
          (r.acqTxnId && r.acqTxnId.toLowerCase().includes(term)) ||
          (r.tollTxnId && r.tollTxnId.toLowerCase().includes(term)) ||
          (r.plazaName && r.plazaName.toLowerCase().includes(term)) ||
          (r.plazaId && String(r.plazaId).toLowerCase().includes(term)) ||
          (r.settlementType && r.settlementType.toLowerCase().includes(term)) ||
          (r.functionCode && r.functionCode.toLowerCase().includes(term)) ||
          (r.fullParticulars && r.fullParticulars.toLowerCase().includes(term))
        );
      }
    });
  }, [records, searchTerm, txnType]);

  // Summary KPIs for Normal Transactions
  const normalKpiSummary = useMemo(() => {
    if (serverSummary) {
      return {
        totalTxn: serverSummary.totalTxn ?? totalElements,
        totalAmt: Number(serverSummary.totalAmt || 0).toFixed(2),
        acceptedTxn: serverSummary.acceptedTxn ?? 0,
        declinedRejectedTxn: serverSummary.declinedRejectedTxn ?? 0
      };
    }
    let totalAmt = 0;
    let accepted = 0;
    let declinedRejected = 0;

    filteredRecords.forEach((r) => {
      const amt = Number(r.txnAmount || 0);
      if (!isNaN(amt)) totalAmt += amt;
      const st = (r.status || '').toUpperCase();
      if (st === 'ACCEPTED' || st === 'SUCCESS') {
        accepted++;
      } else if (st === 'DECLINED' || st === 'REJECTED' || st === 'FAILED') {
        declinedRejected++;
      }
    });

    return {
      totalTxn: totalElements || filteredRecords.length,
      totalAmt: totalAmt.toFixed(2),
      acceptedTxn: accepted,
      declinedRejectedTxn: declinedRejected
    };
  }, [filteredRecords, serverSummary, totalElements]);

  // Date formatters
  const formatDateDisplay = (dateVal) => {
    if (!dateVal) return '';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return dateVal;
      const pad = (n) => String(n).padStart(2, '0');
      return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    } catch {
      return dateVal;
    }
  };

  const formatSubtitleDate = (dateVal) => {
    if (!dateVal) return '';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return dateVal;
      const pad = (n) => String(n).padStart(2, '0');
      return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    } catch {
      return dateVal;
    }
  };

  const dateSubtitle = useMemo(() => {
    return `From Date: ${formatSubtitleDate(fromDate)} | To Date: ${formatSubtitleDate(toDate)}`;
  }, [fromDate, toDate]);

  const extractCode = (desc) => {
    if (!desc) return '';
    const colonIdx = desc.indexOf(':');
    return colonIdx > 0 ? desc.substring(0, colonIdx).trim() : desc.trim();
  };

  const searchKpis = useMemo(() => {
    if (txnType === 'NORMAL') {
      const totalAmt = filteredRecords.reduce((sum, r) => sum + Number(r.txnAmount || r.amount || 0), 0);
      const successCount = filteredRecords.filter((r) => {
        const s = String(r.status || '').toUpperCase();
        return s === 'SUCCESS' || s === 'ACCEPTED' || s === 'SETTLED';
      }).length;
      return {
        count: totalElements || filteredRecords.length,
        totalAmt: totalAmt.toFixed(2),
        successCount,
        breakdownLabel: 'Success / Processed',
        breakdownValue: `${successCount} / ${filteredRecords.length}`,
        endpoint: 'toll_transactions'
      };
    } else {
      const totalAmt = filteredRecords.reduce((sum, r) => sum + Number(r.disputeAmount || r.adjustmentAmount || 0), 0);
      const debitCount = filteredRecords.filter((r) => String(r.functionCode || '').includes('753') || String(r.functionCode || '').toLowerCase().includes('debit')).length;
      const creditCount = filteredRecords.length - debitCount;
      return {
        count: totalElements || filteredRecords.length,
        totalAmt: totalAmt.toFixed(2),
        breakdownLabel: 'Debit / Credit Adj',
        breakdownValue: `${debitCount} / ${creditCount}`,
        endpoint: 'dispute_transactions'
      };
    }
  }, [txnType, filteredRecords, totalElements]);

  return (
    <div className="transaction-search-page">
      {/* 1. Header Banner */}
      <div className="report-header-banner">
        <h1 className="report-title">
          {txnType === 'NORMAL' ? 'TRANSACTION SEARCH' : 'TRANSACTION SEARCH - DISPUTE TRANSACTION'}
        </h1>
        <div className="report-subtitle">
          <span>{dateSubtitle}</span>
        </div>
        <div className="report-green-accent-bar" />
      </div>

      {/* 2. Filter & Controls Card */}
      <div className="filter-card">
        {/* Top Type Selector Filter / Tabs */}
        <div className="type-toggle-header">
          <span className="type-toggle-label">Transaction Type:</span>
          <div className="type-toggle-buttons">
            <button
              type="button"
              className={`type-btn ${txnType === 'NORMAL' ? 'active' : ''}`}
              onClick={() => handleTypeChange('NORMAL')}
              id="btnSelectNormalTxn"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              Normal Transaction
            </button>
            <button
              type="button"
              className={`type-btn ${txnType === 'DISPUTE' ? 'active' : ''}`}
              onClick={() => handleTypeChange('DISPUTE')}
              id="btnSelectDisputeTxn"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              Disputed Transaction
            </button>
          </div>
        </div>

        {/* Filter Inputs Grid */}
        <div className="filter-row">
          <div className="filter-group">
            <label className="filter-label">From Date</label>
            <input
              type="datetime-local"
              className="filter-input"
              value={fromDate ? fromDate.slice(0, 19) : ''}
              onChange={(e) => setFromDate(e.target.value)}
              id="filterFromDate"
            />
          </div>

          <div className="filter-group">
            <label className="filter-label">To Date</label>
            <input
              type="datetime-local"
              className="filter-input"
              value={toDate ? toDate.slice(0, 19) : ''}
              onChange={(e) => setToDate(e.target.value)}
              id="filterToDate"
            />
          </div>

          <div className="filter-group">
            <label className="filter-label">Plaza (Optional)</label>
            <select
              className="filter-select"
              value={plazaId}
              onChange={(e) => {
                const val = e.target.value;
                setPlazaId(val);
                handleSearch(0, pageSize, { plazaId: val });
              }}
              disabled={isPlazaLocked}
              title={isPlazaLocked ? `Locked to assigned plaza: ${assignedPlaza?.name || defaultPlazaId}` : 'Select Toll Plaza'}
              id="filterPlazaSelect"
            >
              {!isPlazaLocked && (
                <option value="ALL">
                  {currentUser?.role === 'Concessionaire' ? 'All Portfolio Plazas' : 'All Plazas'}
                </option>
              )}
              {plazas.map((p) => (
                <option key={p.id} value={p.id}>
                  {isPlazaLocked ? `🔒 ${p.name || p.codeLabel} (${p.id}) (Assigned Plaza)` : `${p.name || p.codeLabel} (${p.id})`}
                </option>
              ))}
            </select>
          </div>

          {/* Mode-Specific Dropdowns */}
          {txnType === 'NORMAL' ? (
            <div className="filter-group">
              <label className="filter-label">Transaction Status</label>
              <select
                className="filter-select"
                value={normalStatus}
                onChange={(e) => {
                  const val = e.target.value;
                  setNormalStatus(val);
                  handleSearch(0, pageSize, { normalStatus: val });
                }}
                id="filterStatusSelect"
              >
                <option value="ALL">All Statuses</option>
                <option value="Accepted">Accepted</option>
                <option value="Declined">Declined</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
          ) : (
            <div className="filter-group">
              <label className="filter-label">Function Code</label>
              <select
                className="filter-select"
                value={disputeFuncCode}
                onChange={(e) => {
                  const val = e.target.value;
                  setDisputeFuncCode(val);
                  handleSearch(0, pageSize, { disputeFuncCode: val });
                }}
                id="filterFuncCodeSelect"
              >
                <option value="ALL">All Codes</option>
                <option value="753: Debit Adjustment">753: Debit Adjustment</option>
                <option value="762: Credit Adjustment">762: Credit Adjustment</option>
              </select>
            </div>
          )}

          {/* Search Input */}
          <div className="filter-group filter-grow">
            <label className="filter-label">
              Quick Search (VRN / Tag ID / Acq Txn ID)
            </label>
            <input
              type="text"
              className="filter-input"
              placeholder={
                txnType === 'NORMAL'
                  ? 'Quick search VRN, Tag, Plaza, Acq Txn...'
                  : 'Quick search Vehicle, Tag, Plaza, Function Code...'
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch(0, pageSize)}
              id="filterSearchInput"
            />
          </div>

          {/* Action Buttons */}
          <div className="filter-actions">
            <button
              type="button"
              className="btn btn-royal-blue"
              onClick={handleExportExcel}
              disabled={exportingExcel || loading || filteredRecords.length === 0}
              id="btnExportExcel"
            >
              {exportingExcel ? 'Exporting...' : 'Export Excel'}
            </button>

            <button
              type="button"
              className="btn btn-royal-blue"
              onClick={handleExportCsv}
              disabled={exportingCsv || loading || filteredRecords.length === 0}
              id="btnExportCsv"
            >
              {exportingCsv ? 'Exporting...' : 'Export CSV'}
            </button>

            <button
              type="button"
              className="btn btn-royal-blue"
              onClick={() => handleSearch(0, pageSize)}
              disabled={loading}
              id="btnSearch"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleReset}
              disabled={loading}
              id="btnReset"
            >
              Reset
            </button>
          </div>
        </div>

        {errorMsg && <div className="filter-error-msg">{errorMsg}</div>}
      </div>

      {/* Summary KPI Cards / Mini Dashboard */}
      <ReportKpiGrid
        cards={[
          {
            label: txnType === 'NORMAL' ? 'Total Transactions' : 'Total Disputes',
            value: searchKpis.count.toLocaleString('en-IN'),
            sub: 'Filtered Records'
          },
          {
            label: txnType === 'NORMAL' ? 'Total Transaction Amount' : 'Total Dispute Amount',
            value: `₹ ${Number(searchKpis.totalAmt).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            sub: txnType === 'NORMAL' ? 'Gross Toll Value' : 'Adjusted / Chargebacked',
            highlight: 'blue'
          },
          {
            label: searchKpis.breakdownLabel,
            value: searchKpis.breakdownValue,
            sub: txnType === 'NORMAL' ? 'Successful Passes' : 'Function Code Breakdown',
            highlight: txnType === 'NORMAL' ? 'green' : 'purple'
          }
        ]}
      />

      {/* Results Header Info */}
      <div className="table-controls-bar">
        <div className="table-info">
          Showing <strong>{filteredRecords.length}</strong> of{' '}
          <strong>{totalElements || filteredRecords.length}</strong>{' '}
          {txnType === 'NORMAL' ? 'normal transactions' : 'dispute transactions'}
        </div>
      </div>

      {/* 3. Table Container */}
      <div className="table-container">
        {/* Top Centered Banner */}
        <div className="table-top-banner">
          <div className="banner-title">
            {txnType === 'NORMAL'
              ? 'TRANSACTION REPORT'
              : 'DISPUTE DETAIL REPORT'}
          </div>
          <div className="banner-subtitle">{dateSubtitle}</div>
          <div className="banner-green-bar" />
        </div>

        <div className="table-scroll-wrapper">
          {txnType === 'NORMAL' ? (
            /* NORMAL TRANSACTIONS TABLE - TRANSACTION REPORT FORMAT */
            <table className="dispute-styled-table">
              <thead>
                <tr>
                  <th className="text-center" style={{ width: '50px' }}>Sr No</th>
                  <th>Toll File Name</th>
                  <th>Plaza ID</th>
                  <th>Plaza Name</th>
                  <th>Lane ID</th>
                  <th>Tag ID</th>
                  <th>VRN</th>
                  <th>Acq Txn ID</th>
                  <th>Toll Txn ID</th>
                  <th>Toll Message ID</th>
                  <th>MVC</th>
                  <th>Tag VC</th>
                  <th>AVC</th>
                  <th>Transaction Status</th>
                  <th>Reason</th>
                  <th className="text-right">Transaction Amount</th>
                  <th>Transaction Date</th>
                  <th>Plaza Posted Date</th>
                  <th>NPCI Error Code</th>
                  <th>NPCI Response Date</th>
                  <th>Transaction Type</th>
                  <th>Issuer Bank ID</th>
                  <th>Issuer Bank Name</th>
                  <th>TID</th>
                  <th>Plaza Type</th>
                  <th className="text-center">Is Manual</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={26} className="table-loading-cell">
                      <div className="spinner" /> Loading transactions...
                    </td>
                  </tr>
                )}

                {!loading && filteredRecords.length === 0 && (
                  <tr>
                    <td colSpan={26} className="table-empty-cell">
                      No normal transactions found matching the selected filters.
                    </td>
                  </tr>
                )}

                {!loading &&
                  filteredRecords.map((r, idx) => {
                    const srNo = page * pageSize + idx + 1;
                    const st = (r.status || 'Accepted').toLowerCase();
                    let badgeClass = 'badge-other';
                    if (st === 'accepted' || st === 'success') badgeClass = 'badge-accepted';
                    else if (st === 'declined') badgeClass = 'badge-declined';
                    else if (st === 'rejected' || st === 'failed') badgeClass = 'badge-rejected';

                    const normPlaza = normalizePlazaForRecord(r, idx, plazas);

                    return (
                      <tr key={r.id || `${r.acqTxnId || ''}-${idx}`}>
                        <td className="text-center font-semibold">{srNo}</td>
                        <td>{r.tollFileName || 'ONLINE'}</td>
                        <td className="text-center monospace-cell">{normPlaza.plazaId}</td>
                        <td className="font-semibold">{normPlaza.plazaName}</td>
                        <td className="text-center monospace-cell">{r.laneId || '—'}</td>
                        <td className="monospace-cell">{r.tagId || '—'}</td>
                        <td className="font-semibold">{r.vehicleNo || r.vrn || '—'}</td>
                        <td className="monospace-cell">{r.acqTxnId || '—'}</td>
                        <td className="monospace-cell">{r.tollTxnId || '—'}</td>
                        <td className="monospace-cell">{r.tollMessageId || r.messageId || '—'}</td>
                        <td className="text-center">{r.mvc || 'VC4'}</td>
                        <td className="text-center">{r.tagVc || 'VC4'}</td>
                        <td className="text-center">{r.avc || 'VC4'}</td>
                        <td className="text-center">
                          <span className={`status-pill ${badgeClass}`}>
                            {r.status || 'Accepted'}
                          </span>
                        </td>
                        <td title={r.reason || 'SUCCESS'}>
                          {r.reason ? (
                            <span className="reason-code-badge">{r.reason}</span>
                          ) : (
                            <span className="text-muted">SUCCESS</span>
                          )}
                        </td>
                        <td className="text-right font-semibold">
                          ₹{Number(r.txnAmount || 0).toFixed(2)}
                        </td>
                        <td className="text-center">{formatDateDisplay(r.txnDateTime)}</td>
                        <td className="text-center">{formatDateDisplay(r.plazaPostedDate || r.txnDateTime)}</td>
                        <td className="text-center">{r.npciErrorCode || '000'}</td>
                        <td className="text-center">{formatDateDisplay(r.npciResponseDate || r.txnDateTime)}</td>
                        <td className="text-center">{r.txnType || 'Toll'}</td>
                        <td className="text-center monospace-cell">{r.issuerBankId || '052337'}</td>
                        <td>{r.issuerBankName || 'PAYTM'}</td>
                        <td className="monospace-cell">{r.tid || '—'}</td>
                        <td className="text-center">{r.plazaType || 'National'}</td>
                        <td className="text-center">{r.isManual ? 'Yes' : 'No'}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          ) : (
            /* DISPUTE TRANSACTIONS TABLE - DISPUTE DETAIL REPORT FORMAT */
            <table className="dispute-styled-table">
              <thead>
                <tr>
                  <th className="text-center" style={{ width: '50px' }}>Sr No</th>
                  <th>Plaza Name</th>
                  <th>Plaza ID</th>
                  <th>Acq Txn ID</th>
                  <th>Toll Txn ID</th>
                  <th>Txn Date Time</th>
                  <th className="text-right">Txn Amount</th>
                  <th className="text-right">Dispute Amount</th>
                  <th>Vehicle No</th>
                  <th>Tag ID</th>
                  <th>TID</th>
                  <th>Issuer ID</th>
                  <th>Int Tracking No</th>
                  <th>Function Code</th>
                  <th className="text-center">Settlement Indicator</th>
                  <th>Message Reason Code</th>
                  <th>Member Message Text</th>
                  <th>NPCI Settlement Date</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={18} className="table-loading-cell">
                      <div className="spinner" /> Loading dispute transactions...
                    </td>
                  </tr>
                )}

                {!loading && filteredRecords.length === 0 && (
                  <tr>
                    <td colSpan={18} className="table-empty-cell">
                      No dispute transactions found matching the selected filters.
                    </td>
                  </tr>
                )}

                {!loading &&
                  filteredRecords.map((d, idx) => {
                    const srNo = page * pageSize + idx + 1;
                    const settleClass = (d.settlementIndicator || d.settlementType || '').toLowerCase() === 'cr' ? 'cr' : 'dr';
                    const normPlaza = normalizePlazaForRecord(d, idx, plazas);

                    return (
                      <tr key={d.id || `${d.acqTxnId || ''}-${idx}`}>
                        <td className="text-center font-semibold">{srNo}</td>
                        <td className="font-semibold">{normPlaza.plazaName}</td>
                        <td className="text-center monospace-cell">{normPlaza.plazaId}</td>
                        <td className="monospace-cell">{d.acqTxnId || '—'}</td>
                        <td className="monospace-cell">{d.tollTxnId || '—'}</td>
                        <td className="text-center">{formatDateDisplay(d.txnDateTime)}</td>
                        <td className="text-right font-semibold">
                          ₹{Number(d.txnAmount || 0).toFixed(2)}
                        </td>
                        <td className="text-right font-semibold highlight-amt">
                          ₹{Number(d.disputeAmount || 0).toFixed(2)}
                        </td>
                        <td className="font-semibold">{d.vehicleNo || '—'}</td>
                        <td className="monospace-cell">{d.tagId || '—'}</td>
                        <td className="monospace-cell">{d.tid || '—'}</td>
                        <td className="text-center monospace-cell">{d.issuerId || '052337'}</td>
                        <td className="text-center">{d.intTrackingNo || 'NA'}</td>
                        <td className="font-semibold">{d.functionCode || '762: Credit Adjustment'}</td>
                        <td className="text-center">
                          <span className={`settle-badge ${settleClass}`}>
                            {d.settlementIndicator || d.settlementType || 'CR'}
                          </span>
                        </td>
                        <td className="text-center">{d.messageReasonCode || 'NA'}</td>
                        <td className="msg-text-cell" title={d.memberMessageText || d.fullParticulars || d.functionCode}>
                          {d.memberMessageText || d.fullParticulars || d.functionCode || '—'}
                        </td>
                        <td className="text-center">{formatDateDisplay(d.npciSettlementDate || d.txnDateTime)}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Bar */}
        <div className="table-pagination-bar">
          <div className="pagination-info">
            Showing {filteredRecords.length > 0 ? page * pageSize + 1 : 0} to{' '}
            {Math.min((page + 1) * pageSize, totalElements || filteredRecords.length)} of{' '}
            {totalElements || filteredRecords.length} records
          </div>

          <div className="pagination-controls">
            <select
              className="page-size-select"
              value={pageSize}
              onChange={handlePageSizeChange}
              id="selectPageSize"
            >
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
            </select>

            <button
              type="button"
              className="page-nav-btn"
              onClick={() => handlePageChange(0)}
              disabled={page === 0 || loading}
              title="First Page"
            >
              &laquo;
            </button>
            <button
              type="button"
              className="page-nav-btn"
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 0 || loading}
              title="Previous Page"
            >
              &lsaquo;
            </button>
            <span className="page-current">
              Page {page + 1} of {Math.max(totalPages, 1)}
            </span>
            <button
              type="button"
              className="page-nav-btn"
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages - 1 || loading}
              title="Next Page"
            >
              &rsaquo;
            </button>
            <button
              type="button"
              className="page-nav-btn"
              onClick={() => handlePageChange(totalPages - 1)}
              disabled={page >= totalPages - 1 || loading}
              title="Last Page"
            >
              &raquo;
            </button>
          </div>
        </div>

        {/* Table Bottom Export Download Time Strip */}
        <div
          className="table-bottom-export-bar"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '8px',
            padding: '10px 18px',
            backgroundColor: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            fontSize: '0.84rem',
            color: '#0369a1',
            marginTop: '8px'
          }}
        >
          <span style={{ fontWeight: 600 }}>📥 Export Download Time:</span>
          <span
            style={{
              fontFamily: 'monospace',
              color: downloadTime ? '#0369a1' : '#64748b',
              fontWeight: downloadTime ? 600 : 400
            }}
          >
            {downloadTime || 'Not exported yet'}
          </span>
        </div>

        {/* 4. Bottom Summary KPI Bar */}
        {txnType === 'NORMAL' ? (
          <div className="report-kpi-summary-bar">
            <div className="kpi-block kpi-green">
              <span>Total Transaction Count: {normalKpiSummary.totalTxn}</span>
            </div>
            <div className="kpi-block kpi-blue">
              <span>Total Transaction Amount: ₹{normalKpiSummary.totalAmt}</span>
            </div>
            <div className="kpi-block kpi-green">
              <span>Accepted Transaction Count: {normalKpiSummary.acceptedTxn}</span>
            </div>
            <div className="kpi-block kpi-blue">
              <span>Declined / Rejected Transaction Count: {normalKpiSummary.declinedRejectedTxn}</span>
            </div>
          </div>
        ) : (
          <div className="report-kpi-summary-bar dispute-kpis">
            <div className="kpi-block kpi-green">
              <span>Total Dispute Transactions: {filteredRecords.length}</span>
            </div>
            <div className="kpi-block kpi-blue">
              <span>
                Total Dispute Amount: ₹
                {filteredRecords
                  .reduce((acc, curr) => acc + Number(curr.disputeAmount || 0), 0)
                  .toFixed(2)}
              </span>
            </div>
            <div className="kpi-block kpi-green">
              <span>Credit Adjustments (CR): {filteredRecords.filter(r => (r.settlementType || '').toUpperCase() === 'CR').length}</span>
            </div>
            <div className="kpi-block kpi-blue">
              <span>Debit Adjustments (DR): {filteredRecords.filter(r => (r.settlementType || '').toUpperCase() === 'DR').length}</span>
            </div>
          </div>
        )}

        <div className="footer-disclaimer">
          * This report is generated from Paysonic Database directly on demand
        </div>
      </div>
    </div>
  );
};

export default TransactionSearch;
