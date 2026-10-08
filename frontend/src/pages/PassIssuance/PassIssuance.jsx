import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { hasMenuAccess } from '../../config/roleMenus';
import useOnboardedPlazas from '../../hooks/useOnboardedPlazas';
import { filterRecordsByPlazaScope } from '../../utils/plazaScopeUtils';
import TablePagination from '../../components/common/TablePagination';
import { formatFetchTime } from '../../utils/dateUtils';
import './PassIssuance.scss';

export const PassIssuance = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentUser } = useAuth();
  const { plazas, isPlazaLocked, defaultPlazaId, assignedPlaza } = useOnboardedPlazas();
  const [fetchTime, setFetchTime] = useState(formatFetchTime(new Date()));

  const TABS = [
    { key: 'issue', num: 'A', title: 'Pass Issuance', perm: 'pass_issuance_pass_issuance' },
    { key: 'approval', num: 'B', title: 'Pass Issuance Approval', perm: 'pass_issuance_pass_issuance_approval', count: '2 Pending' },
    { key: 'view', num: 'C', title: 'Pass Issuance View', perm: 'pass_issuance_pass_issuance_view' },
    { key: 'customer', num: 'D', title: 'View Customer', perm: 'pass_issuance_view_customer' },
    { key: 'cust-approval', num: 'E', title: 'Customer Approval', perm: 'pass_issuance_customer_approval' },
  ];

  const allowedTabs = TABS.filter((t) => hasMenuAccess(currentUser, t.perm));
  const fallbackTab = allowedTabs[0]?.key || 'issue';
  const tabParam = searchParams.get('tab') || fallbackTab;
  const currentTabAllowed = allowedTabs.some((t) => t.key === tabParam);
  const activeTab = currentTabAllowed ? tabParam : fallbackTab;

  // Pagination State for pass lists
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    if (!currentTabAllowed && allowedTabs.length > 0) {
      setSearchParams({ tab: fallbackTab });
    }
  }, [currentTabAllowed, fallbackTab, allowedTabs.length, setSearchParams]);

  const activePlazaName = assignedPlaza?.name || currentUser?.assignedPlaza || 'Pune Bypass Plaza';

  const [passData, setPassData] = useState({
    vehicleNo: 'MH 02 CZ 4402',
    name: 'Ramesh Verma',
    mobile: '9820123456',
    passType: 'Monthly Local Resident',
    plaza: activePlazaName,
    amount: '₹330.00',
  });
  const [passIssued, setPassIssued] = useState(false);

  const ALL_PASSES = [
    { id: 'PSN-PASS-2026-001', vrn: 'MH 12 CZ 4402', name: 'Ramesh Verma', type: 'Monthly Local Resident', plaza: 'Pune Bypass Plaza', expires: '2026-10-22', status: 'Active' },
    { id: 'PSN-PASS-2026-002', vrn: 'MH 04 AZ 1024', name: 'Kunal Patil', type: 'Local Commercial', plaza: 'Airoli Bridge', expires: '2026-10-15', status: 'Active' },
    { id: 'PSN-PASS-2026-003', vrn: 'MH 14 CC 8412', name: 'Nilesh Shinde', type: 'Multiple Journey 50 Trips', plaza: 'Khed Shivapur', expires: '2026-11-01', status: 'Active' },
    { id: 'PSN-PASS-2026-004', vrn: 'MH 12 TR 9901', name: 'Sanjay Deshmukh', type: 'Monthly Local Resident', plaza: 'Pune Bypass Plaza', expires: '2026-11-15', status: 'Active' },
  ];

  const MOCK_ACTIVE_PASSES = useMemo(() => {
    return filterRecordsByPlazaScope(ALL_PASSES, plazas, currentUser, (r) => r.plaza);
  }, [plazas, currentUser]);

  const paginatedPasses = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return MOCK_ACTIVE_PASSES.slice(startIndex, startIndex + pageSize);
  }, [MOCK_ACTIVE_PASSES, currentPage, pageSize]);

  const handleIssueSubmit = (e) => {
    e.preventDefault();
    setPassIssued(true);
  };

  return (
    <div className="pass-issuance-page">
      <div className="page-header">
        <div className="header-info">
          <div className="badge-row" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <span className="role-clearance-badge">
              <span className="dot" />
              Lane Pass Clearance Terminal
            </span>
            {currentUser?.assignedPlaza && (
              <span className="plaza-badge">📍 {currentUser.assignedPlaza}</span>
            )}
            {fetchTime && (
              <span className="report-fetch-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.80rem', color: '#1e293b', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', padding: '4px 10px', borderRadius: '4px', fontWeight: 600 }}>
                🕒 Data Fetch Time: {fetchTime}
              </span>
            )}
          </div>
          <h2>Pass Issuance &amp; Approvals</h2>
          <p>
            Local resident concessions, monthly passes, fleet travel permits, and customer KYC verification.
          </p>
        </div>
      </div>

      {allowedTabs.length > 0 && (
        <div className="module-tabs">
          {allowedTabs.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`tab-btn ${activeTab === t.key ? 'active' : ''}`}
              onClick={() => { setSearchParams({ tab: t.key }); }}
            >
              <span className="tab-num">{t.num}</span>
              <span className="tab-title">{t.title}</span>
              {t.count && <span className="tab-count">{t.count}</span>}
            </button>
          ))}
        </div>
      )}

      <div className="tab-content">
        {activeTab === 'issue' && (
          <div className="pass-card">
            <h3>Issue New Vehicle Pass</h3>
            <p className="sub">Register local resident FASTag for discounted automated barrier opening.</p>

            {passIssued ? (
              <div className="issued-success-card">
                <span className="success-icon">✓</span>
                <h4>Vehicle Pass Activated Successfully!</h4>
                <p>Pass ID: <strong>PSN-PASS-2026-8812</strong> · Active immediately across all lanes.</p>
                <button type="button" className="btn-primary" onClick={() => setPassIssued(false)}>
                  Issue Another Pass
                </button>
              </div>
            ) : (
              <form onSubmit={handleIssueSubmit} className="pass-form">
                <div className="form-grid">
                  <div className="form-group">
                    <label>Vehicle Registration Number (VRN)</label>
                    <input
                      type="text"
                      value={passData.vehicleNo}
                      onChange={(e) => setPassData({ ...passData, vehicleNo: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Customer Full Name</label>
                    <input
                      type="text"
                      value={passData.name}
                      onChange={(e) => setPassData({ ...passData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Contact Mobile Number</label>
                    <input
                      type="text"
                      value={passData.mobile}
                      onChange={(e) => setPassData({ ...passData, mobile: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Pass Type &amp; Concession Rate</label>
                    <select
                      value={passData.passType}
                      onChange={(e) => setPassData({ ...passData, passType: e.target.value })}
                    >
                      <option>Monthly Local Resident (₹330 / month)</option>
                      <option>Monthly Commercial Vehicle (₹2,150 / month)</option>
                      <option>Multiple 50 Journey Pass (₹1,200)</option>
                      <option>Exempted Emergency / Gov Official (₹0)</option>
                    </select>
                  </div>
                </div>
                <button type="submit" className="btn-submit-pass">
                  Generate &amp; Activate Pass
                </button>
              </form>
            )}
          </div>
        )}

        {(activeTab === 'view' || activeTab === 'approval' || activeTab === 'customer' || activeTab === 'cust-approval') && (
          <div className="pass-card">
            <h3>Registered Active Passes</h3>
            <p className="sub">Live registry of all vehicle passes issued across {currentUser?.assignedPlaza || 'jurisdiction'}.</p>
            <table className="passes-table">
              <thead>
                <tr>
                  <th>Pass ID</th>
                  <th>Vehicle Reg</th>
                  <th>Customer Name</th>
                  <th>Pass Type</th>
                  <th>Assigned Plaza</th>
                  <th>Valid Until</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {paginatedPasses.map((p) => (
                  <tr key={p.id}>
                    <td className="font-mono font-bold">{p.id}</td>
                    <td><strong>{p.vrn}</strong></td>
                    <td>{p.name}</td>
                    <td>{p.type}</td>
                    <td>{p.plaza}</td>
                    <td>{p.expires}</td>
                    <td><span className="badge-active">Active</span></td>
                  </tr>
                ))}
              </tbody>
            </table>

            <TablePagination
              totalItems={MOCK_ACTIVE_PASSES.length}
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
        )}
      </div>
    </div>
  );
};

export default PassIssuance;
