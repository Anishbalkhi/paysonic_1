import React, { createContext, useContext, useState, useEffect } from 'react';

export const DEMO_USERS = {
  master_admin: {
    id: 'PSN0001',
    username: 'master.admin',
    name: 'Sanjay Kulkarni',
    email: 'sanjay.kulkarni@paysonic.com',
    role: 'Master Admin',
    userType: null,
    assignedPlaza: 'All plazas',
    plazas: ['All plazas'],
    avatar: 'SK',
    description: 'Full unrestricted governance across all modules, plazas & security controls',
  },
  admin: {
    id: 'PSN0002',
    username: 'admin.ops',
    name: 'Vikram Malhotra',
    email: 'vikram.malhotra@paysonic.com',
    role: 'Admin',
    userType: null,
    assignedPlaza: 'All plazas',
    plazas: ['All plazas'],
    avatar: 'VM',
    description: 'Central operations manager for disputes, reconciliations and traffic analytics',
  },
  bank: {
    id: 'PSN0003',
    username: 'bank.auditor',
    name: 'Anita Desai',
    email: 'anita.desai@hdfcbank.com',
    role: 'Bank',
    userType: null,
    assignedPlaza: 'Bank Level (HDFC Acquirer)',
    plazas: ['N/A'],
    avatar: 'AD',
    description: 'Financial auditor inspecting settlement cycles, bank transfers & chargeback reconciliations',
  },
  concessionaire: {
    id: 'PSN0004',
    username: 'lnt.highway',
    name: 'Arjun Patil',
    email: 'ops@lnttollways.com',
    role: 'Concessionaire',
    userType: 'Toll Plaza',
    assignedPlaza: 'Mumbai-Pune Corridor (3 Plazas)',
    plazas: ['Vashi Creek Bridge', 'Airoli Bridge', 'Khed Shivapur'],
    avatar: 'AP',
    description: 'Highway concessionaire monitoring traffic throughput and cluster revenues',
  },
  plaza_admin: {
    id: 'PSN0005',
    username: 'plaza.admin',
    name: 'Rahul Sharma',
    email: 'rahul.sharma@paysonic.com',
    role: 'Plaza Admin',
    userType: 'Toll Plaza',
    assignedPlaza: 'Vashi Creek Bridge (MH-01)',
    plazas: ['Vashi Creek Bridge'],
    avatar: 'RS',
    description: 'Plaza manager supervising local lane collections, local passes and lane staff',
  },
  plaza_pos: {
    id: 'PSN0006',
    username: 'lane.cashier',
    name: 'Priya Nair',
    email: 'priya.nair@paysonic.com',
    role: 'Plaza POS',
    userType: 'Toll Plaza',
    assignedPlaza: 'Airoli Bridge (Lane 04)',
    plazas: ['Airoli Bridge'],
    avatar: 'PN',
    description: 'Lane booth cashier issuing vehicle passes and verifying tag customer accounts',
  },
  tag_details: {
    id: 'PSN0007',
    username: 'tag.inspector',
    name: 'Rajesh Kumar',
    email: 'rajesh.kumar@paysonic.com',
    role: 'Request Tag Details',
    userType: 'Toll Plaza',
    assignedPlaza: 'Khed Shivapur (Lane 02)',
    plazas: ['Khed Shivapur'],
    avatar: 'RK',
    description: 'Read-only inquiry agent querying FASTag blacklist status and NPCI tag details',
  },
};

const STORAGE_KEY = 'paysonic_auth_session';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setCurrentUser(JSON.parse(saved));
      } else {
        setCurrentUser(null);
      }
    } catch (e) {
      console.error('Failed to load session:', e);
      setCurrentUser(null);
    } finally {
      setAuthChecked(true);
    }
  }, []);

  const login = (identifier, password) => {
    const trimmed = (identifier || '').trim().toLowerCase();
    if (!trimmed) {
      throw new Error('Please enter your email or username.');
    }
    if (!password || password.length < 4) {
      throw new Error('Please enter your password (minimum 4 characters).');
    }

    // Role alias lookup table for seamless testing & production use
    const ALIAS_MAP = {
      // Master Admin
      'master.admin': 'master_admin',
      'master@paysonic.com': 'master_admin',
      'master': 'master_admin',
      'sanjay.kulkarni@paysonic.com': 'master_admin',
      'sanjay': 'master_admin',
      'psn0001': 'master_admin',

      // Admin
      'admin.ops': 'admin',
      'admin@paysonic.com': 'admin',
      'admin': 'admin',
      'admin@tolloperator.com': 'admin',
      'ops@paysonic.com': 'admin',
      'vikram.malhotra@paysonic.com': 'admin',
      'vikram': 'admin',
      'psn0002': 'admin',

      // Bank
      'bank.auditor': 'bank',
      'bank@paysonic.com': 'bank',
      'bank@hdfcbank.com': 'bank',
      'bank': 'bank',
      'anita.desai@hdfcbank.com': 'bank',
      'anita': 'bank',
      'hdfc.recon': 'bank',
      'psn0003': 'bank',

      // Concessionaire
      'lnt.highway': 'concessionaire',
      'concessionaire@paysonic.com': 'concessionaire',
      'concessionaire': 'concessionaire',
      'ops@lnttollways.com': 'concessionaire',
      'arjun.patil@paysonic.com': 'concessionaire',
      'meera.joshi': 'concessionaire',
      'psn0004': 'concessionaire',

      // Plaza Admin
      'plaza.admin': 'plaza_admin',
      'plaza@paysonic.com': 'plaza_admin',
      'plaza': 'plaza_admin',
      'plazaadmin': 'plaza_admin',
      'rahul.sharma@paysonic.com': 'plaza_admin',
      'rahul.sharma': 'plaza_admin',
      'rahul': 'plaza_admin',
      'psn0005': 'plaza_admin',

      // Plaza POS / Cashier
      'lane.cashier': 'plaza_pos',
      'cashier@paysonic.com': 'plaza_pos',
      'pos@paysonic.com': 'plaza_pos',
      'cashier': 'plaza_pos',
      'pos': 'plaza_pos',
      'priya.nair@paysonic.com': 'plaza_pos',
      'priya': 'plaza_pos',
      'psn0006': 'plaza_pos',

      // Request Tag Details
      'tag.inspector': 'tag_details',
      'tag@paysonic.com': 'tag_details',
      'tag': 'tag_details',
      'tagdetails': 'tag_details',
      'rajesh.kumar@paysonic.com': 'tag_details',
      'rajesh': 'tag_details',
      'psn0007': 'tag_details',
    };

    let match = null;

    // 1. Direct alias match
    if (ALIAS_MAP[trimmed]) {
      match = DEMO_USERS[ALIAS_MAP[trimmed]];
    }

    // 2. Direct property match in DEMO_USERS
    if (!match) {
      match = Object.values(DEMO_USERS).find(
        (u) =>
          u.username.toLowerCase() === trimmed ||
          u.email.toLowerCase() === trimmed ||
          u.id.toLowerCase() === trimmed
      );
    }

    // 3. Keyword heuristic match (e.g. if someone enters any email containing 'bank', 'plaza', etc.)
    if (!match) {
      if (trimmed.includes('master')) match = DEMO_USERS.master_admin;
      else if (trimmed.includes('bank') || trimmed.includes('hdfc')) match = DEMO_USERS.bank;
      else if (trimmed.includes('concession') || trimmed.includes('highway') || trimmed.includes('lnt')) match = DEMO_USERS.concessionaire;
      else if (trimmed.includes('plaza') || trimmed.includes('supervisor')) match = DEMO_USERS.plaza_admin;
      else if (trimmed.includes('cashier') || trimmed.includes('pos') || trimmed.includes('lane')) match = DEMO_USERS.plaza_pos;
      else if (trimmed.includes('tag') || trimmed.includes('inspector')) match = DEMO_USERS.tag_details;
      else if (trimmed.includes('admin')) match = DEMO_USERS.admin;
    }

    // 4. If an email is provided but no direct match, generate a standard operator session
    if (!match) {
      if (trimmed.includes('@')) {
        // Create user session with standard Admin access
        const namePart = trimmed.split('@')[0].replace(/[._]/g, ' ');
        const capName = namePart.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || 'Operator';
        match = {
          id: 'PSN' + Math.floor(1000 + Math.random() * 9000),
          username: trimmed.split('@')[0],
          name: capName,
          email: trimmed,
          role: 'Admin',
          userType: null,
          assignedPlaza: 'All plazas',
          plazas: ['All plazas'],
          avatar: capName.slice(0, 2).toUpperCase(),
          description: 'Operations Specialist',
        };
      } else {
        throw new Error('Invalid credentials. You can test with admin@paysonic.com, bank@paysonic.com, or master@paysonic.com.');
      }
    }

    const sessionData = {
      ...match,
      loginTimestamp: new Date().toISOString(),
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionData));
    setCurrentUser(sessionData);
    return sessionData;
  };

  const quickLogin = (roleKey) => {
    const user = DEMO_USERS[roleKey];
    if (!user) throw new Error(`Unknown role ${roleKey}`);
    const sessionData = {
      ...user,
      loginTimestamp: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionData));
    setCurrentUser(sessionData);
    return sessionData;
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setCurrentUser(null);
  };

  // Helper to check if the current user has access to a specific role or permission
  const hasRole = (...roles) => {
    if (!currentUser) return false;
    if (currentUser.role === 'Master Admin') return true;
    return roles.includes(currentUser.role);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated: Boolean(currentUser),
        authChecked,
        login,
        quickLogin,
        logout,
        hasRole,
        demoUsers: DEMO_USERS,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
};

export default AuthContext;
