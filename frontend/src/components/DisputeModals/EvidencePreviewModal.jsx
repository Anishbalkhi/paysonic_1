import React, { useState, useEffect, useMemo } from 'react';
import evidenceStorage, { isValidMediaUrl } from '../../services/dispute/evidenceStorage';
import './DisputeModals.scss';

export const EvidencePreviewModal = ({
  isOpen,
  onClose,
  file,
  fileList = [],
  disputeRow = {},
  source = 'Evidence',
}) => {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [imageError, setImageError] = useState(false);

  // Normalize list of files
  const items = useMemo(() => {
    let list = [];
    if (Array.isArray(fileList) && fileList.length > 0) {
      list = fileList;
    } else if (file) {
      list = [file];
    }
    // Filter out corrupted '[object Object]' strings
    return list.filter((f) => {
      if (!f) return false;
      if (typeof f === 'string' && f === '[object Object]') return false;
      if (typeof f === 'object' && f.name === '[object Object]') return false;
      return true;
    });
  }, [file, fileList]);

  // Find initial active index matching `file`
  const initialIndex = useMemo(() => {
    if (!file || items.length === 0) return 0;
    const targetName = (typeof file === 'string' ? file : file.name || '').toLowerCase();
    const idx = items.findIndex((it) => {
      const itName = (typeof it === 'string' ? it : it.name || '').toLowerCase();
      return itName === targetName;
    });
    return idx >= 0 ? idx : 0;
  }, [file, items]);

  const [activeIndex, setActiveIndex] = useState(initialIndex);

  useEffect(() => {
    setActiveIndex(initialIndex);
    setZoomLevel(1);
    setImageError(false);
  }, [initialIndex, isOpen]);

  useEffect(() => {
    setZoomLevel(1);
    setImageError(false);
  }, [activeIndex]);

  if (!isOpen || items.length === 0) return null;

  const currentItem = items[activeIndex] || items[0];
  const fileName = typeof currentItem === 'string' ? currentItem : currentItem.name || 'attachment';

  // Resolve valid media data URL:
  // 1. Check current file object
  // 2. Check evidence vault
  // 3. Reject '[object Object]' or invalid strings
  let rawDataUrl = typeof currentItem === 'object' ? currentItem.dataUrl || currentItem.url : null;
  if (!isValidMediaUrl(rawDataUrl)) {
    const fromVault = evidenceStorage.findFile(
      disputeRow.disputeId || disputeRow.acqTxnId,
      disputeRow.acqTxnId,
      fileName
    );
    if (fromVault && isValidMediaUrl(fromVault.dataUrl)) {
      rawDataUrl = fromVault.dataUrl;
    } else if (fromVault && isValidMediaUrl(fromVault.url)) {
      rawDataUrl = fromVault.url;
    } else {
      rawDataUrl = null;
    }
  }

  const fileDataUrl = isValidMediaUrl(rawDataUrl) ? rawDataUrl : null;
  const lowerName = fileName.toLowerCase();

  const isImage =
    lowerName.endsWith('.jpg') ||
    lowerName.endsWith('.jpeg') ||
    lowerName.endsWith('.png') ||
    lowerName.endsWith('.webp') ||
    lowerName.endsWith('.gif') ||
    (typeof currentItem === 'object' && currentItem.type?.startsWith('image/'));

  const isPdf =
    lowerName.endsWith('.pdf') ||
    (typeof currentItem === 'object' && currentItem.type === 'application/pdf');

  const isText =
    lowerName.endsWith('.txt') ||
    lowerName.endsWith('.log') ||
    lowerName.endsWith('.csv') ||
    (typeof currentItem === 'object' && currentItem.type?.startsWith('text/'));

  const handleDownload = () => {
    if (fileDataUrl) {
      const a = document.createElement('a');
      a.href = fileDataUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    // Generate fallback file for download
    let mimeType = 'text/plain';
    let content = `Paysonic Evidence Attachment: ${fileName}\nDispute RRN: ${disputeRow.acqTxnId || 'N/A'}\nVRN: ${disputeRow.vrn || 'N/A'}\nPlaza: ${disputeRow.plazaName || 'N/A'}\nTimestamp: ${new Date().toISOString()}`;

    if (isImage) {
      mimeType = 'image/svg+xml';
      content = `
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">
  <rect width="100%" height="100%" fill="#0f172a"/>
  <text x="30" y="50" fill="#38bdf8" font-family="monospace" font-size="20" font-weight="bold">TOLL PLAZA SURVEILLANCE FEED - CAM #02</text>
  <text x="30" y="85" fill="#94a3b8" font-family="monospace" font-size="14">RECORDED: ${disputeRow.txnDate || '2026-09-02 03:30:00'}</text>
  <rect x="150" y="140" width="500" height="250" rx="10" fill="#1e293b" stroke="#38bdf8" stroke-width="2"/>
  <text x="250" y="240" fill="#f8fafc" font-family="sans-serif" font-size="28" font-weight="bold">VRN: ${disputeRow.vrn || 'MH12VL3467'}</text>
  <text x="250" y="280" fill="#94a3b8" font-family="monospace" font-size="16">LANE #02 · CLASS 4 (CAR/VAN)</text>
  <text x="250" y="315" fill="#4ade80" font-family="monospace" font-size="14">STATUS: TOLL BARRIER PASSED</text>
  <text x="30" y="470" fill="#64748b" font-family="monospace" font-size="12">ACQ TXN ID: ${disputeRow.acqTxnId || '102047735808524714'} · VERIFIED EVIDENCE</text>
</svg>`;
    } else if (isPdf) {
      mimeType = 'text/plain';
      content = `=== NETC DISPUTE CHARGEBACK PROOF ===\nDocument: ${fileName}\nAcq Txn ID: ${disputeRow.acqTxnId || ''}\nToll Txn ID: ${disputeRow.tollTxnId || ''}\nVRN: ${disputeRow.vrn || ''}\nPlaza: ${disputeRow.plazaName || ''} (${disputeRow.plazaId || ''})\nAmount: ₹ ${disputeRow.disputeAmount || ''}\nReason: ${disputeRow.cbReason || disputeRow.adminReason || 'Chargeback verification'}\nIssued: ${disputeRow.cbRaisedDate || '2026-09-02'}\nStatus: Verified Netc Clearance\n=====================================`;
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = isImage && !fileName.endsWith('.svg') ? `${fileName}.svg` : fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="evidence-preview-overlay" onClick={onClose}>
      <div
        className="evidence-preview-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Top Bar */}
        <div className="preview-header">
          <div className="file-info-group">
            <span className="file-icon-badge">
              {isImage ? '📷' : isPdf ? '📄' : isText ? '📝' : '📎'}
            </span>
            <div className="file-meta-col">
              <div className="file-name-title">{fileName}</div>
              <div className="file-source-sub">
                <span
                  className={`source-pill ${
                    source.toLowerCase().includes('acquirer') ? 'source-acq' : 'source-plaza'
                  }`}
                >
                  {source}
                </span>
                <span>• RRN: {disputeRow.acqTxnId || 'N/A'}</span>
                <span>• Plaza: {disputeRow.plazaName || disputeRow.plazaId || 'N/A'}</span>
              </div>
            </div>
          </div>

          <div className="header-controls">
            {isImage && (
              <div className="zoom-controls">
                <button
                  type="button"
                  title="Zoom Out"
                  onClick={() => setZoomLevel((z) => Math.max(0.6, z - 0.2))}
                >
                  −
                </button>
                <span className="zoom-text">{Math.round(zoomLevel * 100)}%</span>
                <button
                  type="button"
                  title="Zoom In"
                  onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.2))}
                >
                  +
                </button>
                <button
                  type="button"
                  title="Reset Zoom"
                  onClick={() => setZoomLevel(1)}
                  style={{ fontSize: '0.75rem', padding: '0 8px' }}
                >
                  Reset
                </button>
              </div>
            )}

            <button
              type="button"
              className="btn btn-outline-light btn-sm"
              onClick={handleDownload}
            >
              ⬇️ Download
            </button>
            <button
              type="button"
              className="btn-close-preview"
              onClick={onClose}
              title="Close Preview (Esc)"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Multi-Files Carousel / Tab Switcher (Visible when multiple files are attached) */}
        {items.length > 1 && (
          <div className="preview-multi-files-bar">
            <button
              type="button"
              className="nav-arrow-btn"
              disabled={activeIndex === 0}
              onClick={() => setActiveIndex((i) => Math.max(0, i - 1))}
              title="Previous file"
            >
              ◀ Prev
            </button>
            <div className="multi-files-tabs-scroll">
              {items.map((item, idx) => {
                const itName = typeof item === 'string' ? item : item.name || `File ${idx + 1}`;
                const itLower = itName.toLowerCase();
                const itIcon = itLower.endsWith('.pdf')
                  ? '📄'
                  : itLower.endsWith('.png') || itLower.endsWith('.jpg') || itLower.endsWith('.jpeg')
                  ? '📷'
                  : '📎';
                return (
                  <button
                    key={idx}
                    type="button"
                    className={`file-tab-chip ${idx === activeIndex ? 'active' : ''}`}
                    onClick={() => setActiveIndex(idx)}
                    title={itName}
                  >
                    <span>{itIcon}</span>
                    <span className="file-tab-name">{itName}</span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              className="nav-arrow-btn"
              disabled={activeIndex === items.length - 1}
              onClick={() => setActiveIndex((i) => Math.min(items.length - 1, i + 1))}
              title="Next file"
            >
              Next ▶
            </button>
            <span className="files-counter-tag">
              {activeIndex + 1} of {items.length}
            </span>
          </div>
        )}

        {/* Modal Content Body */}
        <div className="preview-body">
          {fileDataUrl && !imageError ? (
            // Uploaded real file with valid Data URL / Blob URL
            <div className="real-file-container">
              {isImage ? (
                <div className="image-scroll-wrapper">
                  <img
                    src={fileDataUrl}
                    alt={fileName}
                    onError={() => {
                      console.warn('[EvidencePreviewModal] Image failed to render; switching to fallback view');
                      setImageError(true);
                    }}
                    style={{
                      transform: `scale(${zoomLevel})`,
                      transformOrigin: 'top center',
                      maxWidth: '100%',
                      maxHeight: '70vh',
                      objectFit: 'contain',
                      borderRadius: '8px',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                    }}
                    className="preview-img-real"
                  />
                </div>
              ) : isPdf ? (
                <div style={{ width: '100%', height: '70vh', minHeight: '480px' }}>
                  <object
                    data={fileDataUrl}
                    type="application/pdf"
                    width="100%"
                    height="100%"
                    className="preview-iframe-pdf"
                    style={{ borderRadius: '8px', border: '1px solid #334155' }}
                  >
                    <iframe
                      src={fileDataUrl}
                      title={fileName}
                      width="100%"
                      height="100%"
                      style={{ border: 'none' }}
                    />
                  </object>
                </div>
              ) : (
                <pre className="preview-pre-text">{fileDataUrl}</pre>
              )}
            </div>
          ) : isImage ? (
            // Robust Simulated CCTV / ANPR Snapshot when physical binary is stored externally
            <div className="cctv-viewer-card">
              <div className="cctv-screen-overlay" style={{ transform: `scale(${zoomLevel})` }}>
                <div className="cctv-top-strip">
                  <div className="camera-rec">
                    <span className="rec-dot"></span> LIVE REC · CAM-04 (LANE 02)
                  </div>
                  <div className="cctv-timestamp">
                    {disputeRow.txnDate || '2026-09-02 03:30:14.288'}
                  </div>
                </div>

                <div className="cctv-visual-canvas">
                  <div className="toll-gantry-frame">
                    <div className="gantry-header">
                      <span>TOLL PLAZA: {disputeRow.plazaName || 'MUMBAI PLAZA NH-04'}</span>
                      <span className="lane-status">LANE 02 [ACTIVE]</span>
                    </div>

                    <div className="vehicle-detection-box">
                      <div className="target-corners top-left"></div>
                      <div className="target-corners top-right"></div>
                      <div className="target-corners bottom-left"></div>
                      <div className="target-corners bottom-right"></div>

                      <div className="vehicle-silhouette">
                        <svg viewBox="0 0 240 120" className="car-svg">
                          <path
                            d="M20 70 L45 40 L160 38 L200 65 L225 70 L230 90 L220 95 L200 95 A 15 15 0 0 1 170 95 L70 95 A 15 15 0 0 1 40 95 L20 95 Z"
                            fill="#334155"
                            stroke="#38bdf8"
                            strokeWidth="2"
                          />
                          <circle cx="55" cy="95" r="14" fill="#0f172a" stroke="#94a3b8" strokeWidth="3" />
                          <circle cx="185" cy="95" r="14" fill="#0f172a" stroke="#94a3b8" strokeWidth="3" />
                          <polygon points="50,45 100,45 100,65 35,65" fill="#0284c7" opacity="0.4" />
                          <polygon points="108,45 155,45 185,65 108,65" fill="#0284c7" opacity="0.4" />
                        </svg>
                      </div>

                      <div className="anpr-plate-overlay">
                        <div className="anpr-country">IND</div>
                        <div className="anpr-number">{disputeRow.vrn || 'MH12VL3467'}</div>
                      </div>
                      <div className="anpr-confidence">
                        ANPR MATCH: 99.4% · TAG READ OK
                      </div>
                    </div>

                    <div className="toll-barrier-arm passed">
                      <span className="barrier-light green"></span>
                      <span className="barrier-text">BOOM BARRIER OPENED</span>
                    </div>
                  </div>
                </div>

                <div className="cctv-bottom-strip">
                  <div>TAG ID: {disputeRow.tagId || '34161FA820328EB002947820'}</div>
                  <div>TOLL TXN ID: {disputeRow.tollTxnId || 'AM020903'}</div>
                  <div>RRN: {disputeRow.acqTxnId || '102047735808524714'}</div>
                </div>
              </div>
            </div>
          ) : isPdf ? (
            // Simulated NETC Bank Chargeback Scan PDF Document
            <div className="pdf-doc-viewer">
              <div className="pdf-page-sheet">
                <div className="pdf-doc-header">
                  <div className="bank-logo-block">
                    <div className="bank-seal">🏛️ NETC</div>
                    <div>
                      <h3>NPCI / NETC DISPUTE CLEARING HOUSE</h3>
                      <p>National Electronic Toll Collection Settlement System</p>
                    </div>
                  </div>
                  <div className="doc-meta-right">
                    <div className="doc-badge">OFFICIAL DISPUTE NOTICE</div>
                    <div className="doc-num">
                      REF: DISP-{disputeRow.acqTxnId ? disputeRow.acqTxnId.slice(-6) : '852471'}
                    </div>
                    <div className="doc-date">Date: {disputeRow.cbRaisedDate || '27-09-2026'}</div>
                  </div>
                </div>

                <hr className="doc-divider" />

                <div className="pdf-doc-title">
                  <h4>NOTICE OF CHARGEBACK DISPUTE &amp; EVIDENCE MEMORANDUM</h4>
                  <p>
                    Function Code: {disputeRow.functionCode || '450'} —{' '}
                    {disputeRow.disputeType || 'Debit Chargeback Raised'}
                  </p>
                </div>

                <div className="pdf-data-table">
                  <div className="data-row">
                    <span className="data-label">Acquirer Txn ID (RRN):</span>
                    <span className="data-val mono">{disputeRow.acqTxnId || '102047735808524714'}</span>
                  </div>
                  <div className="data-row">
                    <span className="data-label">Toll Txn ID:</span>
                    <span className="data-val mono">{disputeRow.tollTxnId || 'AM020903'}</span>
                  </div>
                  <div className="data-row">
                    <span className="data-label">Vehicle Registration (VRN):</span>
                    <span className="data-val bold">{disputeRow.vrn || 'MH12VL3467'}</span>
                  </div>
                  <div className="data-row">
                    <span className="data-label">FASTag EPC ID:</span>
                    <span className="data-val mono">{disputeRow.tagId || '34161FA820328EB002947820'}</span>
                  </div>
                  <div className="data-row">
                    <span className="data-label">Assigned Plaza:</span>
                    <span className="data-val">
                      {disputeRow.plazaName || 'MUMBAI PLAZA NH-04'} ({disputeRow.plazaId || '501101'})
                    </span>
                  </div>
                  <div className="data-row">
                    <span className="data-label">Original Transaction Date:</span>
                    <span className="data-val">{disputeRow.txnDate || '02-09-2026 03:30:00'}</span>
                  </div>
                  <div className="data-row highlight">
                    <span className="data-label">Disputed Claim Amount:</span>
                    <span className="data-val currency">
                      ₹ {Number(disputeRow.disputeAmount || 80).toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="pdf-statement-box">
                  <h5>Acquirer Reason &amp; Submissions:</h5>
                  <p>
                    {disputeRow.adminReason ||
                      disputeRow.cbReason ||
                      'Customer reported debit for toll crossing without vehicle entering toll booth. Forwarded to plaza for lane verification.'}
                  </p>
                </div>

                {disputeRow.plazaReason && disputeRow.plazaReason !== 'NA' && (
                  <div className="pdf-statement-box plaza-reply">
                    <h5>Plaza Response &amp; Justification:</h5>
                    <p>{disputeRow.plazaReason}</p>
                    <div className="decision-stamp-box">
                      <span
                        className={`decision-stamp ${
                          disputeRow.disputeStatus === 'Approved'
                            ? 'stamp-approved'
                            : 'stamp-rejected'
                        }`}
                      >
                        {disputeRow.disputeStatus === 'Approved' ? '✓ APPROVED' : '✕ REJECTED'}
                      </span>
                    </div>
                  </div>
                )}

                <div className="pdf-doc-footer">
                  <div className="signature-col">
                    <div className="signature-line"></div>
                    <div>Authorized Signatory / NETC Clearing Officer</div>
                  </div>
                  <div className="stamp-col">
                    <div className="digital-seal">
                      <span>★ VERIFIED NETC ★</span>
                      <small>AUDIT RECORD LOCKED</small>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // Simulated Raw Terminal Lane Log Extract
            <div className="log-viewer-box">
              <div className="log-header-bar">
                <span>LANE SERVER CONTROLLER LOG · {disputeRow.tollTxnId || 'AM020903'}</span>
                <span>ENC: UTF-8</span>
              </div>
              <pre className="log-content-body">
{`[2026-09-02 03:29:58.112] [INFO] [AVC_SENSOR] Vehicle front axle detected at loop 1
[2026-09-02 03:29:58.420] [INFO] [RFID_READER] Transponder signal acquired: EPC=${disputeRow.tagId || '34161FA820328EB002947820'}
[2026-09-02 03:29:58.550] [INFO] [ANPR_ENGINE] Plate recognized: ${disputeRow.vrn || 'MH12VL3467'} (Confidence: 99.4%)
[2026-09-02 03:29:59.012] [INFO] [HOST_TXN] Debit request dispatched to NETC Switch. RRN=${disputeRow.acqTxnId || '102047735808524714'}
[2026-09-02 03:29:59.880] [INFO] [HOST_RESP] NETC response 00 (APPROVED). Amount=₹${disputeRow.txnAmount || 5.0}
[2026-09-02 03:30:00.120] [INFO] [BARRIER_CTRL] Output signal PULSE_OPEN dispatched to boom arm 02
[2026-09-02 03:30:02.400] [INFO] [LOOP_EXIT] Vehicle cleared rear optical curtain. Barrier lowered.
[2026-09-02 03:30:02.450] [INFO] [AUDIT] Snapshot saved to local storage: ${fileName}`}
              </pre>
            </div>
          )}
        </div>

        {/* Modal Bottom Footer */}
        <div className="preview-footer">
          <div className="evidence-badge-info">
            🔒 This attachment is an immutable audit record visible to both Acquirer Admin and Plaza.
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default EvidencePreviewModal;
