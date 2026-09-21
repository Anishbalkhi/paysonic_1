import React from 'react';
import { formatCurrency, getStatusBadgeClass } from '../../../utils/formatters';

export const UserTable = ({ users = [], onToggleStatus }) => {
  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>User / Merchant</th>
            <th>Role</th>
            <th>Company</th>
            <th>KYC Status</th>
            <th>Volume Processed</th>
            <th>Account Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td>
                <div className="flex items-center gap-3">
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="user-avatar"
                  />
                  <div className="flex-col">
                    <span className="font-semibold text-primary">{user.name}</span>
                    <span className="text-muted text-xs">{user.email}</span>
                  </div>
                </div>
              </td>
              <td>
                <span className="font-medium text-sm">{user.role}</span>
              </td>
              <td>
                <span className="text-sm">{user.company}</span>
              </td>
              <td>
                <span className={`badge ${getStatusBadgeClass(user.kycStatus)}`}>
                  {user.kycStatus}
                </span>
              </td>
              <td>
                <span className="font-semibold">
                  {formatCurrency(user.volumeProcessed)}
                </span>
              </td>
              <td>
                <span className={`badge ${getStatusBadgeClass(user.status)}`}>
                  {user.status}
                </span>
              </td>
              <td>
                <button
                  type="button"
                  className={`btn btn--sm ${
                    user.status === 'active' ? 'btn--secondary' : 'btn--outline'
                  }`}
                  onClick={() => onToggleStatus(user)}
                >
                  {user.status === 'active' ? 'Suspend' : 'Activate'}
                </button>
              </td>
            </tr>
          ))}
          {users.length === 0 && (
            <tr>
              <td colSpan="7" className="text-center py-8 text-muted">
                No users found matching your criteria.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default UserTable;
