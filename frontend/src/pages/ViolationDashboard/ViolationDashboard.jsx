import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ViolationValidateService from '../../services/violation/ViolationValidateService';
import ViolationSettlementService from '../../services/violation/ViolationSettlementService';
import ViolationRawFileService from '../../services/violation/ViolationRawFileService';
import useOnboardedPlazas from '../../hooks/useOnboardedPlazas';
import { filterRecordsByPlazaScope } from '../../utils/plazaScopeUtils';
import { normalizePlazaForRecord } from '../../utils/plazaNormalizer';
import { formatFetchTime } from '../../utils/dateUtils';
import ReportKpiGrid from '../../components/ReportKpiGrid/ReportKpiGrid';
import './ViolationDashboard.scss';

export const ViolationDashboard = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { plazas: onboardedPlazas, isPlazaLocked, defaultPlazaId, assignedPlaza } = useOnboardedPlazas();

  // Date range default: September 2026
  const [fromDate, setFromDate] = useState('2026-09-01T00:00:00');
  const [toDate, setToDate] = useState('2026-09-30T23:59:59');
  const [plazaId, setPlazaId] = useState(isPlazaLocked ? (defaultPlazaId || 'ALL') : 'ALL');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [fetchTime, setFetchTime] = useState('');

  const [validateRecords, setValidateRecords] = useState([]);
  const [settlementRecords, setSettlementRecords] = useState([]);
  const [rawFiles, setRawFiles] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('ALL');

  useEffect(() => {
    if (isPlazaLocked && defaultPlazaId && plazaId !== defaultPlazaId) {
      setPlazaId(defaultPlazaId);
    }
  }, [isPlazaLocked, defaultPlazaId, plazaId]);

  const formatDateTimeDisplay = (dtStr) => {
    if (!dtStr) return '-';
    try {
      const d = new Date(dtStr);
      if (isNaN(d.getTime())) return dtStr;
      const pad = (n) => String(n).padStart(2, '0');
      return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    } catch {
      return dtStr;
    }
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    const targetPlaza = isPlazaLocked && defaultPlazaId !== 'ALL' ? defaultPlazaId : plazaId;

    try {
      const [valRes, setRes, rawRes] = await Promise.allSettled([
        ViolationValidateService.search({ fromDate, toDate, plazaId: targetPlaza, size: 50 }),
        ViolationSettlementService.search({ fromDate, toDate, plazaId: targetPlaza, size: 50 }),
        ViolationRawFileService.search({ fromDate, toDate, plazaId: targetPlaza, size: 50 })
      ]);

      let valContent = valRes.status === 'fulfilled' ? (valRes.value?.content || (Array.isArray(valRes.value) ? valRes.value : [])) : [];
      let setContent = setRes.status === 'fulfilled' ? (setRes.value?.content || (Array.isArray(setRes.value) ? setRes.value : [])) : [];
      let rawContent = rawRes.status === 'fulfilled' ? (rawRes.value?.content || (Array.isArray(rawRes.value) ? rawRes.value : [])) : [];

      valContent = filterRecordsByPlazaScope(valContent, onboardedPlazas, currentUser);
      setContent = filterRecordsByPlazaScope(setContent, onboardedPlazas, currentUser);
      rawContent = filterRecordsByPlazaScope(rawContent, onboardedPlazas, currentUser);

      setValidateRecords(valContent);
      setSettlementRecords(setContent);
      setRawFiles(rawContent);
      setFetchTime(formatFetchTime(new Date()));
    } catch (err) {
      console.error('[ViolationDashboard] Failed to load dashboard stats:', err);
      setErrorMsg('Failed to load violation records from database.');
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, plazaId, isPlazaLocked, defaultPlazaId, onboardedPlazas, currentUser]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 20000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Dynamic available plazas
  const availablePlazas = useMemo(() => {
    const map = new Map();
    (onboardedPlazas || []).forEach((p) => {
      const pId = String(p.id || '').trim();
      const pName = (p.name || `Plaza ${pId}`).trim();
      if (pId && !/dummy|autumn|gluten/i.test(pName)) {
        map.set(pId, `${pId} - ${pName}`);
      }
    });
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
  }, [onboardedPlazas]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    let totalAmt = 0;
    let approvedCount = 0;
    let declinedCount = 0;
    let pendingAction = 0;

    validateRecords.forEach((r) => {
      totalAmt += Number(r.txnAmount || 0);
      const remark = (r.auditRemark || '').toUpperCase();
      const action = (r.takeAction || '').toLowerCase();
      if (remark === 'ACCEPTED' || (r.violationApiStatus || '').toUpperCase() === 'APPROVED') {
        approvedCount++;
      } else if (remark === 'DECLINED') {
        declinedCount++;
      }
      if (action === 'view violation' || !r.auditRemark) {
        pendingAction++;
      }
    });

    const totalSettledAmt = settlementRecords.reduce((acc, curr) => acc + Number(curr.settlementAmount || curr.txnAmount || 0), 0);

    return {
      totalViolations: validateRecords.length,
      totalAmt: totalAmt.toFixed(2),
      approvedCount,
      declinedCount,
      pendingAction,
      totalSettledAmt: totalSettledAmt.toFixed(2),
      rawFilesCount: rawFiles.length,
    };
  }, [validateRecords, settlementRecords, rawFiles]);

  // Filtered recent violations
  const filteredViolations = useMemo(() => {
    let list = [...validateRecords];
    if (filterSeverity === 'ACCEPTED') {
      list = list.filter((r) => (r.auditRemark || '').toUpperCase() === 'ACCEPTED');
    } else if (filterSeverity === 'DECLINED') {
      list = list.filter((r) => (r.auditRemark || '').toUpperCase() === 'DECLINED');
    } else if (filterSeverity === 'PENDING') {
      list = list.filter((r) => !r.auditRemark || (r.takeAction || '').toLowerCase() === 'view violation');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((r) =>
        (r.vrn && r.vrn.toLowerCase().includes(q)) ||
        (r.tagId && r.tagId.toLowerCase().includes(q)) ||
        (r.acqTxnId && String(r.acqTxnId).toLowerCase().includes(q)) ||
        (r.plazaName && r.plazaName.toLowerCase().includes(q)) ||
        (r.auditDesc && r.auditDesc.toLowerCase().includes(q))
      );
    }
    return list;
  }, [validateRecords, filterSeverity, searchQuery]);

  return (
    <div className="violation-dashboard-page">
      {/* 1. Header Banner */}
      <div className="report-header-banner">
        <h1 className="report-title">VIOLATION DASHBOARD</h1>
        <div className="report-subtitle">
          From Date: {formatDateTimeDisplay(fromDate)} &nbsp;|&nbsp; To Date: {formatDateTimeDisplay(toDate)} &nbsp;|&nbsp; 
          <span className="fetch-time-badge">Report Fetch Time: {fetchTime}</span>
        </div>
        <div className="report-green-accent-bar" />
      </div>

      {/* 2. Filter & Controls Bar */}
      <div className="filter-card">
        <div className="filter-row">
          <div className="filter-group">
            <label className="filter-label">From Date</label>
            <input
              type="datetime-local"
              className="filter-input"
              value={fromDate.slice(0, 19)}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label className="filter-label">To Date</label>
            <input
              type="datetime-local"
              className="filter-input"
              value={toDate.slice(0, 19)}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label className="filter-label">Plaza</label>
            <select
              className={`filter-select ${isPlazaLocked ? 'disabled-locked' : ''}`}
              value={plazaId}
              disabled={isPlazaLocked}
              onChange={(e) => setPlazaId(e.target.value)}
            >
              {!isPlazaLocked && (
                <option value="ALL">
                  {currentUser?.role === 'Concessionaire' ? 'All Portfolio Plazas' : 'All Plazas'}
                </option>
              )}
              {availablePlazas.map((p) => (
                <option key={p.id} value={p.id}>
                  {isPlazaLocked ? `🔒 ${p.label} (Assigned)` : p.label}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-actions">
            <button className="btn btn-royal-blue" onClick={loadData} disabled={loading}>
              {loading ? 'Refreshing...' : 'Refresh Data'}
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setFromDate('2026-09-01T00:00:00');
                setToDate('2026-09-30T23:59:59');
                setPlazaId(isPlazaLocked ? (defaultPlazaId || 'ALL') : 'ALL');
                setSearchQuery('');
                setFilterSeverity('ALL');
              }}
            >
              Reset
            </button>
          </div>
        </div>

        {errorMsg && <div className="filter-error-msg">{errorMsg}</div>}
      </div>

      {/* 3. Primary KPI Dashboard Grid */}
      <ReportKpiGrid
        cards={[
          {
            label: 'Total Violations Detected',
            value: metrics.totalViolations.toLocaleString('en-IN'),
            sub: 'AVC/MVC Discrepancies',
            highlight: 'blue'
          },
          {
            label: 'Total Violation Value',
            value: `₹ ${Number(metrics.totalAmt).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
            sub: 'Gross Toll Undercharged',
            highlight: 'purple'
          },
          {
            label: 'Accepted / Validated',
            value: `${metrics.approvedCount} / ${metrics.totalViolations}`,
            sub: 'Audit Approved Rate',
            highlight: 'green'
          },
          {
            label: 'Declined / Disproved',
            value: `${metrics.declinedCount}`,
            sub: 'Non-Actionable Violations',
            highlight: 'red'
          }
        ]}
      />

      {/* 4. Quick Module Navigation Shortcuts */}
      <div className="violation-shortcuts-bar">
        <span className="shortcuts-title">Violation Management Modules:</span>
        <div className="shortcuts-buttons">
          <button
            type="button"
            className="shortcut-pill"
            onClick={() => navigate('/violation-management/violation-validate-report')}
          >
            📋 Validate Report
          </button>
          <button
            type="button"
            className="shortcut-pill"
            onClick={() => navigate('/violation-management/violation-settlement-report')}
          >
            💵 Settlement Report
          </button>
          <button
            type="button"
            className="shortcut-pill"
            onClick={() => navigate('/violation-management/violation-raw-file')}
          >
            📁 Raw File Report
          </button>
          <button
            type="button"
            className="shortcut-pill highlight"
            onClick={() => navigate('/violation-management/violation-bulk-action')}
          >
            ⚡ Bulk Action ({metrics.pendingAction} Pending)
          </button>
        </div>
      </div>

      {/* 5. Live Violation Queue & Auditing Table */}
      <div className="dashboard-content-grid">
        <div className="queue-card">
          <div className="queue-header">
            <div className="queue-title-wrap">
              <h3>Live Violation Audit Queue</h3>
              <span className="queue-count">{filteredViolations.length} records in current scope</span>
            </div>

            <div className="queue-controls">
              <div className="severity-tabs">
                <button
                  type="button"
                  className={`tab-btn ${filterSeverity === 'ALL' ? 'active' : ''}`}
                  onClick={() => setFilterSeverity('ALL')}
                >
                  All ({validateRecords.length})
                </button>
                <button
                  type="button"
                  className={`tab-btn ${filterSeverity === 'PENDING' ? 'active' : ''}`}
                  onClick={() => setFilterSeverity('PENDING')}
                >
                  Pending Action ({metrics.pendingAction})
                </button>
                <button
                  type="button"
                  className={`tab-btn ${filterSeverity === 'ACCEPTED' ? 'active' : ''}`}
                  onClick={() => setFilterSeverity('ACCEPTED')}
                >
                  Accepted ({metrics.approvedCount})
                </button>
                <button
                  type="button"
                  className={`tab-btn ${filterSeverity === 'DECLINED' ? 'active' : ''}`}
                  onClick={() => setFilterSeverity('DECLINED')}
                >
                  Declined ({metrics.declinedCount})
                </button>
              </div>

              <div className="queue-search">
                <input
                  type="text"
                  placeholder="Quick search VRN, Tag, Plaza..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="table-responsive">
            <table className="violation-styled-table">
              <thead>
                <tr>
                  <th>Sr No</th>
                  <th>Plaza Name</th>
                  <th>VRN</th>
                  <th>Tag ID</th>
                  <th>Acq Txn ID</th>
                  <th>MVC / AVC / Audit</th>
                  <th className="text-right">Txn Amount</th>
                  <th>Audit Remark</th>
                  <th>Audit Description</th>
                  <th className="text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="10" className="text-center py-6">
                      <div className="spinner" /> Loading violation queue...
                    </td>
                  </tr>
                ) : filteredViolations.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="text-center py-6 text-muted">
                      No violations found matching the criteria.
                    </td>
                  </tr>
                ) : (
                  filteredViolations.slice(0, 15).map((r, idx) => {
                    const normPlaza = normalizePlazaForRecord(r, idx, onboardedPlazas);
                    const isAccepted = (r.auditRemark || '').toUpperCase() === 'ACCEPTED';
                    const isDeclined = (r.auditRemark || '').toUpperCase() === 'DECLINED';
                    const isPending = !r.auditRemark || (r.takeAction || '').toLowerCase() === 'view violation';

                    return (
                      <tr key={r.id || idx}>
                        <td className="text-center">{idx + 1}</td>
                        <td className="font-semibold">{normPlaza.plazaName}</td>
                        <td className="font-semibold text-center">{r.vrn || '—'}</td>
                        <td className="monospace-cell">{r.tagId || '—'}</td>
                        <td className="monospace-cell">{r.acqTxnId || '—'}</td>
                        <td className="text-center">
                          <span className="vc-pill mvc">{r.mvc || 'VC4'}</span>
                          <span className="vc-arrow">&rarr;</span>
                          <span className="vc-pill avc">{r.avc || 'VC18'}</span>
                          {r.auditVc && r.auditVc !== 'NA' && (
                            <>
                              <span className="vc-arrow">&rarr;</span>
                              <span className="vc-pill audit">{r.auditVc}</span>
                            </>
                          )}
                        </td>
                        <td className="text-right font-bold">₹{Number(r.txnAmount || 0).toFixed(2)}</td>
                        <td className="text-center">
                          <span
                            className={`status-pill ${
                              isAccepted ? 'badge-accepted' : isDeclined ? 'badge-declined' : 'badge-pending'
                            }`}
                          >
                            {isAccepted ? 'ACCEPTED' : isDeclined ? 'DECLINED' : 'PENDING'}
                          </span>
                        </td>
                        <td className="desc-cell" title={r.auditDesc || ''}>
                          {r.auditDesc || 'Vehicle classification audit pending'}
                        </td>
                        <td className="text-center">
                          <button
                            type="button"
                            className="btn-action-small"
                            onClick={() => navigate('/violation-management/violation-validate-report')}
                          >
                            Audit
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ViolationDashboard;
