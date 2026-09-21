import React from 'react';
import { IS_DEV_MODE } from '../../services/config/env';
import './Topbar.scss';

export const Topbar = ({
  title = 'User management',
  crumb = 'Admin console / Access control',
  onToggleMobileNav = () => {},
}) => {
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
        <span className={`mode-badge ${IS_DEV_MODE ? 'mode-badge--dev' : 'mode-badge--prod'}`} title={`Current Mode: ${IS_DEV_MODE ? 'Development (Mock JSON Data)' : 'Production (Live API Calls)'}`}>
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
        </button>
      </div>
    </header>
  );
};

export default Topbar;
