import React from 'react';
import { NavLink } from 'react-router-dom';
import { IS_DEV_MODE } from '../../services/config/env';
import './Navbar.scss';

export const Navbar = () => {
  return (
    <header className="c-navbar">
      <div className="c-navbar__inner">
        <NavLink to="/" className="c-navbar__brand">
          <div className="brand-logo">P</div>
          <div className="brand-title">
            Paysonic <span>Fintech</span>
          </div>
        </NavLink>

        <nav className="c-navbar__nav">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `nav-item ${isActive ? 'active' : ''}`
            }
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/users"
            className={({ isActive }) =>
              `nav-item ${isActive ? 'active' : ''}`
            }
          >
            Merchants & Users
          </NavLink>
          <NavLink
            to="/products/PROD-PAYSONIC-GATEWAY"
            className={({ isActive }) =>
              `nav-item ${isActive ? 'active' : ''}`
            }
          >
            Product Engine
          </NavLink>
        </nav>

        <div className="c-navbar__actions">
          <span className={`env-badge ${IS_DEV_MODE ? 'dev' : 'prod'}`}>
            {IS_DEV_MODE ? 'dev mode' : 'prod mode'}
          </span>

          <div className="user-profile">
            <img
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"
              alt="Elena Rostova"
            />
            <div className="user-info">
              <span className="user-name">Elena Rostova</span>
              <span className="user-role">Finance Lead</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
