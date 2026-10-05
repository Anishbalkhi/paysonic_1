import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import TransactionSearchNormalService from '../../services/transactionSearch/TransactionSearchNormalService';
import TransactionSearchDisputeService from '../../services/transactionSearch/TransactionSearchDisputeService';
import ReportKpiGrid from '../../components/ReportKpiGrid/ReportKpiGrid';
import './TransactionSearch.scss';

export const TransactionSearch = () => {
  const [searchParams, setSearchParams] = useSearchParams();

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
  const [plazaId, setPlazaId] = useState('ALL');

  // Normal-specific filter
  const [normalStatus, setNormalStatus] = useState('ALL');

  // Dispute-specific filter
  const [disputeFuncCode, setDisputeFuncCode] = useState('ALL');

  // Shared search term across table
  const [searchTerm, setSearchTerm] = useState('');

  // Records & Pagination
  const [records, setRecords] = useState([]);
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

        const content = data?.content || (Array.isArray(data) ? data : []);
        setRecords(content);
        setTotalElements(data?.totalElements ?? content.length);
        setTotalPages(data?.totalPages ?? (content.length > 0 ? 1 : 0));
        setPage(data?.number ?? 0);
        if (data?.summary) {
          setServerSummary(data.summary);
        }
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

        const content = data?.content ? data.content : Array.isArray(data) ? data : [];
        setRecords(content);
        setTotalElements(data?.totalElements ?? content.length);
        setTotalPages(data?.totalPages ?? (content.length > 0 ? 1 : 0));
        setPage(data?.number ?? 0);
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
    setFromDate(def.from);
    setToDate(def.to);
    setPlazaId('ALL');
    setNormalStatus('ALL');
    setDisputeFuncCode('ALL');
    setSearchTerm('');
    handleSearch(0, pageSize, {
      fromDate: def.from,
      toDate: def.to,
      plazaId: 'ALL',
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
        <div className="report-subtitle">{dateSubtitle}</div>
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
              id="filterPlazaSelect"
            >
              <option value="ALL">All Plazas</option>
              <option value="600601">Dummytollplaza1 (600601)</option>
              <option value="600602">Dummytollplaza2 (600602)</option>
              <option value="778999">Gluten (778999)</option>
              <option value="666666">Autumn (666666)</option>
              <option value="501101">MUMBAI PLAZA NH-04 (501101)</option>
              <option value="502202">PUNE BYPASS PLAZA (502202)</option>
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
          },
          {
            label: 'Live Railway DB',
            value: 'ONLINE',
            sub: searchKpis.endpoint,
            isBadge: true
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
        {/* Top Centered Banner matching user specifications */}
        <div className="table-top-banner">
          <div className="banner-title">
            {txnType === 'NORMAL'
              ? 'TRANSACTION SEARCH - NORMAL TRANSACTION'
              : 'TRANSACTION SEARCH - DISPUTE TRANSACTION'}
          </div>
          <div className="banner-subtitle">{dateSubtitle}</div>
          <div className="banner-green-bar" />
        </div>

        <div className="table-scroll-wrapper">
          {txnType === 'NORMAL' ? (
            /* NORMAL TRANSACTIONS TABLE */
            <table className="dispute-styled-table">
              <thead>
                <tr>
                  <th style={{ width: '50px' }}>SR NO</th>
                  <th>PLAZA ID</th>
                  <th>PLAZA NAME</th>
                  <th>LANE ID</th>
                  <th>ACQ TXN ID</th>
                  <th>TOLL TXN ID</th>
                  <th>TXN DATE TIME</th>
                  <th className="text-right">TXN AMOUNT</th>
                  <th>VEHICLE NO</th>
                  <th>TAG ID</th>
                  <th>TID</th>
                  <th>STATUS</th>
                  <th>REASON</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={13} className="table-loading-cell">
                      <div className="spinner" /> Loading transactions from Railway MySQL DB...
                    </td>
                  </tr>
                )}

                {!loading && filteredRecords.length === 0 && (
                  <tr>
                    <td colSpan={13} className="table-empty-cell">
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

                    return (
                      <tr key={r.id || `${r.acqTxnId || ''}-${idx}`}>
                        <td className="text-center font-semibold">{srNo}</td>
                        <td className="text-center monospace-cell">{r.plazaId || '—'}</td>
                        <td className="font-semibold">{r.plazaName || '—'}</td>
                        <td className="text-center monospace-cell">{r.laneId || '—'}</td>
                        <td className="monospace-cell">{r.acqTxnId || '—'}</td>
                        <td className="monospace-cell">{r.tollTxnId || '—'}</td>
                        <td className="text-center">{formatDateDisplay(r.txnDateTime)}</td>
                        <td className="text-right font-semibold">
                          ₹{Number(r.txnAmount || 0).toFixed(2)}
                        </td>
                        <td className="font-semibold">{r.vehicleNo || '—'}</td>
                        <td className="monospace-cell">{r.tagId || '—'}</td>
                        <td className="monospace-cell">{r.tid || '—'}</td>
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
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          ) : (
            /* DISPUTE TRANSACTIONS TABLE */
            <table className="dispute-styled-table">
              <thead>
                <tr>
                  <th style={{ width: '50px' }}>SR NO</th>
                  <th>PLAZA NAME</th>
                  <th>PLAZA ID</th>
                  <th>ACQ TXN ID</th>
                  <th>TOLL TXN ID</th>
                  <th>TXN DATE TIME</th>
                  <th className="text-right">TXN AMOUNT</th>
                  <th className="text-right">DISPUTE AMOUNT</th>
                  <th>VEHICLE NO</th>
                  <th>TAG ID</th>
                  <th>TID</th>
                  <th>SETTLEMENT TYPE</th>
                  <th>FUNCTION CODE</th>
                  <th>FULL PARTICULARS / MSG</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={14} className="table-loading-cell">
                      <div className="spinner" /> Loading dispute transactions from Railway DB...
                    </td>
                  </tr>
                )}

                {!loading && filteredRecords.length === 0 && (
                  <tr>
                    <td colSpan={14} className="table-empty-cell">
                      No dispute transactions found matching the selected filters.
                    </td>
                  </tr>
                )}

                {!loading &&
                  filteredRecords.map((d, idx) => {
                    const srNo = page * pageSize + idx + 1;
                    const settleClass = (d.settlementType || '').toUpperCase() === 'CR' ? 'cr' : 'dr';

                    return (
                      <tr key={d.id || `${d.acqTxnId || ''}-${idx}`}>
                        <td className="text-center font-semibold">{srNo}</td>
                        <td className="font-semibold">{d.plazaName || '—'}</td>
                        <td className="text-center monospace-cell">{d.plazaId || '—'}</td>
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
                        <td className="text-center">
                          <span className={`settle-badge ${settleClass}`}>
                            {d.settlementType || 'CR'}
                          </span>
                        </td>
                        <td className="text-center font-semibold">
                          {extractCode(d.functionCode)}
                        </td>
                        <td className="msg-text-cell" title={d.fullParticulars || d.functionCode}>
                          {d.fullParticulars || d.functionCode || '—'}
                        </td>
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
