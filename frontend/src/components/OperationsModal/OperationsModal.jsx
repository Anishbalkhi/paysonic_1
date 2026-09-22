import React, { useState } from 'react';
import './OperationsModal.scss';

export const OperationsModal = ({ operation, onClose }) => {
  if (!operation) return null;

  const [tagQuery, setTagQuery] = useState('34161FA82032849');
  const [tagResult, setTagResult] = useState(null);
  const [passData, setPassData] = useState({
    vehicleNo: 'MH 02 CZ 4402',
    name: 'Ramesh Verma',
    mobile: '9820123456',
    passType: 'Monthly Local Resident',
    plaza: 'Vashi Creek Bridge',
  });
  const [passIssued, setPassIssued] = useState(false);
  const [reconFile, setReconFile] = useState(null);
  const [reconUploaded, setReconUploaded] = useState(false);

  const handleQueryTag = (e) => {
    e.preventDefault();
    setTagResult({
      tagId: tagQuery || '34161FA82032849',
      tid: 'E2003412013849102834',
      vehicleClass: 'VC4 (Car / Jeep / Van)',
      regNumber: 'MH 12 Q 9821',
      issuerBank: 'HDFC Bank Ltd',
      status: 'ACTIVE / NORMAL',
      blacklistReason: 'None (Clear)',
      balanceStatus: 'Adequate Balance (₹1,450.00)',
      npciLastSync: new Date().toLocaleTimeString(),
    });
  };

  const handleIssuePass = (e) => {
    e.preventDefault();
    setPassIssued(true);
  };

  const handleUploadRecon = (e) => {
    e.preventDefault();
    setReconUploaded(true);
  };

  const opId = (operation.path || '').replace('#', '');

  return (
    <div className="op-modal-backdrop" onClick={onClose}>
      <div className="op-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="op-modal-header">
          <div className="op-modal-title-wrap">
            <span className="op-modal-badge">Operational Module</span>
            <h3>{operation.label}</h3>
          </div>
          <button className="op-close-btn" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        <div className="op-modal-body">
          {/* TAG DETAILS: Request Tag Details */}
          {opId === 'request-tag-details' && (
            <div className="op-section">
              <p className="op-desc">
                Query NPCI National Electronic Toll Collection (NETC) registry in real-time for FASTag status, blacklist flags, and vehicle mappings.
              </p>
              <form onSubmit={handleQueryTag} className="op-form">
                <div className="op-input-group">
                  <label>FASTag ID / RFID Tag ID or Vehicle Registration</label>
                  <div className="op-input-row">
                    <input
                      type="text"
                      value={tagQuery}
                      onChange={(e) => setTagQuery(e.target.value)}
                      placeholder="e.g. 34161FA82032849 or MH12AB1234"
                      required
                    />
                    <button type="submit" className="op-btn-primary">
                      Query NPCI NETC
                    </button>
                  </div>
                </div>
              </form>

              {tagResult && (
                <div className="op-result-card">
                  <div className="op-result-head">
                    <span className="op-status-badge green">✓ FASTAG VERIFIED &amp; ACTIVE</span>
                    <span className="op-timestamp">Checked at {tagResult.npciLastSync}</span>
                  </div>
                  <div className="op-grid-2">
                    <div className="op-data-item">
                      <span className="lbl">Tag Serial / EPC ID</span>
                      <span className="val">{tagResult.tagId}</span>
                    </div>
                    <div className="op-data-item">
                      <span className="lbl">TID Hardware Serial</span>
                      <span className="val">{tagResult.tid}</span>
                    </div>
                    <div className="op-data-item">
                      <span className="lbl">Mapped Vehicle Class</span>
                      <span className="val">{tagResult.vehicleClass}</span>
                    </div>
                    <div className="op-data-item">
                      <span className="lbl">Vehicle Registration</span>
                      <span className="val">{tagResult.regNumber}</span>
                    </div>
                    <div className="op-data-item">
                      <span className="lbl">Issuer Bank</span>
                      <span className="val">{tagResult.issuerBank}</span>
                    </div>
                    <div className="op-data-item">
                      <span className="lbl">FASTag Balance Status</span>
                      <span className="val text-green">{tagResult.balanceStatus}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAG DETAILS: Blacklist Search History */}
          {opId === 'blacklist-history' && (
            <div className="op-section">
              <p className="op-desc">
                Recent NPCI FASTag exception list sync records and blacklisted vehicle lane intercept logs.
              </p>
              <table className="op-table">
                <thead>
                  <tr>
                    <th>Tag ID</th>
                    <th>Vehicle Reg</th>
                    <th>Reason Code</th>
                    <th>Plaza Detected</th>
                    <th>Sync Time</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>34161FA902341</td>
                    <td>MH 04 AZ 1024</td>
                    <td><span className="op-tag red">Low Balance / Frozen</span></td>
                    <td>Vashi Creek Bridge</td>
                    <td>Today, 14:12</td>
                  </tr>
                  <tr>
                    <td>34161FA884712</td>
                    <td>MH 14 CC 8412</td>
                    <td><span className="op-tag red">Hotlisted / Stolen</span></td>
                    <td>Airoli Bridge Lane 02</td>
                    <td>Today, 13:45</td>
                  </tr>
                  <tr>
                    <td>34161FA991204</td>
                    <td>MH 01 BK 3301</td>
                    <td><span className="op-tag orange">Invalid Tag / Tampered</span></td>
                    <td>Khed Shivapur</td>
                    <td>Today, 12:30</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* PASS ISSUANCE */}
          {(opId === 'pass-issuance' || opId === 'pass-view') && (
            <div className="op-section">
              <p className="op-desc">
                Issue local resident, monthly commuter, or commercial fleet vehicle passes for fast lane transit.
              </p>
              {passIssued ? (
                <div className="op-result-card green-border">
                  <h4 style={{ color: '#16a34a', marginBottom: '8px' }}>✓ Vehicle Pass Issued Successfully!</h4>
                  <p style={{ fontSize: '13px', color: '#475569' }}>
                    Pass ID: <strong>PSN-PASS-2026-08491</strong> · Valid for 30 days across {passData.plaza}.
                  </p>
                  <button className="op-btn-outline" onClick={() => setPassIssued(false)} style={{ marginTop: '12px' }}>
                    Issue Another Pass
                  </button>
                </div>
              ) : (
                <form onSubmit={handleIssuePass} className="op-form">
                  <div className="op-grid-2">
                    <div className="op-field">
                      <label>Vehicle Registration Number</label>
                      <input
                        type="text"
                        value={passData.vehicleNo}
                        onChange={(e) => setPassData({ ...passData, vehicleNo: e.target.value })}
                        required
                      />
                    </div>
                    <div className="op-field">
                      <label>Customer Name</label>
                      <input
                        type="text"
                        value={passData.name}
                        onChange={(e) => setPassData({ ...passData, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="op-field">
                      <label>Mobile Number</label>
                      <input
                        type="text"
                        value={passData.mobile}
                        onChange={(e) => setPassData({ ...passData, mobile: e.target.value })}
                        required
                      />
                    </div>
                    <div className="op-field">
                      <label>Pass Type</label>
                      <select
                        value={passData.passType}
                        onChange={(e) => setPassData({ ...passData, passType: e.target.value })}
                      >
                        <option>Monthly Local Resident (₹330)</option>
                        <option>Monthly Commercial Vehicle (₹2,150)</option>
                        <option>Local Multiple Journey (₹550)</option>
                        <option>Exempted Emergency / Gov Pass (₹0)</option>
                      </select>
                    </div>
                  </div>
                  <button type="submit" className="op-btn-primary" style={{ marginTop: '16px' }}>
                    Generate &amp; Activate Pass
                  </button>
                </form>
              )}
            </div>
          )}

          {/* RECON MANAGEMENT */}
          {(opId === 'upload-recon' || opId === 'recon-status' || opId === 'trs-report' || opId === 'cycle-wise-report' || opId === 'violation-settlement-recon') && (
            <div className="op-section">
              <p className="op-desc">
                NPCI 2.4 &amp; 1.6 electronic toll collection reconciliation, cycle-wise clearing, and settlement discrepancy validation.
              </p>
              {reconUploaded ? (
                <div className="op-result-card green-border">
                  <h4 style={{ color: '#16a34a', marginBottom: '8px' }}>✓ File Uploaded &amp; Queued for NPCI Reconciliation</h4>
                  <p style={{ fontSize: '13px', color: '#475569' }}>
                    Batch ID: <strong>REC-2026-0922-8410</strong> · 1,482 transactions verified against Acquirer clearing.
                  </p>
                </div>
              ) : (
                <div>
                  <div className="op-upload-dropzone">
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.8">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    <p style={{ fontWeight: 600, marginTop: '8px', color: '#0f172a' }}>
                      Drag &amp; drop NPCI clearing file (.csv or .txt)
                    </p>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>Supports NPCI Spec 1.6 and 2.4</span>
                    <input
                      type="file"
                      style={{ marginTop: '12px' }}
                      onChange={(e) => setReconFile(e.target.files?.[0]?.name)}
                    />
                  </div>
                  <button
                    className="op-btn-primary"
                    onClick={handleUploadRecon}
                    style={{ marginTop: '16px' }}
                  >
                    Start Automated Reconciliation Check
                  </button>
                </div>
              )}
            </div>
          )}

          {/* DISPUTE HANDLING */}
          {(opId === 'dispute-dashboard' || opId === 'validate-dispute' || opId === 'approve-dispute' || opId === 'dispute-detail-report' || opId === 'dispute-file-upload') && (
            <div className="op-section">
              <p className="op-desc">
                NPCI NETC Chargeback arbitration, issuer decline investigations, and evidence submission.
              </p>
              <table className="op-table">
                <thead>
                  <tr>
                    <th>Dispute Ref</th>
                    <th>Vehicle Reg</th>
                    <th>Dispute Amount</th>
                    <th>Reason</th>
                    <th>SLA Deadline</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>DSP-0921-041</strong></td>
                    <td>MH 02 CE 1204</td>
                    <td>₹185.00</td>
                    <td>Double deduction</td>
                    <td><span className="op-tag orange">18h remaining</span></td>
                    <td><button className="op-btn-sm">Review &amp; Settle</button></td>
                  </tr>
                  <tr>
                    <td><strong>DSP-0921-042</strong></td>
                    <td>MH 12 QP 5510</td>
                    <td>₹260.00</td>
                    <td>Class mismatch (VC4 vs VC7)</td>
                    <td><span className="op-tag red">4h remaining</span></td>
                    <td><button className="op-btn-sm">Provide Evidence</button></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* FALLBACK FOR OTHER REPORTS / MODULES */}
          {!['request-tag-details', 'blacklist-history', 'pass-issuance', 'pass-view', 'upload-recon', 'recon-status', 'trs-report', 'cycle-wise-report', 'violation-settlement-recon', 'dispute-dashboard', 'validate-dispute', 'approve-dispute', 'dispute-detail-report', 'dispute-file-upload'].includes(opId) && (
            <div className="op-section">
              <p className="op-desc">
                Authorized workstation view for <strong>{operation.label}</strong>. Active telemetry live.
              </p>
              <div className="op-terminal">
                <div className="terminal-header">
                  <span className="t-dot" />
                  <span>PAYSONIC OPERATIONAL CONSOLE · SECURE LINK ACTIVE</span>
                </div>
                <div className="terminal-body">
                  <p>&gt; Module Clearance: <strong>{operation.label}</strong></p>
                  <p>&gt; Protocol: NPCI NETC 2.4 High-Volume Gateway</p>
                  <p>&gt; Status: All lanes synced, 0 packet loss, latency 14ms</p>
                  <p>&gt; Data pipeline ready for live operational queries.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="op-modal-footer">
          <button className="op-btn-outline" onClick={onClose}>
            Close Console
          </button>
        </div>
      </div>
    </div>
  );
};

export default OperationsModal;
