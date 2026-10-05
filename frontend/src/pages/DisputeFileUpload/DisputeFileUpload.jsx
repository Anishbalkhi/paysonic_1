import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DisputeManagementService from '../../services/dispute/DisputeManagementService';
import './DisputeFileUpload.scss';


export const DisputeFileUpload = () => {
  const navigate = useNavigate();
  const [selectedFileName, setSelectedFileName] = useState('');
  const [parsedRows, setParsedRows] = useState([]);
  const [matchResult, setMatchResult] = useState(null);
  const [isMatching, setIsMatching] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [alertMsg, setAlertMsg] = useState('');

  const parseCsvText = (text) => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) return [];

    const splitLine = (l) =>
      l.split(',').map((c) => c.replace(/^"|"$/g, '').trim());

    const headers = splitLine(lines[0]);
    const records = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = splitLine(lines[i]);
      const obj = {};
      headers.forEach((h, idx) => {
        obj[h] = cols[idx] || '';
      });
      records.push(obj);
    }
    return records;
  };

  const handleFileChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    setSelectedFileName(file.name);
    setAlertMsg('');
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      const rows = parseCsvText(text);
      setParsedRows(rows);
    };
    reader.readAsText(file);
  };


  const handleRunMatching = () => {
    if (parsedRows.length === 0) {
      setAlertMsg('Please choose a valid CSV file first.');
      return;
    }

    setIsMatching(true);
    setTimeout(() => {
      const res = DisputeManagementService.matchCsvRows(parsedRows);
      setMatchResult(res);
      setIsMatching(false);
    }, 400);
  };

  const handleReset = () => {
    setSelectedFileName('');
    setParsedRows([]);
    setMatchResult(null);
    setAlertMsg('');
  };

  const handleCommit = async () => {
    if (!matchResult) return;
    try {
      setIsCommitting(true);
      const { inserted } = await DisputeManagementService.commitMatchedRows(
        selectedFileName || 'Uploaded_Dispute_File.csv',
        matchResult.results
      );
      alert(`Success: ${inserted} matched dispute records added to the Chargeback Assign queue.`);
      navigate('/dispute-handling/chargeback-assign');
    } catch (err) {
      setAlertMsg(`Error adding rows: ${err.message}`);
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <div className="dispute-file-upload-page">
      <div className="page-header-block">
        <h1>Upload Dispute File</h1>
        <p className="subtitle">
          Upload acquirer/NPCI chargeback CSV file (e.g. 011IBKL2590002223106.csv). Every row is matched against the authoritative Transaction Master by RRN / Acq Txn ID before queuing for plaza assignment.
        </p>
      </div>

      {alertMsg && (
        <div style={{ padding: '10px 16px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', color: '#1e40af', fontSize: '0.88rem' }}>
          {alertMsg}
        </div>
      )}

      {/* Step 1: Select File */}
      <div className="upload-step-card">
        <div className="card-title">Step 1 — Select Acquirer / Bank File</div>

        <label className="drag-drop-area" htmlFor="csvFileInput">
          <span className="upload-icon">📁</span>
          <span className="primary-prompt">
            {selectedFileName ? selectedFileName : 'Click to choose a CSV file or drag and drop here'}
          </span>
          <span className="format-hint">
            Expected columns: Tag ID, Function Code, RRN, Acquirer ID, Transaction Amount, Message Reason Code, Member Message Text, Merchant ID, Vehicle Registration Number ...
          </span>
          <input
            id="csvFileInput"
            type="file"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </label>

        {selectedFileName && (
          <div className="file-selected-bar">
            <span className="file-name-meta">📄 {selectedFileName} ({parsedRows.length} rows parsed)</span>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleRunMatching}
              disabled={isMatching}
            >
              {isMatching ? 'Matching...' : 'Match Against Txn Master'}
            </button>
          </div>
        )}
      </div>

      {/* Step 2: Match Results */}
      {matchResult && (
        <div className="match-result-card">
          <div className="card-title">Step 2 — Master Reconcile &amp; Matching Result</div>

          <div className="match-stats-grid">
            <div className="stat-pill-box">
              <span>Rows in File</span>
              <strong>{matchResult.totalRows}</strong>
            </div>
            <div className="stat-pill-box success">
              <span>Matched to Txn Master</span>
              <strong>{matchResult.matchedCount}</strong>
            </div>
            <div className="stat-pill-box danger">
              <span>Unmatched (Master Record Missing)</span>
              <strong>{matchResult.unmatchedCount}</strong>
            </div>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>RRN (Acq Txn ID)</th>
                  <th>Tag ID</th>
                  <th>Function Code</th>
                  <th>Dispute Type</th>
                  <th>Txn Amount</th>
                  <th>Member Message Text</th>
                  <th>Toll Plaza</th>
                </tr>
              </thead>
              <tbody>
                {matchResult.results.map((r, i) => (
                  <tr key={i}>
                    <td>
                      {r.isMatched ? (
                        r.alreadyQueued ? (
                          <span className="badge badge-amber">Already Queued</span>
                        ) : (
                          <span className="badge badge-green">✓ Matched</span>
                        )
                      ) : (
                        <span className="badge badge-red">✕ Unmatched</span>
                      )}
                    </td>
                    <td className="code">{r.rrn}</td>
                    <td className="code">{r.tagId}</td>
                    <td>{r.functionCode}</td>
                    <td>{r.disputeType}</td>
                    <td>₹ {Number(r.txnAmount || 0).toFixed(2)}</td>
                    <td>{r.memberMessageText}</td>
                    <td>{r.plazaName} ({r.plazaId})</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="actions-footer-bar">
            <button type="button" className="btn btn-ghost" onClick={handleReset}>
              Discard
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleCommit}
              disabled={isCommitting || matchResult.matchedCount === 0}
            >
              {isCommitting ? 'Adding to Queue...' : 'Add Matched Rows to Chargeback Assign'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DisputeFileUpload;
