import React, { useState, useEffect } from 'react';
import { BrowserRouter, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar/Sidebar';
import Topbar from './components/Topbar/Topbar';
import AppRoutes from './routes/AppRoutes';
import { AuthProvider, useAuth } from './context/AuthContext';
import { getRoleSlug } from './config/roleMenus';

const AppLayout = () => {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const location = useLocation();
  const { currentUser } = useAuth();
  const isDashboard = location.pathname === '/';
  const isLoginPage = location.pathname === '/login';

  const roleSlug = getRoleSlug(currentUser?.role || 'Master Admin');

  useEffect(() => {
    document.documentElement.setAttribute('data-role', roleSlug);
  }, [roleSlug]);

  // Login page renders without sidebar/topbar
  if (isLoginPage) {
    return <AppRoutes />;
  }

  if (isDashboard) {
    return <AppRoutes />;
  }

  return (
    <div className="app paysonic-app" data-role={roleSlug}>
      <Sidebar
        isOpen={isMobileNavOpen}
        onClose={() => setIsMobileNavOpen(false)}
      />
      <div className="main">
        <Topbar
          onToggleMobileNav={() => setIsMobileNavOpen((prev) => !prev)}
        />
        <main className="content-container">
          <AppRoutes />
        </main>
      </div>
    </div>
  );
};

export const App = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppLayout />
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
