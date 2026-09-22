import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { hasDashboardAccess } from '../../config/roleMenus';
import Dashboard from '../../components/Dashboard';

export const Home = () => {
  const { currentUser } = useAuth();
  const userRole = currentUser?.role || 'Admin';

  // Show the dashboard in UI only for roles that have permission;
  // otherwise open the just next page to dashboard (/tag-details)
  if (!hasDashboardAccess(userRole)) {
    return <Navigate to="/tag-details" replace />;
  }

  return <Dashboard />;
};

export default Home;
