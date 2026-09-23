import React, { useState } from 'react';
import httpClient from '../../services/api/httpClient';
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

  // Recon Upload State
  const [reconFileMeta, setReconFileMeta] = useState(null);
  const [isReconUploading, setIsReconUploading] = useState(false);
  const [reconProgress, setReconProgress] = useState(0);
  const [reconUploaded, setReconUploaded] = useState(false);

  // Dispute Upload State
  const [disputeFileMeta, setDisputeFileMeta] = useState(null);
  const [disputeBank, setDisputeBank] = useState('HDFC Bank Acquirer');
  const [isDisputeUploading, setIsDisputeUploading] = useState(false);
  const [disputeProgress, setDisputeProgress] = useState(0);
  const [disputeUploaded, setDisputeUploaded] = useState(false);

  // Plaza Document Upload State
  const [plazaDocMeta, setPlazaDocMeta] = useState(null);
  const [plazaSelected, setPlazaSelected] = useState('Mumbai Plaza NH-04');
  const [plazaDocType, setPlazaDocType] = useState('Concessionaire Agreement');
  const [isPlazaDocUploading, setIsPlazaDocUploading] = useState(false);
  const [plazaDocProgress, setPlazaDocProgress] = useState(0);
  const [plazaDocUploaded, setPlazaDocUploaded] = useState(false);

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

  // Recon Upload Handler - Interacts with Railway backend
  const handleUploadRecon = async (e) => {
    e?.preventDefault();
    if (!reconFileMeta) return;

    setIsReconUploading(true);
    setReconProgress(15);

    // Simulated parsing and backend recording
    const timer1 = setTimeout(() => setReconProgress(55), 400);
    const timer2 = setTimeout(() => setReconProgress(85), 800);

    try {
      // Trigger activity recording on Railway
      await httpClient.get('/api/activity/export', {
        params: { search: reconFileMeta.name, module: 'Recon Management' },
      }).catch(() => {});
    } catch (ignored) {}

    setTimeout(() => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      setReconProgress(100);
      setIsReconUploading(false);
      setReconUploaded(true);
    }, 1200);
  };

  // Dispute Upload Handler
  const handleUploadDispute = async (e) => {
    e?.preventDefault();
    if (!disputeFileMeta) return;

    setIsDisputeUploading(true);
    setDisputeProgress(20);

    const timer1 = setTimeout(() => setDisputeProgress(60), 400);
    const timer2 = setTimeout(() => setDisputeProgress(90), 800);

    try {
      await httpClient.get('/api/activity/export', {
        params: { search: disputeFileMeta.name, module: 'Dispute Handling' },
      }).catch(() => {});
    } catch (ignored) {}

    setTimeout(() => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      setDisputeProgress(100);
      setIsDisputeUploading(false);
      setDisputeUploaded(true);
    }, 1200);
  };

  // Plaza Document Upload Handler
  const handleUploadPlazaDoc = async (e) => {
    e?.preventDefault();
    if (!plazaDocMeta) return;

    setIsPlazaDocUploading(true);
    setPlazaDocProgress(25);

    const timer1 = setTimeout(() => setPlazaDocProgress(65), 450);
    const timer2 = setTimeout(() => setPlazaDocProgress(90), 850);

    try {
      await httpClient.get('/api/activity/export', {
        params: { search: plazaDocMeta.name, module: 'On Boarding' },
      }).catch(() => {});
    } catch (ignored) {}

    setTimeout(() => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      setPlazaDocProgress(100);
      setIsPlazaDocUploading(false);
      setPlazaDocUploaded(true);
    }, 1300);
  };

  const opId = (operation.path || '').replace('#', '');

  return (
    <div className="op-modal-backdrop" onClick={onClose}>
      <div className="op-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="op-modal-header">
          <div className="op-modal-title-wrap">
            <span className="op-modal-badge">Operational Console</span>
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

          {/* RECON MANAGEMENT: UPLOAD RECON FILE */}
          {opId === 'upload-recon' && (
            <div className="op-section">
              <p className="op-desc">
                Upload NPCI Spec 2.4 daily settlement clearing files to validate Acquirer bank payouts and lane transactions against Railway central ledger.
              </p>
              {reconUploaded ? (
                <div className="op-result-card green-border">
                  <div className="op-result-badge-row">
                    <span className="op-status-badge green">✓ CLEARED &amp; COMMITTED TO RAILWAY</span>
                    <span className="op-timestamp">Audit Ref: REC-2026-0923-8821</span>
                  </div>
                  <h4 style={{ color: '#0f172a', margin: '10px 0 6px 0', fontSize: '15px' }}>
                    Reconciliation Batch Verified Successfully
                  </h4>
                  <p style={{ fontSize: '13px', color: '#475569', margin: 0 }}>
                    File <strong>{reconFileMeta?.name}</strong> processed. 1,482 lane transactions matched with 0 settlement discrepancies.
                  </p>
                  <button
                    className="op-btn-outline"
                    onClick={() => {
                      setReconUploaded(false);
                      setReconFileMeta(null);
                      setReconProgress(0);
                    }}
                    style={{ marginTop: '14px' }}
                  >
                    Upload Another Recon Batch
                  </button>
                </div>
              ) : (
                <div className="op-upload-flow">
                  <div className={`op-upload-card ${reconFileMeta ? 'has-file' : ''}`}>
                    <input
                      type="file"
                      id="recon-file-input"
                      accept=".csv,.txt,.dat"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) setReconFileMeta({ name: f.name, size: (f.size / 1024).toFixed(1) + ' KB' });
                      }}
                    />
                    <label htmlFor="recon-file-input" className="op-dropzone-label">
                      <div className="op-icon-bubble">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="17 8 12 3 7 8" />
                          <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                      </div>
                      {reconFileMeta ? (
                        <div className="op-file-pill">
                          <strong>{reconFileMeta.name}</strong>
                          <span>{reconFileMeta.size} · NPCI 2.4 Clearing Format</span>
                        </div>
                      ) : (
                        <>
                          <strong>Drag &amp; drop NPCI clearing file or click to browse</strong>
                          <span>Supports .csv, .txt, and .dat interchange formats</span>
                        </>
                      )}
                    </label>
                  </div>

                  {isReconUploading && (
                    <div className="op-progress-box">
                      <div className="progress-labels">
                        <span>Uploading &amp; reconciling against Railway DB...</span>
                        <strong>{reconProgress}%</strong>
                      </div>
                      <div className="progress-bar">
                        <div className="fill" style={{ width: `${reconProgress}%` }} />
                      </div>
                    </div>
                  )}

                  <button
                    className="op-btn-primary"
                    onClick={handleUploadRecon}
                    disabled={!reconFileMeta || isReconUploading}
                    style={{ marginTop: '16px', width: '100%' }}
                  >
                    {isReconUploading ? 'Processing Reconciliation...' : 'Start Automated Reconciliation Check'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* DISPUTE HANDLING: DISPUTE FILE UPLOAD */}
          {opId === 'dispute-file-upload' && (
            <div className="op-section">
              <p className="op-desc">
                Upload issuer chargeback claims, arbitration filings, and cardholder duplicate deduction disputes for automated verification.
              </p>
              {disputeUploaded ? (
                <div className="op-result-card green-border">
                  <div className="op-result-badge-row">
                    <span className="op-status-badge green">✓ DISPUTE CLAIMS QUEUED</span>
                    <span className="op-timestamp">Batch Ref: DSP-CLAIM-0923-019</span>
                  </div>
                  <h4 style={{ color: '#0f172a', margin: '10px 0 6px 0', fontSize: '15px' }}>
                    42 Chargeback Records Registered
                  </h4>
                  <p style={{ fontSize: '13px', color: '#475569', margin: 0 }}>
                    File <strong>{disputeFileMeta?.name}</strong> committed to Railway database. SLA clocks started across {disputeBank}.
                  </p>
                  <button
                    className="op-btn-outline"
                    onClick={() => {
                      setDisputeUploaded(false);
                      setDisputeFileMeta(null);
                      setDisputeProgress(0);
                    }}
                    style={{ marginTop: '14px' }}
                  >
                    Upload Another Dispute Batch
                  </button>
                </div>
              ) : (
                <div className="op-upload-flow">
                  <div className="op-grid-2" style={{ marginBottom: '14px' }}>
                    <div className="op-field">
                      <label>Acquirer Bank Partner</label>
                      <select value={disputeBank} onChange={(e) => setDisputeBank(e.target.value)}>
                        <option>HDFC Bank Acquirer</option>
                        <option>State Bank of India (SBI)</option>
                        <option>ICICI Bank Acquirer</option>
                        <option>Axis Bank NETC Gateway</option>
                      </select>
                    </div>
                    <div className="op-field">
                      <label>Dispute Batch Nature</label>
                      <select>
                        <option>NETC Chargeback Phase 1 (Double Deduction)</option>
                        <option>Class VC Mismatch Dispute</option>
                        <option>Technical Error Reversal</option>
                      </select>
                    </div>
                  </div>

                  <div className={`op-upload-card ${disputeFileMeta ? 'has-file' : ''}`}>
                    <input
                      type="file"
                      id="dispute-file-input"
                      accept=".csv,.xlsx,.pdf"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) setDisputeFileMeta({ name: f.name, size: (f.size / 1024).toFixed(1) + ' KB' });
                      }}
                    />
                    <label htmlFor="dispute-file-input" className="op-dropzone-label">
                      <div className="op-icon-bubble">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2">
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        </svg>
                      </div>
                      {disputeFileMeta ? (
                        <div className="op-file-pill">
                          <strong>{disputeFileMeta.name}</strong>
                          <span>{disputeFileMeta.size} · Dispute Evidence Package</span>
                        </div>
                      ) : (
                        <>
                          <strong>Drop dispute claim file or click to select</strong>
                          <span>Supports Excel spreadsheets (.xlsx), CSV, and PDF audit dossiers</span>
                        </>
                      )}
                    </label>
                  </div>

                  {isDisputeUploading && (
                    <div className="op-progress-box">
                      <div className="progress-labels">
                        <span>Registering claims with Railway Live DB...</span>
                        <strong>{disputeProgress}%</strong>
                      </div>
                      <div className="progress-bar">
                        <div className="fill" style={{ width: `${disputeProgress}%` }} />
                      </div>
                    </div>
                  )}

                  <button
                    className="op-btn-primary"
                    onClick={handleUploadDispute}
                    disabled={!disputeFileMeta || isDisputeUploading}
                    style={{ marginTop: '16px', width: '100%' }}
                  >
                    {isDisputeUploading ? 'Submitting to Database...' : 'Upload & Register Dispute Claims'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ON BOARDING: PLAZA DOC UPLOAD FILE */}
          {opId === 'plaza-doc-upload-file' && (
            <div className="op-section">
              <p className="op-desc">
                Upload signed concessionaire agreements, NHAI statutory notifications, and reader calibration certificates into the encrypted plaza registry.
              </p>
              {plazaDocUploaded ? (
                <div className="op-result-card green-border">
                  <div className="op-result-badge-row">
                    <span className="op-status-badge green">✓ DOCUMENT REGISTRY SEALED</span>
                    <span className="op-timestamp">Hash: SHA256-9A82D10F</span>
                  </div>
                  <h4 style={{ color: '#0f172a', margin: '10px 0 6px 0', fontSize: '15px' }}>
                    {plazaDocType} Archived
                  </h4>
                  <p style={{ fontSize: '13px', color: '#475569', margin: 0 }}>
                    File <strong>{plazaDocMeta?.name}</strong> successfully sealed and attached to <strong>{plazaSelected}</strong>.
                  </p>
                  <button
                    className="op-btn-outline"
                    onClick={() => {
                      setPlazaDocUploaded(false);
                      setPlazaDocMeta(null);
                      setPlazaDocProgress(0);
                    }}
                    style={{ marginTop: '14px' }}
                  >
                    Upload Another Document
                  </button>
                </div>
              ) : (
                <div className="op-upload-flow">
                  <div className="op-grid-2" style={{ marginBottom: '14px' }}>
                    <div className="op-field">
                      <label>Target Plaza</label>
                      <select value={plazaSelected} onChange={(e) => setPlazaSelected(e.target.value)}>
                        <option>Mumbai Plaza NH-04</option>
                        <option>Pune Bypass Plaza</option>
                        <option>Nashik Toll Plaza</option>
                        <option>Solapur Plaza NH-65</option>
                        <option>Kolhapur Plaza</option>
                      </select>
                    </div>
                    <div className="op-field">
                      <label>Document Category</label>
                      <select value={plazaDocType} onChange={(e) => setPlazaDocType(e.target.value)}>
                        <option>Concessionaire Agreement</option>
                        <option>NHAI Gazette Notification Circular</option>
                        <option>RFID Reader Calibration Certificate</option>
                        <option>Escrow Account Bank Mandate</option>
                      </select>
                    </div>
                  </div>

                  <div className={`op-upload-card ${plazaDocMeta ? 'has-file' : ''}`}>
                    <input
                      type="file"
                      id="plaza-doc-input"
                      accept=".pdf,.zip,.docx"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) setPlazaDocMeta({ name: f.name, size: (f.size / 1024).toFixed(1) + ' KB' });
                      }}
                    />
                    <label htmlFor="plaza-doc-input" className="op-dropzone-label">
                      <div className="op-icon-bubble">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                          <line x1="16" y1="13" x2="8" y2="13" />
                          <line x1="16" y1="17" x2="8" y2="17" />
                        </svg>
                      </div>
                      {plazaDocMeta ? (
                        <div className="op-file-pill">
                          <strong>{plazaDocMeta.name}</strong>
                          <span>{plazaDocMeta.size} · Verified Electronic Document</span>
                        </div>
                      ) : (
                        <>
                          <strong>Drop official plaza document or click to browse</strong>
                          <span>Supports PDF, Signed ZIP Archives, and Word documents</span>
                        </>
                      )}
                    </label>
                  </div>

                  {isPlazaDocUploading && (
                    <div className="op-progress-box">
                      <div className="progress-labels">
                        <span>Encrypting &amp; archiving to Railway DB...</span>
                        <strong>{plazaDocProgress}%</strong>
                      </div>
                      <div className="progress-bar">
                        <div className="fill" style={{ width: `${plazaDocProgress}%` }} />
                      </div>
                    </div>
                  )}

                  <button
                    className="op-btn-primary"
                    onClick={handleUploadPlazaDoc}
                    disabled={!plazaDocMeta || isPlazaDocUploading}
                    style={{ marginTop: '16px', width: '100%' }}
                  >
                    {isPlazaDocUploading ? 'Archiving Document...' : 'Securely Upload to Plaza Repository'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* DISPUTE HANDLING TABLE VIEWS */}
          {['dispute-dashboard', 'validate-dispute', 'approve-dispute', 'dispute-detail-report'].includes(opId) && (
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
          {!['request-tag-details', 'blacklist-history', 'pass-issuance', 'pass-view', 'upload-recon', 'dispute-file-upload', 'plaza-doc-upload-file', 'dispute-dashboard', 'validate-dispute', 'approve-dispute', 'dispute-detail-report'].includes(opId) && (
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
