import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IS_DEV_MODE } from '../../services/config/env';
import { useAuth } from '../../context/AuthContext';
import './Topbar.scss';

export const Topbar = ({
  title = 'User management',
  crumb = 'Admin console / Access control',
  onToggleMobileNav = () => {},
}) => {
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();
  const [showMenu, setShowMenu] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const initials = currentUser?.avatar || currentUser?.name?.slice(0, 2).toUpperCase() || 'AD';

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          type="button"
          className="mobile-hamburger-btn"
          onClick={onToggleMobileNav}
          aria-label="Open navigation menu"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#344054" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <div className="topbar-crumb-block">
          <span className="crumb">{crumb}</span>
          <span className="crumb-title">{title}</span>
        </div>
      </div>

      <div className="topbar-right">
        <span
          className="clearance-pill role-indicator-badge"
          title={`Role Clearance: ${currentUser?.role || 'Admin'}`}
        >
          <span className="clearance-dot" />
          <span>{currentUser?.role || 'Admin'}</span>
        </span>

        <span
          className={`mode-badge ${IS_DEV_MODE ? 'mode-badge--dev' : 'mode-badge--prod'}`}
          title={`Current Mode: ${IS_DEV_MODE ? 'Development (Mock JSON Data)' : 'Production (Live API Calls)'}`}
        >
          <span className="mode-dot" />
          {IS_DEV_MODE ? 'DEV MODE' : 'PROD MODE'}
        </span>

        <div className="search-box">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#98A2B3" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input type="text" placeholder="Search anything" />
        </div>

        <button type="button" className="notification-btn" aria-label="Notifications">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#475467" strokeWidth="1.8">
            <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.7 21a2 2 0 0 1-3.4 0" />
          </svg>
          <span className="notif-badge" />
        </button>

        {/* User avatar + logout dropdown */}
        <div className="topbar-user" onClick={() => setShowMenu(v => !v)}>
          <div className="topbar-avatar">{initials}</div>
          {showMenu && (
            <div className="topbar-user-menu">
              <div className="tum-info">
                <span className="tum-name">{currentUser?.name || 'Admin'}</span>
                <span className="tum-role">{currentUser?.role || 'Super Admin'}</span>
              </div>
              <button className="tum-logout" onClick={handleLogout}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Topbar;
