import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getRoleNavigation } from '../../config/roleMenus';
import OperationsModal from '../OperationsModal/OperationsModal';
import './Sidebar.scss';

export const Sidebar = ({
  isOpen = false,
  onClose = () => {},
  isCollapsed = false,
  onToggleCollapse = () => {},
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();
  const [activeOp, setActiveOp] = useState(null);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  // Initialize open menus with active section open
  const [openMenus, setOpenMenus] = useState(() => {
    const initial = { 'user_management': true, 'tag_details': true };
    return initial;
  });

  const toggleMenu = (menuId) => {
    setOpenMenus((prev) => ({
      ...prev,
      [menuId]: !prev[menuId],
    }));
  };

  const handleBurgerClick = () => {
    if (typeof window !== 'undefined' && window.innerWidth <= 860) {
      onClose();
    } else if (onToggleCollapse) {
      onToggleCollapse();
    }
  };

  const userRole = currentUser?.role || 'Admin';

  // Role Badge Display Configuration
  const ROLE_BADGE_CONFIG = {
    'Master Admin': { title: 'Master Admin Console', color: '#16a34a', bg: '#f0fdf4', border: '#dcfce7' },
    'Admin': { title: 'Operations Admin', color: '#2563eb', bg: '#eff6ff', border: '#dbeafe' },
    'Bank': { title: 'Bank Auditor · HDFC', color: '#0d9488', bg: '#f0fdfa', border: '#ccfbf1' },
    'Concessionaire': { title: 'Highway Concessionaire', color: '#d97706', bg: '#fffbeb', border: '#fef3c7' },
    'Plaza Admin': { title: 'Plaza Supervisor', color: '#0284c7', bg: '#f0f9ff', border: '#e0f2fe' },
    'Plaza POS': { title: 'Lane POS Cashier', color: '#ea580c', bg: '#fff7ed', border: '#ffedd5' },
    'Request Tag Details': { title: 'Tag Inquiry Agent', color: '#7c3aed', bg: '#faf5ff', border: '#f3e8ff' },
  };

  const badgeConfig = ROLE_BADGE_CONFIG[userRole] || {
    title: `${userRole} Console`,
    color: '#16a34a',
    bg: '#f0fdf4',
    border: '#dcfce7',
  };

  // Fetch sections strictly configured for the user's role
  const visibleSections = getRoleNavigation(userRole);

  return (
    <>
      {isOpen && (
        <div
          className="sidebar-backdrop"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside className={`sidebar ${isOpen ? 'sidebar--open' : ''} ${isCollapsed ? 'sidebar--collapsed collapsed' : ''}`}>
        <div className="brand">
          <div className="brand-inner">
            <div className="brand-mark brand-logo-icon">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M5 19 14 5l1.8 6.5L20 9" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="brand-text">
              <span className="brand-title">
                Pay<b>sonic</b>
              </span>
              <span className="brand-sub">TOLL OPS</span>
            </div>
          </div>
          <button
            type="button"
            className="sidebar-burger-btn"
            onClick={handleBurgerClick}
            aria-label="Toggle sidebar"
            title="Toggle sidebar"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2.2" strokeLinecap="round">
              <line x1="4" y1="6" x2="20" y2="6" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="18" x2="20" y2="18" />
            </svg>
          </button>
          <button
            type="button"
            className="sidebar-close-btn"
            onClick={onClose}
            aria-label="Close navigation"
          >
            ✕
          </button>
        </div>

        {/* Dynamic Role Context Pill */}
        <div
          className="sidebar-role-badge role-indicator-badge clearance-pill"
          title={currentUser?.description || ''}
        >
          <span className="role-dot clearance-dot" />
          <span>{badgeConfig.title}</span>
        </div>

        <nav className="nav">
          {visibleSections.map((item) => {
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
                              setActiveOp(subItem);
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
            <div className="avatar">{currentUser?.avatar || 'A'}</div>
            <div className="who">
              <span className="who-name">{currentUser?.name || 'Admin'}</span>
              <span className="who-role">{currentUser?.role || 'Operator'}</span>
              {currentUser?.assignedPlaza && (
                <span className="who-scope" style={{ fontSize: '10px', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={currentUser.assignedPlaza}>
                  {currentUser.assignedPlaza}
                </span>
              )}
            </div>
            <button
              type="button"
              className="logout-btn"
              onClick={handleLogout}
              title="Sign out"
              aria-label="Sign out"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </div>
      </aside>
      <OperationsModal operation={activeOp} onClose={() => setActiveOp(null)} />
    </>
  );
};

export default Sidebar;
