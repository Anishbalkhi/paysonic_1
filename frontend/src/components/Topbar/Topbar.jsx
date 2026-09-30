import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import './Topbar.scss';

export const Topbar = ({
  title = '',
  crumb = '',
  onToggleMobileNav = () => {},
}) => {
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();
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
        {(title || crumb) && (
          <div className="topbar-crumb-block">
            {crumb && <span className="crumb">{crumb}</span>}
            {title && <span className="crumb-title">{title}</span>}
          </div>
        )}
      </div>

      <div className="topbar-right">
        <span
          className="clearance-pill role-indicator-badge"
          title={`Role Clearance: ${currentUser?.role || 'Admin'}`}
        >
          <span className="clearance-dot" />
          <span>{currentUser?.role || 'Admin'}</span>
        </span>

        <div className="search-box">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#98A2B3" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input type="text" placeholder="Search anything" />
        </div>

        {/* Dark / Light Mode Toggle */}
        <button
          type="button"
          className="theme-toggle-btn"
          onClick={toggleTheme}
          title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
          aria-label="Toggle theme mode"
        >
          {isDark ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#475467" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>

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
