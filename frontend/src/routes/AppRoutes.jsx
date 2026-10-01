import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from '../pages/Login/Login';
import Home from '../pages/Home/Home';
import UserList from '../pages/UserList/UserList';
import ProductDetail from '../pages/ProductDetail/ProductDetail';
import UserActivity from '../pages/UserActivity/UserActivity';
import TagDetails from '../pages/TagDetails/TagDetails';
import PassIssuance from '../pages/PassIssuance/PassIssuance';
import Onboarding from '../pages/Onboarding/Onboarding';
import TrsReport from '../pages/TrsReport/TrsReport';
import DateWiseRecon from '../pages/DateWiseRecon/DateWiseRecon';
import CycleWiseRecon from '../pages/CycleWiseRecon/CycleWiseRecon';
import DisputeDetailReport from '../pages/DisputeDetailReport/DisputeDetailReport';
import TollFareReport from '../pages/TollFareReport/TollFareReport';
import RejectedTransaction from '../pages/RejectedTransaction/RejectedTransaction';
import TransactionSearchDispute from '../pages/TransactionSearchDispute/TransactionSearchDispute';
import TransactionSearchNormal from '../pages/TransactionSearchNormal/TransactionSearchNormal';
import ViolationBulkAction from '../pages/ViolationBulkAction/ViolationBulkAction';
import ProtectedRoute from '../components/ProtectedRoute/ProtectedRoute';

export const AppRoutes = () => {
  return (
    <Routes>
      {/* Public route */}
      <Route path="/login" element={<Login />} />

      {/* Protected routes */}
      <Route path="/" element={<ProtectedRoute requiredMenu="dashboard"><Home /></ProtectedRoute>} />
      <Route
        path="/tag-details"
        element={
          <ProtectedRoute requiredMenu="tag_details">
            <TagDetails />
          </ProtectedRoute>
        }
      />
      <Route
        path="/pass-issuance"
        element={
          <ProtectedRoute
            allowedRoles={['Master Admin', 'Admin', 'Plaza Admin', 'Concessionaire', 'Plaza POS']}
            requiredMenu="pass_issuance"
          >
            <PassIssuance />
          </ProtectedRoute>
        }
      />
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute
            allowedRoles={['Master Admin', 'Admin', 'Concessionaire', 'Plaza Admin']}
            requiredMenu="on_boarding"
          >
            <Onboarding />
          </ProtectedRoute>
        }
      />
      <Route path="/on-boarding" element={<Navigate to="/onboarding" replace />} />
      <Route
        path="/users"
        element={
          <ProtectedRoute
            allowedRoles={['Master Admin', 'Admin', 'Concessionaire', 'Plaza Admin']}
            requiredMenu="user_management"
          >
            <UserList />
          </ProtectedRoute>
        }
      />
      <Route
        path="/activity"
        element={
          <ProtectedRoute
            allowedRoles={['Master Admin', 'Admin', 'Concessionaire', 'Bank', 'Plaza Admin']}
            requiredMenu="user_activity"
          >
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
      <Route
        path="/recon/trs-report"
        element={
          <ProtectedRoute
            allowedRoles={['Master Admin', 'Admin', 'Plaza Admin', 'Concessionaire', 'Bank']}
            requiredMenu="recon_management"
          >
            <TrsReport />
          </ProtectedRoute>
        }
      />
      <Route
        path="/transactional-reports/transaction-report"
        element={
          <ProtectedRoute
            allowedRoles={['Master Admin', 'Admin', 'Plaza Admin', 'Concessionaire', 'Bank', 'Manager', 'Auditor', 'Operator']}
            requiredMenu="transactional_report"
          >
            <TrsReport />
          </ProtectedRoute>
        }
      />
      <Route
        path="/transaction-report"
        element={<Navigate to="/transactional-reports/transaction-report" replace />}
      />
      <Route
        path="/transactional-reports/rejected-transaction"
        element={
          <ProtectedRoute
            allowedRoles={['Master Admin', 'Admin', 'Plaza Admin', 'Concessionaire', 'Bank', 'Manager', 'Auditor', 'Operator']}
            requiredMenu="transactional_report"
          >
            <RejectedTransaction />
          </ProtectedRoute>
        }
      />
      <Route
        path="/rejected-transaction"
        element={<Navigate to="/transactional-reports/rejected-transaction" replace />}
      />
      <Route
        path="/rejected-transactions"
        element={<Navigate to="/transactional-reports/rejected-transaction" replace />}
      />
      <Route
        path="/transactional-reports/toll-fare-report"
        element={
          <ProtectedRoute
            allowedRoles={['Master Admin', 'Admin', 'Plaza Admin', 'Concessionaire', 'Bank', 'Manager', 'Auditor', 'Operator']}
            requiredMenu="transactional_report"
          >
            <TollFareReport />
          </ProtectedRoute>
        }
      />
      <Route
        path="/toll-fare-report"
        element={<Navigate to="/transactional-reports/toll-fare-report" replace />}
      />
      <Route
        path="/transactional-reports/transaction-search-normal"
        element={
          <ProtectedRoute
            allowedRoles={['Master Admin', 'Admin', 'Plaza Admin', 'Concessionaire', 'Bank', 'Manager', 'Auditor', 'Operator']}
            requiredMenu="transactional_report"
          >
            <TransactionSearchNormal />
          </ProtectedRoute>
        }
      />
      <Route
        path="/transaction-search-normal"
        element={<Navigate to="/transactional-reports/transaction-search-normal" replace />}
      />
      <Route
        path="/transactional-reports/transaction-search-dispute"
        element={
          <ProtectedRoute
            allowedRoles={['Master Admin', 'Admin', 'Plaza Admin', 'Concessionaire', 'Bank', 'Manager', 'Auditor', 'Operator']}
            requiredMenu="transactional_report"
          >
            <TransactionSearchDispute />
          </ProtectedRoute>
        }
      />
      <Route
        path="/transaction-search-dispute"
        element={<Navigate to="/transactional-reports/transaction-search-dispute" replace />}
      />
      <Route
        path="/transactional-reports/transaction-search"
        element={<Navigate to="/transactional-reports/transaction-search-normal" replace />}
      />
      <Route
        path="/transaction-search"
        element={<Navigate to="/transactional-reports/transaction-search-normal" replace />}
      />
      <Route
        path="/reports/dynamicreport/8"
        element={
          <ProtectedRoute
            allowedRoles={['Master Admin', 'Admin', 'Plaza Admin', 'Concessionaire', 'Bank']}
            requiredMenu="recon_management"
          >
            <TrsReport />
          </ProtectedRoute>
        }
      />

      <Route
        path="/recon/date-wise-recon"
        element={
          <ProtectedRoute
            allowedRoles={['Master Admin', 'Admin', 'Plaza Admin', 'Concessionaire', 'Bank']}
            requiredMenu="recon_management"
          >
            <DateWiseRecon />
          </ProtectedRoute>
        }
      />

      <Route
        path="/recon/cycle-wise-report"
        element={
          <ProtectedRoute
            allowedRoles={['Master Admin', 'Admin', 'Plaza Admin', 'Concessionaire', 'Bank']}
            requiredMenu="recon_management"
          >
            <CycleWiseRecon />
          </ProtectedRoute>
        }
      />
      <Route
        path="/recon/cycle-wise-recon"
        element={<Navigate to="/recon/cycle-wise-report" replace />}
      />

      <Route
        path="/dispute-handling"
        element={
          <ProtectedRoute
            allowedRoles={['Master Admin', 'Admin', 'Plaza Admin', 'Concessionaire', 'Bank', 'Manager', 'Auditor', 'Operator']}
            requiredMenu="dispute_handling"
          >
            <DisputeDetailReport />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dispute-detail-report"
        element={<Navigate to="/dispute-handling" replace />}
      />
      <Route
        path="/violation-management/violation-bulk-action"
        element={
          <ProtectedRoute
            allowedRoles={['Master Admin', 'Admin', 'Plaza Admin', 'Concessionaire', 'Bank', 'Manager', 'Auditor', 'Operator']}
            requiredMenu="violation_management"
          >
            <ViolationBulkAction />
          </ProtectedRoute>
        }
      />
      <Route
        path="/violation-bulk-action"
        element={<Navigate to="/violation-management/violation-bulk-action" replace />}
      />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default AppRoutes;
