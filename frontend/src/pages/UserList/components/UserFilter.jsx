import React from 'react';

export const UserFilter = ({ search, onSearchChange, activeStatus, onStatusChange }) => {
  const statuses = [
    { label: 'All Users', value: 'all' },
    { label: 'Active', value: 'active' },
    { label: 'Pending Review', value: 'pending' },
    { label: 'Suspended', value: 'suspended' },
  ];

  return (
    <div className="user-filter">
      <div className="search-input-wrapper">
        <input
          type="text"
          placeholder="Search by name, email, or company..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="search-input"
        />
      </div>

      <div className="status-tabs">
        {statuses.map((tab) => (
          <button
            key={tab.value}
            type="button"
            className={`status-tab ${activeStatus === tab.value ? 'active' : ''}`}
            onClick={() => onStatusChange(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default UserFilter;
