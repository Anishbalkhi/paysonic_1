import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Loader from '../Loader/Loader';

import { hasMenuAccess, getDefaultRouteForUser } from '../../config/roleMenus';

export const ProtectedRoute = ({ children, allowedRoles = [], requiredMenu = null }) => {
  const { currentUser, isAuthenticated, authChecked } = useAuth();
  const location = useLocation();

  if (!authChecked) {
    return <Loader message="Verifying session security clearance..." />;
  }

  if (!isAuthenticated || !currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Real-time security revocation: if user was deactivated, locked, or unapproved
  if (currentUser.status === 'Inactive' || currentUser.locked || (currentUser.approval && currentUser.approval !== 'Approved')) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const isMasterAdmin = currentUser?.role === 'Master Admin';

  // Check role-level permission
  const isRoleAllowed =
    allowedRoles.length === 0 || isMasterAdmin || allowedRoles.includes(currentUser.role);

  // If a specific menu is required: user must have explicit menu access permission!
  // If user was granted explicit menu access by an administrator, grant access!
  const isAllowed = requiredMenu
    ? hasMenuAccess(currentUser, requiredMenu)
    : isRoleAllowed;

  if (!isAllowed) {
    const fallbackRoute = getDefaultRouteForUser(currentUser);

    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        padding: '24px',
      }}>
        <div style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.06), 0 8px 10px -6px rgba(0,0,0,0.04)',
          maxWidth: '460px',
          width: '100%',
          padding: '36px 28px',
          textAlign: 'center',
        }}>
          <div style={{
            width: '52px',
            height: '52px',
            borderRadius: '14px',
            background: '#fee2e2',
            color: '#ef4444',
            display: 'grid',
            placeItems: 'center',
            margin: '0 auto 16px auto',
          }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>
            Access Restricted
          </h2>
          <p style={{ fontSize: '13px', color: '#64748b', lineHeight: '1.5', marginBottom: '20px' }}>
            Your account <strong style={{ color: '#0f172a' }}>{currentUser.name}</strong> ({currentUser.role}) does not have permission to access this module.
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button
              type="button"
              style={{
                padding: '9px 18px',
                background: '#0f172a',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '13px',
              }}
              onClick={() => {
                window.location.href = fallbackRoute;
              }}
            >
              Continue to Authorized Section
            </button>
          </div>
        </div>
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;
