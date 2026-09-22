import React, { useState } from 'react';
import './WorkstationTerminal.scss';

export const WorkstationTerminal = ({ userRole, currentUser, onOpenOp }) => {
  const [tagQuery, setTagQuery] = useState('34161FA82032849');
  const [queriedResult, setQueriedResult] = useState(null);
  const [isSearching, setIsSearching] = useState(false);

  // Default simulated tag database
  const TAG_MOCK_DB = {
    '34161FA82032849': {
      tagId: '34161FA82032849',
      tid: 'E2003412013849102834',
      vehicleClass: 'VC4 (Car / Jeep / Van)',
      regNumber: 'MH 12 Q 9821',
      issuerBank: 'HDFC Bank Ltd',
      status: 'ACTIVE / NORMAL',
      blacklistStatus: 'CLEAR (Not in Blacklist)',
      balanceStatus: 'Adequate Balance (₹1,450.00)',
      customerName: 'Anil Deshmukh',
      lastSeenPlaza: 'Airoli Bridge (Lane 04)',
    },
    'MH 02 CZ 4402': {
      tagId: '34161FA90234199',
      tid: 'E2003412099881123401',
      vehicleClass: 'VC4 (Private Car)',
      regNumber: 'MH 02 CZ 4402',
      issuerBank: 'ICICI Bank FASTag',
      status: 'ACTIVE / NORMAL',
      blacklistStatus: 'CLEAR (Verified)',
      balanceStatus: 'Adequate Balance (₹820.00)',
      customerName: 'Ramesh Verma',
      lastSeenPlaza: 'Vashi Creek Bridge',
    },
    'MH 04 AZ 1024': {
      tagId: '34161FA902341',
      tid: 'E2003412019928374615',
      vehicleClass: 'VC5 (Light Commercial)',
      regNumber: 'MH 04 AZ 1024',
      issuerBank: 'State Bank of India',
      status: 'LOW_BALANCE',
      blacklistStatus: 'BLACKLISTED: Negative Balance (-₹120.00)',
      balanceStatus: 'Insufficient Balance',
      customerName: 'Kunal Patil',
      lastSeenPlaza: 'Vashi Creek Bridge',
    },
  };

  const handleSearch = (e) => {
    e?.preventDefault();
    setIsSearching(true);
    setTimeout(() => {
      const q = tagQuery.trim();
      const match = TAG_MOCK_DB[q] || {
        tagId: q.startsWith('341') ? q : '34161FA' + Math.floor(1000000 + Math.random() * 9000000),
        tid: 'E200' + Math.floor(1000000000000000 + Math.random() * 9000000000000000),
        vehicleClass: 'VC4 (Car / Jeep / Van)',
        regNumber: q.startsWith('MH') ? q : 'MH 14 CC 8412',
        issuerBank: 'Axis Bank FASTag',
        status: 'ACTIVE / NORMAL',
        blacklistStatus: 'CLEAR (Passed NETC Sync)',
        balanceStatus: 'Adequate Balance (₹500.00)',
        customerName: 'Registered Commuter',
        lastSeenPlaza: currentUser?.assignedPlaza || 'Local Plaza',
      };
      setQueriedResult(match);
      setIsSearching(false);
    }, 250);
  };

  const isPOS = userRole === 'Plaza POS';

  return (
    <div className="workstation-container">
      {/* Live Hardware & Telemetry Bar */}
      <div className="telemetry-bar">
        <div className="telemetry-item">
          <span className="dot online" />
          <span className="lbl">Booth Terminal:</span>
          <strong>{currentUser?.assignedPlaza || (isPOS ? 'Airoli Bridge (Lane 04)' : 'Khed Shivapur Lane 02')}</strong>
        </div>
        <div className="telemetry-item">
          <span className="dot online" />
          <span className="lbl">RFID Reader:</span>
          <span className="val">Online (UHF 865-867 MHz)</span>
        </div>
        <div className="telemetry-item">
          <span className="dot online" />
          <span className="lbl">Optical Sensor:</span>
          <span className="val">0.4ms Latency</span>
        </div>
        <div className="telemetry-item">
          <span className="dot online" />
          <span className="lbl">NPCI NETC Sync:</span>
          <span className="val">Synchronized</span>
        </div>
      </div>

      {/* Quick Lookup Card */}
      <div className="ws-card">
        <div className="ws-card-header">
          <div className="title-group">
            <span className="badge-tag">FASTag NETC Query</span>
            <h4>{isPOS ? 'Lane Reader & Quick Inquiry' : 'NPCI NETC FASTag Inquiry Terminal'}</h4>
          </div>
          <span className="note">Instant Tag validation against national clearing database</span>
        </div>

        <form onSubmit={handleSearch} className="ws-search-form">
          <div className="ws-input-wrap">
            <input
              type="text"
              value={tagQuery}
              onChange={(e) => setTagQuery(e.target.value)}
              placeholder="Scan Barcode, RFID Tag ID (e.g. 34161FA82032849) or Vehicle Reg (e.g. MH 02 CZ 4402)"
              className="ws-input"
            />
            <button type="submit" className="ws-search-btn" disabled={isSearching}>
              {isSearching ? 'Querying NPCI...' : 'Inspect Tag'}
            </button>
          </div>
          <div className="quick-suggestions">
            <span>Quick Test:</span>
            <button type="button" onClick={() => { setTagQuery('34161FA82032849'); setTimeout(handleSearch, 50); }}>
              Active Car (MH 12 Q 9821)
            </button>
            <button type="button" onClick={() => { setTagQuery('MH 02 CZ 4402'); setTimeout(handleSearch, 50); }}>
              Pass Holder (MH 02 CZ 4402)
            </button>
            <button type="button" onClick={() => { setTagQuery('MH 04 AZ 1024'); setTimeout(handleSearch, 50); }}>
              Blacklisted Tag (Low Balance)
            </button>
          </div>
        </form>

        {queriedResult && (
          <div className={`ws-result-box ${queriedResult.blacklistStatus.includes('BLACKLISTED') ? 'danger' : 'success'}`}>
            <div className="res-header">
              <span className={`status-pill ${queriedResult.blacklistStatus.includes('BLACKLISTED') ? 'red' : 'green'}`}>
                {queriedResult.blacklistStatus.includes('BLACKLISTED') ? '⚠ BLACKLISTED / BLOCKED' : '✓ CLEAR / AUTHORIZED FOR PASSAGE'}
              </span>
              <span className="meta-time">Verified via NETC 2.4</span>
            </div>

            <div className="res-grid">
              <div className="res-item">
                <span className="k">Tag EPC / Barcode</span>
                <span className="v font-mono">{queriedResult.tagId}</span>
              </div>
              <div className="res-item">
                <span className="k">Vehicle Registration</span>
                <span className="v font-bold">{queriedResult.regNumber}</span>
              </div>
              <div className="res-item">
                <span className="k">Vehicle Class</span>
                <span className="v">{queriedResult.vehicleClass}</span>
              </div>
              <div className="res-item">
                <span className="k">Issuer Bank</span>
                <span className="v">{queriedResult.issuerBank}</span>
              </div>
              <div className="res-item">
                <span className="k">Account / Balance Status</span>
                <span className={`v ${queriedResult.balanceStatus.includes('Adequate') ? 'text-green' : 'text-red'}`}>
                  {queriedResult.balanceStatus}
                </span>
              </div>
              <div className="res-item">
                <span className="k">Customer Profile</span>
                <span className="v">{queriedResult.customerName}</span>
              </div>
            </div>

            {isPOS && (
              <div className="res-actions">
                <button
                  type="button"
                  className="btn-action primary"
                  onClick={() => onOpenOp({ label: 'A. Pass Issuance', path: '#pass-issuance' })}
                >
                  + Issue Vehicle Pass for {queriedResult.regNumber}
                </button>
                <button
                  type="button"
                  className="btn-action outline"
                  onClick={() => onOpenOp({ label: 'B. Blacklist Search History', path: '#blacklist-history' })}
                >
                  View Blacklist Log
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Role Action Modules */}
      <div className="ws-modules-grid">
        {/* Module 1: Tag Details */}
        <div className="ws-module-card">
          <div className="mod-header">
            <span className="mod-icon">🏷️</span>
            <div>
              <h5>Tag Details</h5>
              <p>NPCI NETC Tag status and exception log</p>
            </div>
          </div>
          <div className="mod-buttons">
            <button
              type="button"
              className="mod-btn"
              onClick={() => onOpenOp({ label: 'A. Request Tag Details', path: '#request-tag-details' })}
            >
              <span className="num">A</span>
              <span className="txt">Request Tag Details</span>
              <span className="arr">→</span>
            </button>
            <button
              type="button"
              className="mod-btn"
              onClick={() => onOpenOp({ label: 'B. Blacklist Search History', path: '#blacklist-history' })}
            >
              <span className="num">B</span>
              <span className="txt">Blacklist Search History</span>
              <span className="arr">→</span>
            </button>
          </div>
        </div>

        {/* Module 2: Pass Issuance (Plaza POS Only) */}
        {isPOS && (
          <div className="ws-module-card highlight">
            <div className="mod-header">
              <span className="mod-icon">🎫</span>
              <div>
                <h5>Pass Issuance Management</h5>
                <p>Local commuter, monthly pass &amp; customer approvals</p>
              </div>
            </div>
            <div className="mod-buttons">
              <button
                type="button"
                className="mod-btn primary-tint"
                onClick={() => onOpenOp({ label: 'A. Pass Issuance', path: '#pass-issuance' })}
              >
                <span className="num">A</span>
                <span className="txt">Pass Issuance (New Pass)</span>
                <span className="arr">→</span>
              </button>
              <button
                type="button"
                className="mod-btn"
                onClick={() => onOpenOp({ label: 'B. Pass Issuance Approval', path: '#pass-issuance-approval' })}
              >
                <span className="num">B</span>
                <span className="txt">Pass Issuance Approval</span>
                <span className="arr">→</span>
              </button>
              <button
                type="button"
                className="mod-btn"
                onClick={() => onOpenOp({ label: 'C. Pass Issuance View', path: '#pass-issuance-view' })}
              >
                <span className="num">C</span>
                <span className="txt">Pass Issuance View</span>
                <span className="arr">→</span>
              </button>
              <button
                type="button"
                className="mod-btn"
                onClick={() => onOpenOp({ label: 'D. View Customer', path: '#view-customer' })}
              >
                <span className="num">D</span>
                <span className="txt">View Customer</span>
                <span className="arr">→</span>
              </button>
              <button
                type="button"
                className="mod-btn"
                onClick={() => onOpenOp({ label: 'E. Customer Approval', path: '#customer-approval' })}
              >
                <span className="num">E</span>
                <span className="txt">Customer Approval</span>
                <span className="arr">→</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkstationTerminal;
