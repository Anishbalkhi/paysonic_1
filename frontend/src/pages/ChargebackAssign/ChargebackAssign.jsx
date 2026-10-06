import React, { useState, useEffect, useCallback } from 'react';
import { FUNCTION_CODES, DEFAULT_PLAZAS } from '../../config/disputeConstants';
import DisputeManagementService from '../../services/dispute/DisputeManagementService';
import TransactionDetailsModal from '../../components/DisputeModals/TransactionDetailsModal';
import MoreInformationModal from '../../components/DisputeModals/MoreInformationModal';
import './ChargebackAssign.scss';

export const ChargebackAssign = () => {
  const [rows, setRows] = useState([]);
  const [plazas, setPlazas] = useState(DEFAULT_PLAZAS);
  const [miniStats, setMiniStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load realtime onboarded plazas
  useEffect(() => {
    let isMounted = true;
    DisputeManagementService.getRealtimePlazas().then((live) => {
      if (isMounted && Array.isArray(live) && live.length > 0) {
        setPlazas(live);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Filters
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [dateType, setDateType] = useState('');
  const [functionCode, setFunctionCode] = useState('');
  const [plazaAction, setPlazaAction] = useState('');
  const [assignStatus, setAssignStatus] = useState('');
  const [disputeStatus, setDisputeStatus] = useState('');
  const [tollPlazaId, setTollPlazaId] = useState('');

  // Bulk plaza selection chips
  const [selectedPlazaChips, setSelectedPlazaChips] = useState([]);
  const [bulkFeedback, setBulkFeedback] = useState('');

  // Modals state
  const [txnModalRow, setTxnModalRow] = useState(null);
  const [cbModalRow, setCbModalRow] = useState(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [fetchedRows, stats] = await Promise.all([
        DisputeManagementService.searchDisputes({
          functionCode,
          plazaAction,
          assignStatus,
          disputeStatus,
          plazaId: tollPlazaId,
        }),
        DisputeManagementService.getAdminMiniDashboardStats(),
      ]);
      setRows(fetchedRows);
      setMiniStats(stats);
    } catch (e) {
      console.error('[ChargebackAssign] Load error:', e);
    } finally {
      setLoading(false);
    }
  }, [functionCode, plazaAction, assignStatus, disputeStatus, tollPlazaId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const togglePlazaChip = (plazaId) => {
    setSelectedPlazaChips((prev) =>
      prev.includes(plazaId) ? prev.filter((p) => p !== plazaId) : [...prev, plazaId]
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
            >
              <option value="">--Select Toll Plaza Id--</option>
              {plazas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} - {p.id}
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
              setFromDate('');
              setToDate('');
              setDateType('');
              setFunctionCode('');
              setPlazaAction('');
              setAssignStatus('');
              setDisputeStatus('');
              setTollPlazaId('');
            }}
          >
            Clear Filters
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

      {/* 6.4 Dedicated Bulk Control Card */}
      <div className="bulk-control-card">
        <div className="card-title">Bulk Assign / Unassign — by Plaza</div>
        <p className="bulk-hint">
          Pick one or more plazas and apply to every currently-filtered, unassigned row for those plazas in one go.
        </p>

        <div className="plaza-chips-row">
          {plazas.map((p) => {
            const isPicked = selectedPlazaChips.includes(p.id);
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
          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
            Showing {rows.length} records
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
                <th>CB Raised Date</th>
                <th>CB Reason</th>
                <th>Function Code</th>
                <th>Dispute Type</th>
                <th>Plaza Action</th>
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
                  <td colSpan="18" style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                    Loading dispute queue...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan="18" style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                    No disputes found for the selected criteria.
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const tat = DisputeManagementService.getTatBadge(r);
                  return (
                    <tr key={r.rowId}>
                      <td>
                        {r.assigned ? (
                          <span className="badge tag-assigned">Assigned</span>
                        ) : (
                          <span className="badge tag-cb-assign">CB Assign</span>
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
                      <td>{r.cbRaisedDate}</td>
                      <td>{r.cbReason}</td>
                      <td className="code-cell" style={{ textAlign: 'center' }}>{r.functionCode}</td>
                      <td>{r.disputeType}</td>
                      <td>
                        <span className={`badge ${r.plazaAction === 'Yes' ? 'badge-blue' : 'badge-gray'}`}>
                          {r.plazaAction === 'Yes' ? 'Yes' : 'No'}
                        </span>
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
                      <td style={{ textAlign: 'center' }}>
                        {r.assigned ? (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setCbModalRow(r)}
                          >
                            View
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => setCbModalRow(r)}
                          >
                            CB Assign
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="table-footer-bar">
          Total disputes in working queue: <strong>{rows.length}</strong>
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
