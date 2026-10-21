import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import DisputeManagementService from '../../services/dispute/DisputeManagementService';
import TablePagination from '../../components/common/TablePagination';
import { formatFetchTime } from '../../utils/dateUtils';
import { parseNpci01FileName } from '../../utils/npciFileNameParser';
import './DisputeFileUpload.scss';

export const DisputeFileUpload = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [selectedFileName, setSelectedFileName] = useState('');
  const [fileMeta, setFileMeta] = useState(null);
  const [fileError, setFileError] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [disputeFileDate, setDisputeFileDate] = useState('');
  const [parsedRows, setParsedRows] = useState([]);
  const [matchResult, setMatchResult] = useState(null);
  const [isMatching, setIsMatching] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [alertMsg, setAlertMsg] = useState('');

  const toIsoDate = (dmyStr) => {
    if (!dmyStr) return '';
    if (/^\d{2}-\d{2}-\d{4}$/.test(dmyStr)) {
      const [d, m, y] = dmyStr.split('-');
      return `${y}-${m}-${d}`;
    }
    return dmyStr;
  };

  const formatDisplayDate = (dStr) => {
    if (!dStr) return '—';
    if (/^\d{4}-\d{2}-\d{2}$/.test(dStr)) {
      const [y, m, d] = dStr.split('-');
      return `${d}-${m}-${y}`;
    }
    if (/^\d{2}-\d{2}-\d{4}$/.test(dStr)) {
      return dStr;
    }
    return dStr;
  };

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

  const processSelectedFile = async (file) => {
    if (!file) return;

    // 1. Strict CSV validation: NPCI 01 files MUST be in .csv format
    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith('.csv')) {
      const extMatch = file.name.match(/\.[^.]+$/);
      const ext = extMatch ? extMatch[0] : 'unknown';
      setFileError(
        `❌ File Rejected: NPCI 01 Dispute files must be in CSV (.csv) format. The selected file '${file.name}' (${ext}) was rejected.`
      );
      setSelectedFileName('');
      setFileMeta(null);
      setParsedRows([]);
      setMatchResult(null);
      return;
    }

    // 2. Strict Unique File Name Check: User requirement: "Duplicate 01 files (file with same name) are getting uploaded this should accept unique name every time"
    try {
      const liveBatches = await DisputeManagementService.fetchBatches();
      const localBatches = DisputeManagementService.getBatches();
      const combinedBatches = [...(Array.isArray(liveBatches) ? liveBatches : []), ...(Array.isArray(localBatches) ? localBatches : [])];
      const duplicate = combinedBatches.find(
        (b) => b.fileName && b.fileName.trim().toLowerCase() === file.name.trim().toLowerCase()
      );
      if (duplicate) {
        setFileError(
          `❌ Duplicate File Rejected: A file with the exact name "${file.name}" has already been uploaded previously (Batch ID: ${duplicate.batchId}, Uploaded: ${duplicate.uploadedAt || 'Earlier'}). The system accepts unique file names only. Please verify your file or upload the next sequential file.`
        );
        setSelectedFileName('');
        setFileMeta(null);
        setParsedRows([]);
        setMatchResult(null);
        return;
      }
    } catch (err) {
      console.debug('Duplicate check notice:', err);
    }

    setFileError('');
    setSelectedFileName(file.name);
    setAlertMsg('');

    // Parse NPCI 01 filename metadata (Julian date, daily sequence, release date)
    const meta = parseNpci01FileName(file.name);
    setFileMeta(meta);

    // Read and parse CSV content
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target.result;
        const rows = parseCsvText(text);
        setParsedRows(rows);
      } catch (err) {
        setFileError(`Failed to parse CSV content: ${err.message}`);
        setParsedRows([]);
      }
    };
    reader.onerror = () => {
      setFileError('Error reading the selected CSV file.');
      setParsedRows([]);
    };
    reader.readAsText(file);
  };

  const handleFileChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      processSelectedFile(file);
    }
    // Reset file input value so re-selecting same file triggers onChange
    e.target.value = '';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  const handleRunMatching = async () => {
    if (parsedRows.length === 0) {
      setAlertMsg('Please choose a valid CSV file with data rows first.');
      return;
    }

    if (!disputeFileDate) {
      setAlertMsg('Please select a Dispute File Date before running matching.');
      return;
    }

    const effectiveDate = formatDisplayDate(disputeFileDate);

    setIsMatching(true);
    setCurrentPage(1);
    setAlertMsg('');
    try {
      const res = await DisputeManagementService.matchCsvRows(parsedRows, effectiveDate);
      setMatchResult(res);
    } catch (err) {
      setAlertMsg('Error during matching: ' + (err.message || String(err)));
    } finally {
      setIsMatching(false);
    }
  };

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const paginatedResults = useMemo(() => {
    if (!matchResult?.results) return [];
    const start = (currentPage - 1) * pageSize;
    return matchResult.results.slice(start, start + pageSize);
  }, [matchResult, currentPage, pageSize]);

  const handleReset = () => {
    setSelectedFileName('');
    setFileMeta(null);
    setFileError('');
    setParsedRows([]);
    setMatchResult(null);
    setDisputeFileDate('');
    setAlertMsg('');
    setCurrentPage(1);
  };

  const handleDownloadErrorCsv = () => {
    if (!matchResult?.errorRows || matchResult.errorRows.length === 0) return;

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const fetchTimeStr = formatFetchTime(new Date());
    const headers = ['Row Number', 'RRN', 'Function Code', 'Disputed Amount', 'Failure Reason'];
    const rows = matchResult.errorRows.map((err) =>
      [
        err.rowNumber,
        err.rrn,
        err.functionCode || '—',
        err.disputeAmount !== undefined && err.disputeAmount !== null ? String(err.disputeAmount) : '—',
        err.reason
      ].map(escapeCsv).join(',')
    );

    const bannerRows = [
      `"PAYSONIC DISPUTE UPLOAD — VALIDATION ERROR REPORT"`,
      `"Export Time: ${fetchTimeStr}   |   Failed Records: ${matchResult.errorRows.length}"`,
      ''
    ];

    const csvContent = '\uFEFF' + [
      ...bannerRows,
      headers.map(escapeCsv).join(','),
      ...rows
    ].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Dispute_Upload_Errors_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCommit = async () => {
    if (!matchResult) return;
    if (!disputeFileDate) {
      setAlertMsg('Please select a Dispute File Date before adding to working queue.');
      return;
    }
    try {
      setIsCommitting(true);
      const actorName = currentUser?.name || currentUser?.role || 'Master Admin';
      const formattedFileDate = formatDisplayDate(disputeFileDate);

      const { inserted } = await DisputeManagementService.commitMatchedRows(
        selectedFileName || 'Uploaded_Dispute_File.csv',
        matchResult.results,
        actorName,
        fileMeta,
        formattedFileDate
      );
      alert(`Success: ${inserted} matched dispute records added to the Chargeback Assign queue with Dispute File Date ${formattedFileDate}.`);
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
        <h1>NPCI 01 Dispute File Upload</h1>
        <p className="subtitle">
          Upload NPCI 01 Chargeback / Dispute files in CSV format (e.g. <code>011IBKL2590002223113.csv</code>). 
          The system validates unique file names, decodes NPCI Julian release dates, applies settlement dates as Dispute Raise Date, and matches against the Transaction Master.
        </p>
      </div>

      {fileError && (
        <div className="upload-error-banner" role="alert">
          <div className="error-icon">⚠️</div>
          <div className="error-body">
            <strong>Validation Error</strong>
            <p>{fileError}</p>
            <span className="error-hint">Every upload must be a unique, previously un-uploaded <strong>.csv</strong> file.</span>
          </div>
        </div>
      )}

      {alertMsg && (
        <div style={{ padding: '10px 16px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', color: '#1e40af', fontSize: '0.88rem' }}>
          {alertMsg}
        </div>
      )}

      {/* Step 1: Select File */}
      <div className="upload-step-card">
        <div className="card-title">Step 1 — Upload NPCI 01 Dispute File (CSV Only)</div>

        {/* Dispute File Date Selection Panel (User Requirement) */}
        <div className="file-date-panel">
          <div className="date-panel-info">
            <label htmlFor="disputeFileDateInput" className="panel-label">
              📅 Dispute File Date <span className="req-star">*</span>
            </label>
            <span className="panel-desc">
              Select or confirm the file date. This date will be saved with the batch and displayed in <strong>Dispute File Status</strong>.
            </span>
          </div>
          <div className="date-panel-controls">
            <input
              id="disputeFileDateInput"
              type="date"
              className="date-picker-input"
              value={disputeFileDate}
              onChange={(e) => setDisputeFileDate(e.target.value)}
              required
            />
            <div className="date-display-badge">
              Formatted: <strong>{disputeFileDate ? formatDisplayDate(disputeFileDate) : 'Not selected'}</strong> (DD-MM-YYYY)
            </div>
            {fileMeta?.releaseDate && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.78rem', padding: '4px 10px' }}
                onClick={() => setDisputeFileDate(toIsoDate(fileMeta.releaseDate))}
                title="Reset to NPCI decoded release date"
              >
                Use Decoded Date ({fileMeta.releaseDate})
              </button>
            )}
          </div>
        </div>

        <div
          className={`drag-drop-area ${isDragOver ? 'dragging' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => document.getElementById('csvFileInput')?.click()}
        >
          <span className="upload-icon">📁</span>
          <span className="primary-prompt">
            {selectedFileName ? selectedFileName : 'Click to choose an NPCI 01 CSV file or drag and drop here'}
          </span>
          <span className="format-badge">Accepts .CSV Only • Unique Names Required</span>
          <span className="format-hint">
            Standard NPCI 01 File Naming: <code>011IBKL2590002223113.csv</code> (Last 2 digits: Daily file sequence #13 | Preceding 3 digits: Julian date Day 231)
          </span>
          <input
            id="csvFileInput"
            type="file"
            accept=".csv,text/csv"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </div>

        {/* NPCI 01 Decoded Metadata Card */}
        {fileMeta && fileMeta.isValid && fileMeta.is01File && (
          <div className="npci-meta-card">
            <div className="npci-meta-header">
              <div className="npci-title-group">
                <span className="npci-badge-pill">NPCI 01 Dispute File Verified</span>
                <span className="npci-filename">{fileMeta.fileName}</span>
              </div>
              <span className="npci-format-tag">✓ CSV Format Verified</span>
            </div>

            <div className="npci-grid">
              <div className="npci-stat-card highlight">
                <span className="stat-label">NPCI Release Date</span>
                <strong className="stat-value">{fileMeta.releaseDate}</strong>
                <span className="stat-sub">{fileMeta.releaseDateLong}</span>
              </div>
              <div className="npci-stat-card">
                <span className="stat-label">Daily File Sequence</span>
                <strong className="stat-value">File #{fileMeta.fileNumberStr}</strong>
                <span className="stat-sub">{fileMeta.fileNumberLabel}</span>
              </div>
              <div className="npci-stat-card">
                <span className="stat-label">Julian Date</span>
                <strong className="stat-value">Day {fileMeta.julianDateStr}</strong>
                <span className="stat-sub">Day {fileMeta.julianDay} of calendar year {fileMeta.year}</span>
              </div>
              <div className="npci-stat-card">
                <span className="stat-label">Bank / Flow</span>
                <strong className="stat-value">{fileMeta.bankCode}</strong>
                <span className="stat-sub">{fileMeta.flowLabel}</span>
              </div>
            </div>

            {/* Visual Breakdown Ribbon */}
            <div className="npci-breakdown-section">
              <span className="breakdown-title">File Name Alphanumeric Breakdown:</span>
              <div className="npci-breakdown-ribbon">
                {fileMeta.breakdown?.map((seg, idx) => (
                  <div key={idx} className="npci-chip">
                    <span className="chip-code">{seg.code}</span>
                    <span className="chip-label">{seg.label}</span>
                    <span className="chip-desc">{seg.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Selected file summary action bar */}
        {selectedFileName && (
          <div className="file-selected-bar">
            <div className="file-name-meta">
              <span>📄</span>
              <div>
                <strong>{selectedFileName}</strong>
                <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block' }}>
                  {parsedRows.length} data rows parsed | Dispute File Date: <strong>{disputeFileDate ? formatDisplayDate(disputeFileDate) : 'Not selected'}</strong>
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleReset}
              >
                Change File
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleRunMatching}
                disabled={isMatching || parsedRows.length === 0}
              >
                {isMatching ? 'Matching Against Master...' : `Reconcile & Match (${parsedRows.length} Rows)`}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Step 2: Match Results */}
      {matchResult && (
        <div className="match-result-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
            <div className="card-title" style={{ margin: 0 }}>Step 2 — Master Reconcile &amp; Matching Result</div>
            {matchResult.errorRows?.length > 0 && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleDownloadErrorCsv}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' }}
              >
                ⚠️ Download Error CSV ({matchResult.errorRows.length} issues)
              </button>
            )}
          </div>

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
              <span>Mismatched (Not in Master)</span>
              <strong>{matchResult.mismatchedCount || 0}</strong>
            </div>
            <div className="stat-pill-box warning">
              <span>Duplicates / Invalid Codes</span>
              <strong>{(matchResult.duplicateCount || 0) + (matchResult.invalidCodeCount || 0)}</strong>
            </div>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>RRN (Acq Txn ID)</th>
                  <th>Function Code</th>
                  <th>Dispute Type</th>
                  <th>Txn Date</th>
                  <th>Dispute Raise Date</th>
                  <th>Toll Plaza</th>
                  <th style={{ textAlign: 'right' }}>Txn Amount</th>
                  <th style={{ textAlign: 'right' }}>Disputed Amount</th>
                  <th>Member Message Text</th>
                  <th>TAT Due Date (T+8)</th>
                </tr>
              </thead>
              <tbody>
                {paginatedResults.map((r, i) => (
                  <tr key={i}>
                    <td>
                      {r.isMatched ? (
                        r.alreadyQueued ? (
                          <span className="badge badge-amber">Already Queued</span>
                        ) : (
                          <span className="badge badge-green">✓ Matched</span>
                        )
                      ) : (
                        <span className="badge badge-red">✕ Mismatched</span>
                      )}
                    </td>
                    <td className="code">{r.rrn}</td>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{r.functionCode}</td>
                    <td>{r.disputeType}</td>
                    <td>{r.txnDate || '—'}</td>
                    {/* User requirement: Dispute Raise Date shows settlement date from file */}
                    <td style={{ fontWeight: 600, color: '#0f172a' }}>{r.settlementDate || '—'}</td>
                    <td>{r.plazaName} ({r.plazaId})</td>
                    <td style={{ textAlign: 'right' }}>₹ {Number(r.txnAmount || 0).toFixed(2)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                      ₹ {Number(r.disputeAmount !== undefined && r.disputeAmount !== null ? r.disputeAmount : (r.txnAmount || 0)).toFixed(2)}
                    </td>
                    <td style={{ maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.memberMessageText || '—'}
                    </td>
                    <td style={{ fontWeight: 600, color: '#0369a1' }}>{r.tatDueDate || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <TablePagination
              totalItems={matchResult.results.length}
              currentPage={currentPage}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
                setCurrentPage(1);
              }}
              pageSizeOptions={[10, 25, 50, 100]}
            />
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
              {isCommitting ? 'Adding to Queue...' : `Add ${matchResult.matchedCount} Matched Rows to Chargeback Assign`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DisputeFileUpload;
