import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import './Sidebar.scss';

const NAVIGATION_SECTIONS = [
  {
    id: 'dashboard',
    label: '1. Dashboard',
    path: '/',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="3" width="7" height="9" rx="1.5" />
        <rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" />
        <rect x="3" y="16" width="7" height="5" rx="1.5" />
      </svg>
    ),
  },
  {
    id: 'user-management',
    label: '2. User Management',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    children: [
      { label: 'All Users Directory', path: '/users' },
      { label: 'A. Create User', path: '/users?action=create' },
      { label: 'B. Approve User', path: '/users?tab=pending' },
      { label: 'C. Assign User', path: '/users?action=assign' },
      { label: 'D. Unlock/ Lock User', path: '/users?tab=locked' },
      { label: 'E. User Activity', path: '/activity' },
    ],
  },
  {
    id: 'user-activity-audit',
    label: 'User Activity & Audit',
    path: '/activity',
    badge: 'Live',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    id: 'tag-details',
    label: '3. Tag Details',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
        <line x1="7" y1="7" x2="7.01" y2="7" />
      </svg>
    ),
    children: [
      { label: 'A. Request Tag Details', path: '#request-tag-details' },
      { label: 'B. Blacklist Search History', path: '#blacklist-history' },
    ],
  },
  {
    id: 'recon-management',
    label: '4. Recon Management',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <path d="M16 13H8" />
        <path d="M16 17H8" />
        <path d="M10 9H8" />
      </svg>
    ),
    children: [
      { label: 'A. Upload Recon File', path: '#upload-recon' },
      { label: 'B. Recon File Status', path: '#recon-status' },
      { label: 'C. TRS Report', path: '#trs-report' },
      { label: 'D. Cycle Wise Report', path: '#cycle-wise-report' },
      { label: 'E. Violation Settlement Report', path: '#recon-violation-settlement' },
    ],
  },
  {
    id: 'dispute-handling',
    label: '5. Dispute Handling',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    children: [
      { label: 'A. Dispute Dashboard', path: '#dispute-dashboard' },
      { label: 'B. Dispute File Upload', path: '#dispute-upload' },
      { label: 'C. Dispute File Status', path: '#dispute-file-status' },
      { label: 'D. Chargeback Assign', path: '#chargeback-assign' },
      { label: 'E. Dispute Detail Report', path: '#dispute-report' },
    ],
  },
  {
    id: 'violation-management',
    label: '6. Violation Management',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
    children: [
      { label: 'A. Violation Dashboard', path: '#violation-dashboard' },
      { label: 'B. Violation Validate', path: '#violation-validate' },
      { label: 'C. Violation Settlement Report', path: '#violation-settlement' },
      { label: 'D. Violation Raw File', path: '#violation-raw' },
      { label: 'E. Violation Bulk Action', path: '#violation-bulk' },
    ],
  },
  {
    id: 'transactional-report',
    label: '7. Transactional Report',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <line x1="2" y1="10" x2="22" y2="10" />
      </svg>
    ),
    children: [
      { label: 'A. Transaction Report', path: '#txn-report' },
      { label: 'B. Rejected Transaction', path: '#rejected-txn' },
      { label: 'C. Settled Transaction', path: '#settled-txn' },
      { label: 'D. Toll Fare Report', path: '#toll-fare-report' },
      { label: 'E. Transaction Search', path: '#txn-search' },
    ],
  },
  {
    id: 'pass-issuance',
    label: '8. Pass Issuance',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="4" width="18" height="16" rx="3" />
        <circle cx="9" cy="10" r="2" />
        <line x1="15" y1="8" x2="17" y2="8" />
        <line x1="15" y1="12" x2="17" y2="12" />
        <line x1="7" y1="16" x2="17" y2="16" />
      </svg>
    ),
    children: [
      { label: 'A. Pass Issuance', path: '#pass-issuance' },
      { label: 'B. Pass Issuance Approval', path: '#pass-approval' },
      { label: 'C. Pass Issuance View', path: '#pass-view' },
      { label: 'D. View Customer', path: '#view-customer' },
      { label: 'E. Customer Approval', path: '#customer-approval' },
    ],
  },
  {
    id: 'summary-report',
    label: '9. Summary Report',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
    children: [
      { label: 'A. Transaction Summary', path: '#summary-txn' },
      { label: 'B. Plaza Summary', path: '#summary-plaza' },
      { label: 'C. Acquirer Summary', path: '#summary-acquirer' },
      { label: 'D. Issuer Summary', path: '#summary-issuer' },
    ],
  },
  {
    id: 'exception-report',
    label: '10. Exception Report',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
    children: [
      { label: 'A. Exempted Vehicle Report', path: '#exempted-vehicles' },
      { label: 'B. Free Flow Report', path: '#free-flow' },
      { label: 'C. Low Balance Report', path: '#low-balance' },
      { label: 'D. Shift Variance Report', path: '#shift-variance' },
    ],
  },
  {
    id: 'on-boarding',
    label: '11. On Boarding',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3 21h18M5 21V9l7-5 7 5v12M9 21v-6h6v6" />
      </svg>
    ),
    children: [
      { label: 'A. Plaza Onboarding', path: '#plaza-onboarding' },
      { label: 'B. Acquirer Onboarding', path: '#acquirer-onboarding' },
      { label: 'C. Issuer Onboarding', path: '#issuer-onboarding' },
    ],
  },
  {
    id: 'system-configuration',
    label: '12. System Configuration',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 0 1-4 0v-.09A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l-.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 0 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 0 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06-.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.55 1H21a2 2 0 0 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1Z" />
      </svg>
    ),
    children: [
      { label: 'A. Configuration Parameter', path: '#config-parameters' },
      { label: 'B. User Role Mapping', path: '#role-mapping' },
      { label: 'C. Role Hierarchy', path: '#role-hierarchy' },
    ],
  },
];

export const Sidebar = ({ isOpen = false, onClose = () => {} }) => {
  const location = useLocation();

  // Initialize open menus with active section open
  const [openMenus, setOpenMenus] = useState(() => {
    const initial = { 'user-management': true };
    return initial;
  });

  const toggleMenu = (menuId) => {
    setOpenMenus((prev) => ({
      ...prev,
      [menuId]: !prev[menuId],
    }));
  };

  return (
    <>
      {isOpen && (
        <div
          className="sidebar-backdrop"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside className={`sidebar ${isOpen ? 'sidebar--open' : ''}`}>
        <div className="brand">
          <div className="brand-inner">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <path d="M2 2H12V9H8V22H2V2Z" fill="#17A34A" />
              <path d="M22 2L8 22H2L16 2H22Z" fill="#3762F2" />
            </svg>
            <span>
              Pay<b>sonic</b>
            </span>
          </div>
          <button
            type="button"
            className="sidebar-close-btn"
            onClick={onClose}
            aria-label="Close navigation"
          >
            ✕
          </button>
        </div>

        {/* Master Admin Context Pill */}
        <div className="sidebar-role-badge">
          <span className="role-dot" />
          <span>Master Admin Console</span>
        </div>

        <nav className="nav">
          {NAVIGATION_SECTIONS.map((item) => {
            const hasChildren = item.children && item.children.length > 0;
            const isMenuOpen = Boolean(openMenus[item.id]);

            if (!hasChildren) {
              return (
                <NavLink
                  key={item.id}
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  onClick={onClose}
                >
                  {item.icon}
                  <span className="nav-label">{item.label}</span>
                  {item.badge && <span className="nav-pill-badge">{item.badge}</span>}
                </NavLink>
              );
            }

            // Group with accordion children
            const isParentActive = item.children.some((child) =>
              location.pathname === child.path.split('?')[0]
            );

            return (
              <div key={item.id} className={`nav-group ${isParentActive ? 'parent-active' : ''}`}>
                <button
                  type="button"
                  className={`nav-item nav-item--toggle ${isParentActive ? 'active' : ''}`}
                  onClick={() => toggleMenu(item.id)}
                  aria-expanded={isMenuOpen}
                >
                  {item.icon}
                  <span className="nav-label">{item.label}</span>
                  <svg
                    className={`chevron-icon ${isMenuOpen ? 'open' : ''}`}
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {isMenuOpen && (
                  <div className="nav-sub-list">
                    {item.children.map((subItem, idx) => {
                      const isSubActive =
                        location.pathname === subItem.path.split('?')[0] &&
                        (!subItem.path.includes('?') || location.search === subItem.path.slice(subItem.path.indexOf('?')));

                      if (subItem.path.startsWith('#')) {
                        return (
                          <a
                            key={idx}
                            href={subItem.path}
                            className="nav-sub-item"
                            onClick={(e) => {
                              e.preventDefault();
                              onClose();
                            }}
                          >
                            {subItem.label}
                          </a>
                        );
                      }

                      return (
                        <NavLink
                          key={idx}
                          to={subItem.path}
                          className={`nav-sub-item ${isSubActive ? 'active' : ''}`}
                          onClick={onClose}
                        >
                          {subItem.label}
                        </NavLink>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-foot">
          <div className="avatar-row">
            <div className="avatar">SK</div>
            <div>
              <span className="who-name">S. Kulkarni</span>
              <span className="who-role">Master Admin</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
