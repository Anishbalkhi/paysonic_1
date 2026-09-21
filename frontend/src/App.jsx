import React, { useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import Sidebar from './components/Sidebar/Sidebar';
import Topbar from './components/Topbar/Topbar';
import AppRoutes from './routes/AppRoutes';

export const App = () => {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  return (
    <BrowserRouter>
      <div className="app">
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
    </BrowserRouter>
  );
};

export default App;
