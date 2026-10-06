import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { FUNCTION_CODES } from '../../config/disputeConstants';
import DisputeManagementService from '../../services/dispute/DisputeManagementService';
import TransactionDetailsModal from '../../components/DisputeModals/TransactionDetailsModal';
import TakeActionModal from '../../components/DisputeModals/TakeActionModal';
import ReportKpiGrid from '../../components/ReportKpiGrid/ReportKpiGrid';
import './DisputeValidate.scss';

export const DisputeValidate = () => {
  const { currentUser } = useAuth();
  const plazaId = currentUser?.role === 'Plaza Admin' || currentUser?.role === 'Plaza POS'
    ? currentUser?.plazaId || '600601'
    : '600601';

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters (Section 9)
  const [fromDate, setFromDate] = useState('2026-09-01');
  const [toDate, setToDate] = useState('2026-10-05');
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

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const fetched = await DisputeManagementService.searchDisputes({
        scopedPlazaId: plazaId,
        functionCode,
        plazaAction,
        disputeStatus,
        acqTxnId,
        tollTxnId,
        tagId,
      });
      // Show assigned disputes for this plaza
      setRows(fetched.filter((r) => r.assigned === true));
    } catch (e) {
      console.error('[DisputeValidate] Load error:', e);
    } finally {
      setLoading(false);
    }
  }, [plazaId, functionCode, plazaAction, disputeStatus, acqTxnId, tollTxnId, tagId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleReset = () => {
    setFunctionCode('');
    setPlazaAction('');
    setDisputeStatus('');
    setAcqTxnId('');
    setTollTxnId('');
    setTagId('');
  };

  const handleExportCsv = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [
        'Acq Txn ID,Toll Txn ID,VRN,Tag ID,Toll Plaza ID,Txn Date,CB Raised Date,CB Reason,Function Code,Plaza Action,Dispute Status,Dispute Amount',
        ...rows.map(
          (r) =>
            `"${r.acqTxnId}","${r.tollTxnId}","${r.vrn}","${r.tagId}","${r.plazaId}","${r.txnDate}","${r.cbRaisedDate}","${r.cbReason}","${r.functionCode}","${r.plazaAction}","${r.disputeStatus}","${r.disputeAmount}"`
        ),
      ].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Validate_Disputes_Plaza_${plazaId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="dispute-validate-page">
      <div className="page-header-block">
        <div>
          <h1>Validate Dispute</h1>
          <p className="subtitle">
            Disputes assigned to your plaza ({plazaId}). Review the acquirer's evidence and reason, and submit your verified decision (Approve or Reject) with proof.
          </p>
        </div>
      </div>

      {/* Search Criteria Card */}
      <div className="search-criteria-card">
        <div className="card-title">Search Criteria</div>
        <div className="filters-grid">
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
            sub: `Plaza ID: ${plazaId}`
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
            sub: `Decided / Closed: ${rows.filter(r => r.disputeStatus !== 'NA').length}`,
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
          >
            Export CSV
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleExportCsv}
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
                <th>Toll Plaza ID</th>
                <th>Txn Date</th>
                <th>CB Raised Date</th>
                <th>CB Reason</th>
                <th>Function Code</th>
                <th>Plaza Action</th>
                <th>Dispute Status</th>
                <th>TAT</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="13" style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                    Loading plaza disputes...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan="13" style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                    No disputes assigned to your plaza match the filters.
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const tat = DisputeManagementService.getTatBadge(r);
                  const isDecided = r.disputeStatus !== 'NA';
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
                      <td>{r.plazaId}</td>
                      <td>{r.txnDate}</td>
                      <td>{r.cbRaisedDate}</td>
                      <td>{r.cbReason}</td>
                      <td className="code-cell" style={{ textAlign: 'center' }}>{r.functionCode}</td>
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

        <div className="table-footer-bar">
          Total records: <strong>{rows.length}</strong>
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
