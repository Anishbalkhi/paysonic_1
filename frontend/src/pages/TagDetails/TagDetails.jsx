import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './TagDetails.scss';

export const TagDetails = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const userRole = currentUser?.role || 'Admin';

  const tabParam = searchParams.get('tab') || 'request';
  const [activeTab, setActiveTab] = useState(tabParam);

  useEffect(() => {
    if (tabParam) setActiveTab(tabParam);
  }, [tabParam]);

  const handleTabChange = (tabKey) => {
    setActiveTab(tabKey);
    setSearchParams({ tab: tabKey });
  };

  // State for Request Tag Details query
  const [tagQuery, setTagQuery] = useState('34161FA82032849');
  const [isSearching, setIsSearching] = useState(false);
  const [queryResult, setQueryResult] = useState({
    tagId: '34161FA82032849',
    tid: 'E2003412013849102834',
    vehicleClass: 'VC4 (Car / Jeep / Van)',
    regNumber: 'MH 12 Q 9821',
    issuerBank: 'HDFC Bank Ltd',
    customerName: 'Anil Deshmukh',
    mobile: '+91 98201 44821',
    status: 'ACTIVE / NORMAL',
    blacklistStatus: 'CLEAR (Not in Blacklist)',
    balanceStatus: 'Adequate Balance (₹1,450.00)',
    npciSyncTime: new Date().toLocaleTimeString(),
    exemptionStatus: 'Non-Exempted (Commercial Toll Applies)',
  });

  // State for Blacklist Search History
  const [historySearch, setHistorySearch] = useState('');
  const [historyFilter, setHistoryFilter] = useState('all');

  const MOCK_BLACKLIST_RECORDS = [
    {
      id: 'BL-9901',
      tagId: '34161FA90234101',
      regNumber: 'MH 04 AZ 1024',
      vehicleClass: 'VC4',
      reason: 'Low Balance / Frozen',
      reasonCode: '03',
      plaza: 'Vashi Creek Bridge',
      lane: 'Lane 02',
      syncTime: 'Today, 14:12:05',
      badgeClass: 'badge-danger',
    },
    {
      id: 'BL-9902',
      tagId: '34161FA88471202',
      regNumber: 'MH 14 CC 8412',
      vehicleClass: 'VC5',
      reason: 'Hotlisted / Stolen',
      reasonCode: '01',
      plaza: 'Airoli Bridge',
      lane: 'Lane 04',
      syncTime: 'Today, 13:45:22',
      badgeClass: 'badge-critical',
    },
    {
      id: 'BL-9903',
      tagId: '34161FA99120403',
      regNumber: 'MH 01 BK 3301',
      vehicleClass: 'VC4',
      reason: 'Invalid Tag / Tampered',
      reasonCode: '05',
      plaza: 'Khed Shivapur',
      lane: 'Lane 01',
      syncTime: 'Today, 12:30:11',
      badgeClass: 'badge-warning',
    },
    {
      id: 'BL-9904',
      tagId: '34161FA77239004',
      regNumber: 'MH 02 DX 5590',
      vehicleClass: 'VC7',
      reason: 'Class Mismatch (VC4 tag on VC7 Truck)',
      reasonCode: '08',
      plaza: 'Vashi Creek Bridge',
      lane: 'Lane 06',
      syncTime: 'Today, 11:15:40',
      badgeClass: 'badge-warning',
    },
    {
      id: 'BL-9905',
      tagId: '34161FA66104805',
      regNumber: 'MH 46 P 2219',
      vehicleClass: 'VC4',
      reason: 'Low Balance / Frozen',
      reasonCode: '03',
      plaza: 'Airoli Bridge',
      lane: 'Lane 03',
      syncTime: 'Today, 10:48:19',
      badgeClass: 'badge-danger',
    },
  ];

  const handleSearchTag = (e) => {
    e?.preventDefault();
    if (!tagQuery.trim()) return;
    setIsSearching(true);
    setTimeout(() => {
      const q = tagQuery.trim();
      const isBlacklisted = q.includes('1024') || q.toLowerCase().includes('low') || q.includes('8412');
      setQueryResult({
        tagId: q.startsWith('341') ? q : '34161FA' + Math.floor(1000000 + Math.random() * 9000000),
        tid: 'E200341201' + Math.floor(1000000000 + Math.random() * 9000000000),
        vehicleClass: q.includes('Truck') ? 'VC7 (Multi-Axle Truck)' : 'VC4 (Car / Jeep / Van)',
        regNumber: q.startsWith('MH') || q.startsWith('DL') ? q : 'MH 02 CZ 4402',
        issuerBank: 'HDFC Bank Ltd',
        customerName: 'Verified Vehicle Owner',
        mobile: '+91 98201 55920',
        status: isBlacklisted ? 'BLACKLISTED' : 'ACTIVE / NORMAL',
        blacklistStatus: isBlacklisted
          ? 'BLACKLISTED (Reason: Negative Balance -₹140.00)'
          : 'CLEAR (Not in NPCI Exception List)',
        balanceStatus: isBlacklisted ? 'Insufficient Balance (-₹140.00)' : 'Adequate Balance (₹820.00)',
        npciSyncTime: new Date().toLocaleTimeString(),
        exemptionStatus: 'Standard Fastag (Toll Applicable)',
      });
      setIsSearching(false);
    }, 300);
  };

  const filteredHistory = MOCK_BLACKLIST_RECORDS.filter((rec) => {
    if (historyFilter === 'low' && !rec.reason.toLowerCase().includes('low')) return false;
    if (historyFilter === 'hot' && !rec.reason.toLowerCase().includes('hot')) return false;
    if (historyFilter === 'tamper' && !rec.reason.toLowerCase().includes('tamper') && !rec.reason.toLowerCase().includes('class')) return false;
    if (!historySearch) return true;
    const q = historySearch.toLowerCase();
    return (
      rec.tagId.toLowerCase().includes(q) ||
      rec.regNumber.toLowerCase().includes(q) ||
      rec.reason.toLowerCase().includes(q) ||
      rec.plaza.toLowerCase().includes(q)
    );
  });

  return (
    <div className="tag-details-page">
      {/* Page Header */}
      <div className="page-header">
        <div className="header-info">
          <div className="badge-row">
            <span className="role-clearance-badge">
              <span className="dot" />
              NETC Registry Clearance Active
            </span>
            <span className="protocol-badge">NPCI NETC Spec 2.4</span>
            {currentUser?.assignedPlaza && (
              <span className="plaza-badge">📍 {currentUser.assignedPlaza}</span>
            )}
          </div>
          <h2>Tag Details Management</h2>
          <p>
            Real-time query terminal for NPCI FASTag verification, exception blacklist logs, and issuer bank balance status.
          </p>
        </div>
        {userRole === 'Plaza POS' && (
          <div className="header-action">
            <button
              type="button"
              className="btn-pass-shortcut"
              onClick={() => navigate('/pass-issuance')}
            >
              <span>🎫</span> Open Pass Issuance Station →
            </button>
          </div>
        )}
      </div>

      {/* Module Sub-tabs */}
      <div className="module-tabs">
        <button
          type="button"
          className={`tab-btn ${activeTab === 'request' ? 'active' : ''}`}
          onClick={() => handleTabChange('request')}
        >
          <span className="tab-num">A</span>
          <span className="tab-title">Request Tag Details</span>
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'blacklist' ? 'active' : ''}`}
          onClick={() => handleTabChange('blacklist')}
        >
          <span className="tab-num">B</span>
          <span className="tab-title">Blacklist Search History</span>
          <span className="tab-count">{MOCK_BLACKLIST_RECORDS.length}</span>
        </button>
      </div>

      {/* TAB 1: Request Tag Details */}
      {activeTab === 'request' && (
        <div className="tab-content">
          <div className="inquiry-card">
            <div className="card-top">
              <div>
                <h3>FASTag Inquiry &amp; Verification Terminal</h3>
                <p>Enter RFID Tag EPC Serial, Barcode, or Vehicle Registration Number</p>
              </div>
              <span className="sync-indicator">
                <span className="sync-dot online" /> Connected to NPCI NETC Switch
              </span>
            </div>

            <form onSubmit={handleSearchTag} className="inquiry-form">
              <div className="input-group">
                <div className="input-wrapper">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    type="text"
                    value={tagQuery}
                    onChange={(e) => setTagQuery(e.target.value)}
                    placeholder="e.g. 34161FA82032849 or MH 12 Q 9821"
                    className="query-input"
                  />
                  {tagQuery && (
                    <button type="button" className="clear-btn" onClick={() => setTagQuery('')}>✕</button>
                  )}
                </div>
                <button type="submit" className="query-btn" disabled={isSearching}>
                  {isSearching ? 'Querying NETC...' : 'Inspect Tag Details'}
                </button>
              </div>

              <div className="test-presets">
                <span>Quick Test Tags:</span>
                <button
                  type="button"
                  onClick={() => { setTagQuery('34161FA82032849'); setTimeout(handleSearchTag, 50); }}
                >
                  MH 12 Q 9821 (Active Private Car)
                </button>
                <button
                  type="button"
                  onClick={() => { setTagQuery('MH 02 CZ 4402'); setTimeout(handleSearchTag, 50); }}
                >
                  MH 02 CZ 4402 (Monthly Pass Holder)
                </button>
                <button
                  type="button"
                  onClick={() => { setTagQuery('MH 04 AZ 1024'); setTimeout(handleSearchTag, 50); }}
                >
                  MH 04 AZ 1024 (Blacklisted - Negative Balance)
                </button>
              </div>
            </form>

            {/* Results Display */}
            {queryResult && (
              <div className={`result-panel ${queryResult.status === 'BLACKLISTED' ? 'is-blocked' : 'is-active'}`}>
                <div className="result-header">
                  <div className="header-status">
                    <span className={`status-badge ${queryResult.status === 'BLACKLISTED' ? 'red' : 'green'}`}>
                      {queryResult.status === 'BLACKLISTED' ? '⚠ TAG BLACKLISTED / PROHIBITED' : '✓ TAG VERIFIED & AUTHORIZED'}
                    </span>
                    <span className="timestamp">Checked: {queryResult.npciSyncTime}</span>
                  </div>
                  <div className="actions">
                    <button type="button" className="action-link" onClick={() => window.print()}>
                      🖨️ Print Receipt
                    </button>
                    {userRole === 'Plaza POS' && (
                      <button
                        type="button"
                        className="btn-pass-action"
                        onClick={() => navigate('/pass-issuance?tab=issue')}
                      >
                        + Issue Pass for {queryResult.regNumber}
                      </button>
                    )}
                  </div>
                </div>

                <div className="result-grid">
                  <div className="grid-item">
                    <span className="label">FASTag Serial (EPC ID)</span>
                    <span className="value font-mono">{queryResult.tagId}</span>
                  </div>
                  <div className="grid-item">
                    <span className="label">TID Chip Serial Number</span>
                    <span className="value font-mono">{queryResult.tid}</span>
                  </div>
                  <div className="grid-item">
                    <span className="label">Vehicle Registration Number</span>
                    <span className="value font-bold">{queryResult.regNumber}</span>
                  </div>
                  <div className="grid-item">
                    <span className="label">Mapped Vehicle Class</span>
                    <span className="value">{queryResult.vehicleClass}</span>
                  </div>
                  <div className="grid-item">
                    <span className="label">Issuer Bank (NETC Acquirer)</span>
                    <span className="value">{queryResult.issuerBank}</span>
                  </div>
                  <div className="grid-item">
                    <span className="label">Customer Profile</span>
                    <span className="value">{queryResult.customerName} ({queryResult.mobile})</span>
                  </div>
                  <div className="grid-item">
                    <span className="label">Account Balance Status</span>
                    <span className={`value ${queryResult.balanceStatus.includes('Adequate') ? 'text-green' : 'text-red'}`}>
                      {queryResult.balanceStatus}
                    </span>
                  </div>
                  <div className="grid-item">
                    <span className="label">Blacklist / Exception Status</span>
                    <span className={`value ${queryResult.blacklistStatus.includes('CLEAR') ? 'text-green' : 'text-red'}`}>
                      {queryResult.blacklistStatus}
                    </span>
                  </div>
                  <div className="grid-item">
                    <span className="label">Exemption Category</span>
                    <span className="value">{queryResult.exemptionStatus}</span>
                  </div>
                  <div className="grid-item">
                    <span className="label">Reader Terminal Assigned</span>
                    <span className="value">{currentUser?.assignedPlaza || 'Airoli Bridge Lane 04'}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Blacklist Search History */}
      {activeTab === 'blacklist' && (
        <div className="tab-content">
          <div className="history-card">
            <div className="history-header">
              <div>
                <h3>NPCI FASTag Exception &amp; Blacklist History</h3>
                <p>Log of vehicles intercepted with low balance, stolen tag flags, or tampered credentials.</p>
              </div>
              <div className="history-filters">
                <input
                  type="text"
                  placeholder="Filter by Tag ID, VRN, or Plaza..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="filter-search-input"
                />
              </div>
            </div>

            <div className="filter-chips">
              <button
                type="button"
                className={`chip ${historyFilter === 'all' ? 'active' : ''}`}
                onClick={() => setHistoryFilter('all')}
              >
                All Exceptions ({MOCK_BLACKLIST_RECORDS.length})
              </button>
              <button
                type="button"
                className={`chip ${historyFilter === 'low' ? 'active' : ''}`}
                onClick={() => setHistoryFilter('low')}
              >
                Low Balance
              </button>
              <button
                type="button"
                className={`chip ${historyFilter === 'hot' ? 'active' : ''}`}
                onClick={() => setHistoryFilter('hot')}
              >
                Hotlisted / Stolen
              </button>
              <button
                type="button"
                className={`chip ${historyFilter === 'tamper' ? 'active' : ''}`}
                onClick={() => setHistoryFilter('tamper')}
              >
                Tampered / Class Mismatch
              </button>
            </div>

            <div className="table-responsive">
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Ref ID</th>
                    <th>Tag EPC ID</th>
                    <th>Vehicle Reg No</th>
                    <th>Class</th>
                    <th>Reason / Exception Code</th>
                    <th>Intercepted Plaza &amp; Lane</th>
                    <th>Sync Timestamp</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map((rec) => (
                    <tr key={rec.id}>
                      <td className="font-mono text-muted">{rec.id}</td>
                      <td className="font-mono font-bold">{rec.tagId}</td>
                      <td><strong>{rec.regNumber}</strong></td>
                      <td><span className="class-pill">{rec.vehicleClass}</span></td>
                      <td>
                        <span className={`reason-pill ${rec.badgeClass}`}>
                          Code {rec.reasonCode}: {rec.reason}
                        </span>
                      </td>
                      <td>{rec.plaza} · <span className="text-muted">{rec.lane}</span></td>
                      <td className="text-muted">{rec.syncTime}</td>
                      <td>
                        <button
                          type="button"
                          className="btn-reverify"
                          onClick={() => {
                            setTagQuery(rec.tagId);
                            handleTabChange('request');
                            setTimeout(handleSearchTag, 100);
                          }}
                        >
                          Re-verify
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredHistory.length === 0 && (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                        No exception records match your filter criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TagDetails;
