import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { hasDashboardAccess, getDefaultRouteForUser } from '../../config/roleMenus';
import Dashboard from '../../components/Dashboard';

export const Home = () => {
  const { currentUser } = useAuth();

  // Show the dashboard only if permitted for this specific user;
  // otherwise open their first accessible menu item
  if (!hasDashboardAccess(currentUser)) {
    const defaultRoute = getDefaultRouteForUser(currentUser);
    return <Navigate to={defaultRoute} replace />;
  }

  return <Dashboard />;
};

export default Home;
