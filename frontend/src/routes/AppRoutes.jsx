import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Home from '../pages/Home/Home';
import UserList from '../pages/UserList/UserList';
import ProductDetail from '../pages/ProductDetail/ProductDetail';
import UserActivity from '../pages/UserActivity/UserActivity';

export const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/users" element={<UserList />} />
      <Route path="/activity" element={<UserActivity />} />
      <Route path="/user-activity" element={<Navigate to="/activity" replace />} />
      <Route path="/products/:id" element={<ProductDetail />} />
      <Route path="/products" element={<Navigate to="/products/PROD-PAYSONIC-GATEWAY" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default AppRoutes;
