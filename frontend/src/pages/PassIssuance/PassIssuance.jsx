import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './PassIssuance.scss';

export const PassIssuance = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentUser } = useAuth();
  const tabParam = searchParams.get('tab') || 'issue';
  const [activeTab, setActiveTab] = useState(tabParam);

  const [passData, setPassData] = useState({
    vehicleNo: 'MH 02 CZ 4402',
    name: 'Ramesh Verma',
    mobile: '9820123456',
    passType: 'Monthly Local Resident',
    plaza: currentUser?.assignedPlaza || 'Vashi Creek Bridge',
    amount: '₹330.00',
  });
  const [passIssued, setPassIssued] = useState(false);

  const MOCK_ACTIVE_PASSES = [
    { id: 'PSN-PASS-2026-001', vrn: 'MH 02 CZ 4402', name: 'Ramesh Verma', type: 'Monthly Local Resident', plaza: 'Vashi Creek Bridge', expires: '2026-10-22', status: 'Active' },
    { id: 'PSN-PASS-2026-002', vrn: 'MH 04 AZ 1024', name: 'Kunal Patil', type: 'Local Commercial', plaza: 'Airoli Bridge', expires: '2026-10-15', status: 'Active' },
    { id: 'PSN-PASS-2026-003', vrn: 'MH 14 CC 8412', name: 'Nilesh Shinde', type: 'Multiple Journey 50 Trips', plaza: 'Khed Shivapur', expires: '2026-11-01', status: 'Active' },
  ];

  const handleIssueSubmit = (e) => {
    e.preventDefault();
    setPassIssued(true);
  };

  return (
    <div className="pass-issuance-page">
      <div className="page-header">
        <div className="header-info">
          <div className="badge-row">
            <span className="role-clearance-badge">
              <span className="dot" />
              Lane Pass Clearance Terminal
            </span>
            {currentUser?.assignedPlaza && (
              <span className="plaza-badge">📍 {currentUser.assignedPlaza}</span>
            )}
          </div>
          <h2>Pass Issuance &amp; Approvals</h2>
          <p>
            Local resident concessions, monthly passes, fleet travel permits, and customer KYC verification.
          </p>
        </div>
      </div>

      <div className="module-tabs">
        <button
          type="button"
          className={`tab-btn ${activeTab === 'issue' ? 'active' : ''}`}
          onClick={() => { setActiveTab('issue'); setSearchParams({ tab: 'issue' }); }}
        >
          <span className="tab-num">A</span>
          <span className="tab-title">Pass Issuance</span>
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'approval' ? 'active' : ''}`}
          onClick={() => { setActiveTab('approval'); setSearchParams({ tab: 'approval' }); }}
        >
          <span className="tab-num">B</span>
          <span className="tab-title">Pass Issuance Approval</span>
          <span className="tab-count">2 Pending</span>
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'view' ? 'active' : ''}`}
          onClick={() => { setActiveTab('view'); setSearchParams({ tab: 'view' }); }}
        >
          <span className="tab-num">C</span>
          <span className="tab-title">Pass Issuance View</span>
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'customer' ? 'active' : ''}`}
          onClick={() => { setActiveTab('customer'); setSearchParams({ tab: 'customer' }); }}
        >
          <span className="tab-num">D</span>
          <span className="tab-title">View Customer</span>
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'cust-approval' ? 'active' : ''}`}
          onClick={() => { setActiveTab('cust-approval'); setSearchParams({ tab: 'cust-approval' }); }}
        >
          <span className="tab-num">E</span>
          <span className="tab-title">Customer Approval</span>
        </button>
      </div>

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
                {MOCK_ACTIVE_PASSES.map((p) => (
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
          </div>
        )}
      </div>
    </div>
  );
};

export default PassIssuance;
