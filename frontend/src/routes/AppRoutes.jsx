import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from '../pages/Login/Login';
import Home from '../pages/Home/Home';
import UserList from '../pages/UserList/UserList';
import ProductDetail from '../pages/ProductDetail/ProductDetail';
import UserActivity from '../pages/UserActivity/UserActivity';
import TagDetails from '../pages/TagDetails/TagDetails';
import PassIssuance from '../pages/PassIssuance/PassIssuance';
import ProtectedRoute from '../components/ProtectedRoute/ProtectedRoute';

export const AppRoutes = () => {
  return (
    <Routes>
      {/* Public route */}
      <Route path="/login" element={<Login />} />

      {/* Protected routes */}
      <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
      <Route
        path="/tag-details"
        element={
          <ProtectedRoute>
            <TagDetails />
          </ProtectedRoute>
        }
      />
      <Route
        path="/pass-issuance"
        element={
          <ProtectedRoute allowedRoles={['Master Admin', 'Admin', 'Plaza Admin', 'Concessionaire', 'Plaza POS']}>
            <PassIssuance />
          </ProtectedRoute>
        }
      />
      <Route
        path="/users"
        element={
          <ProtectedRoute allowedRoles={['Master Admin']}>
            <UserList />
          </ProtectedRoute>
        }
      />
      <Route
        path="/activity"
        element={
          <ProtectedRoute allowedRoles={['Master Admin', 'Admin', 'Bank']}>
            <UserActivity />
          </ProtectedRoute>
        }
      />
      <Route path="/user-activity" element={<Navigate to="/activity" replace />} />
      <Route
        path="/products/:id"
        element={
          <ProtectedRoute allowedRoles={['Master Admin', 'Admin', 'Concessionaire']}>
            <ProductDetail />
          </ProtectedRoute>
        }
      />
      <Route path="/products" element={<Navigate to="/products/PROD-PAYSONIC-GATEWAY" replace />} />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default AppRoutes;
