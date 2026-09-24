import React from 'react';

// Icons for each module
export const ICONS = {
  dashboard: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  ),
  users: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  tag: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  ),
  recon: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
      <path d="M10 9H8" />
    </svg>
  ),
  dispute: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  violation: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
  report: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
    </svg>
  ),
  pass: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <circle cx="9" cy="10" r="2" />
      <line x1="15" y1="8" x2="17" y2="8" />
      <line x1="15" y1="12" x2="17" y2="12" />
      <line x1="7" y1="16" x2="17" y2="16" />
    </svg>
  ),
  summary: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  onboarding: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 21h18M5 21V9l7-5 7 5v12M9 21v-6h6v6" />
    </svg>
  ),
};

export const ROLE_NAVIGATION_MAP = {
  'Master Admin': [
    {
      id: 'dashboard',
      label: 'Dashboard',
      path: '/',
      icon: ICONS.dashboard,
    },
    {
      id: 'user_management',
      label: 'User Management',
      icon: ICONS.users,
      children: [
        { label: 'A. Create User', path: '/users?action=create' },
        { label: 'B. Approve User', path: '/users?tab=pending' },
        { label: 'C. Assign User', path: '/users?action=assign' },
        { label: 'D. Unlock/Lock User', path: '/users?tab=locked' },
        { label: 'E. User Activity & Audit', path: '/activity' },
      ],
    },
    {
      id: 'user_activity',
      label: 'User Activity & Audit',
      path: '/activity',
      icon: ICONS.users,
    },
    {
      id: 'tag_details',
      label: 'Tag Details',
      icon: ICONS.tag,
      children: [
        { label: 'A. Request Tag Details', path: '/tag-details?tab=request' },
        { label: 'B. Blacklist Search History', path: '/tag-details?tab=blacklist' },
      ],
    },
    {
      id: 'recon_management',
      label: 'Recon Management',
      icon: ICONS.recon,
      children: [
        { label: 'A. Upload Recon File', path: '#upload-recon' },
        { label: 'B. Recon File Status', path: '#recon-status' },
        { label: 'C. TRS Report', path: '#trs-report' },
        { label: 'D. Cycle Wise Report', path: '#cycle-wise-report' },
        { label: 'E. Violation Settlement Report', path: '#violation-settlement-recon' },
      ],
    },
    {
      id: 'dispute_handling',
      label: 'Dispute Handling',
      icon: ICONS.dispute,
      children: [
        { label: 'A. Dispute Dashboard', path: '#dispute-dashboard' },
        { label: 'B. Dispute File Upload', path: '#dispute-file-upload' },
        { label: 'C. Dispute File Status', path: '#dispute-file-status' },
        { label: 'D. Chargeback Assign', path: '#chargeback-assign' },
        { label: 'E. Dispute Detail Report', path: '#dispute-detail-report' },
      ],
    },
    {
      id: 'violation_management',
      label: 'Violation Management',
      icon: ICONS.violation,
      children: [
        { label: 'A. Violation Dashboard', path: '#violation-dashboard' },
        { label: 'B. Violation Validate', path: '#violation-validate' },
        { label: 'C. Violation Settlement Report', path: '#violation-settlement-report' },
        { label: 'D. Violation Raw File', path: '#violation-raw-file' },
        { label: 'E. Violation Bulk Action', path: '#violation-bulk-action' },
      ],
    },
    {
      id: 'transactional_report',
      label: 'Transactional Report',
      icon: ICONS.report,
      children: [
        { label: 'A. Transaction Report', path: '#transaction-report' },
        { label: 'B. Rejected Transaction', path: '#rejected-transaction' },
        { label: 'C. Settled Transaction', path: '#settled-transaction' },
        { label: 'D. Toll Fare Report', path: '#toll-fare-report' },
        { label: 'E. Transaction Search', path: '#transaction-search' },
      ],
    },
    {
      id: 'pass_issuance',
      label: 'Pass Issuance',
      icon: ICONS.pass,
      children: [
        { label: 'A. Pass Issuance', path: '/pass-issuance?tab=issue' },
        { label: 'B. Pass Issuance Approval', path: '/pass-issuance?tab=approval' },
        { label: 'C. Pass Issuance View', path: '/pass-issuance?tab=view' },
        { label: 'D. View Customer', path: '/pass-issuance?tab=customer' },
        { label: 'E. Customer Approval', path: '/pass-issuance?tab=cust-approval' },
      ],
    },
    {
      id: 'summary_report',
      label: 'Summary Report',
      icon: ICONS.summary,
      children: [
        { label: 'A. Transaction Summary', path: '#transaction-summary' },
        { label: 'B. NHAI Traffic Report', path: '#nhai-traffic-report' },
        { label: 'C. Settlement Summary', path: '#settlement-summary' },
        { label: 'D. Pass Summary', path: '#pass-summary' },
      ],
    },
    {
      id: 'on_boarding',
      label: 'On Boarding',
      icon: ICONS.onboarding,
      children: [
        { label: 'A. On Boarding Approver', path: '#on-boarding-approver' },
        { label: 'B. View Group', path: '#view-group' },
        { label: 'C. View Company', path: '#view-company' },
        { label: 'D. View Division', path: '#view-division' },
        { label: 'E. ViewProject', path: '#view-project' },
        { label: 'F. View Plaza', path: '#view-plaza' },
        { label: 'G. Plaza Doc Upload File', path: '#plaza-doc-upload-file' },
        { label: 'H. Approve Plaza Upload', path: '#approve-plaza-upload' },
      ],
    },
  ],

  'Admin': [
    {
      id: 'dashboard',
      label: 'Dashboard',
      path: '/',
      icon: ICONS.dashboard,
    },
    {
      id: 'user_management',
      label: 'User Management',
      icon: ICONS.users,
      children: [
        { label: 'A. Create User', path: '/users?action=create' },
        { label: 'B. Approve User', path: '/users?tab=pending' },
        { label: 'C. Assign User', path: '/users?action=assign' },
        { label: 'D. Unlock/Lock User', path: '/users?tab=locked' },
        { label: 'E. User Activity & Audit', path: '/activity' },
      ],
    },
    {
      id: 'user_activity',
      label: 'User Activity & Audit',
      path: '/activity',
      icon: ICONS.users,
    },
    {
      id: 'tag_details',
      label: 'Tag Details',
      icon: ICONS.tag,
      children: [
        { label: 'A. Request Tag Details', path: '/tag-details?tab=request' },
        { label: 'B. Blacklist Search History', path: '/tag-details?tab=blacklist' },
      ],
    },
    {
      id: 'recon_management',
      label: 'Recon Management',
      icon: ICONS.recon,
      children: [
        { label: 'A. TRS Report', path: '#trs-report' },
        { label: 'B. Cycle Wise Report', path: '#cycle-wise-report' },
        { label: 'C. Violation Settlement Report', path: '#violation-settlement-recon' },
      ],
    },
    {
      id: 'dispute_handling',
      label: 'Dispute Handling',
      icon: ICONS.dispute,
      children: [
        { label: 'A. Dispute Dashboard', path: '#dispute-dashboard' },
        { label: 'B. Validate Dispute', path: '#validate-dispute' },
        { label: 'C. Approve Dispute', path: '#approve-dispute' },
        { label: 'D. Dispute Detail Report', path: '#dispute-detail-report' },
      ],
    },
    {
      id: 'violation_management',
      label: 'Violation Management',
      icon: ICONS.violation,
      children: [
        { label: 'A. Violation Dashboard', path: '#violation-dashboard' },
        { label: 'B. Violation Validate', path: '#violation-validate' },
        { label: 'C. Violation Settlement Report', path: '#violation-settlement-report' },
        { label: 'D. Violation Raw File', path: '#violation-raw-file' },
        { label: 'E. Violation Bulk Action', path: '#violation-bulk-action' },
      ],
    },
    {
      id: 'transactional_report',
      label: 'Transactional Report',
      icon: ICONS.report,
      children: [
        { label: 'A. Transaction Report', path: '#transaction-report' },
        { label: 'B. Rejected Transaction', path: '#rejected-transaction' },
        { label: 'C. Settled Transaction', path: '#settled-transaction' },
        { label: 'D. Toll Fare Report', path: '#toll-fare-report' },
        { label: 'E. Transaction Search', path: '#transaction-search' },
      ],
    },
    {
      id: 'pass_issuance',
      label: 'Pass Issuance',
      icon: ICONS.pass,
      children: [
        { label: 'A. Pass Issuance', path: '/pass-issuance?tab=issue' },
        { label: 'B. Pass Issuance Approval', path: '/pass-issuance?tab=approval' },
        { label: 'C. Pass Issuance View', path: '/pass-issuance?tab=view' },
        { label: 'D. View Customer', path: '/pass-issuance?tab=customer' },
        { label: 'E. Customer Approval', path: '/pass-issuance?tab=cust-approval' },
      ],
    },
    {
      id: 'summary_report',
      label: 'Summary Report',
      icon: ICONS.summary,
      children: [
        { label: 'A. Transaction Summary', path: '#transaction-summary' },
        { label: 'B. NHAI Traffic Report', path: '#nhai-traffic-report' },
        { label: 'C. Settlement Summary', path: '#settlement-summary' },
        { label: 'D. Pass Summary', path: '#pass-summary' },
      ],
    },
  ],

  'Plaza Admin': [
    {
      id: 'dashboard',
      label: 'Dashboard',
      path: '/',
      icon: ICONS.dashboard,
    },
    {
      id: 'user_management',
      label: 'User Management',
      icon: ICONS.users,
      children: [
        { label: 'A. Create User', path: '/users?action=create' },
        { label: 'B. Unlock/Lock User', path: '/users?tab=locked' },
        { label: 'C. User Activity & Audit', path: '/activity' },
      ],
    },
    {
      id: 'tag_details',
      label: 'Tag Details',
      icon: ICONS.tag,
      children: [
        { label: 'A. Request Tag Details', path: '/tag-details?tab=request' },
        { label: 'B. Blacklist Search History', path: '/tag-details?tab=blacklist' },
      ],
    },
    {
      id: 'recon_management',
      label: 'Recon Management',
      icon: ICONS.recon,
      children: [
        { label: 'A. TRS Report', path: '#trs-report' },
        { label: 'B. Cycle Wise Report', path: '#cycle-wise-report' },
        { label: 'C. Violation Settlement Report', path: '#violation-settlement-recon' },
      ],
    },
    {
      id: 'dispute_handling',
      label: 'Dispute Handling',
      icon: ICONS.dispute,
      children: [
        { label: 'A. Dispute Dashboard', path: '#dispute-dashboard' },
        { label: 'B. Validate Dispute', path: '#validate-dispute' },
        { label: 'C. Approve Dispute', path: '#approve-dispute' },
        { label: 'D. Dispute Detail Report', path: '#dispute-detail-report' },
      ],
    },
    {
      id: 'violation_management',
      label: 'Violation Management',
      icon: ICONS.violation,
      children: [
        { label: 'A. Violation Dashboard', path: '#violation-dashboard' },
        { label: 'B. View Violation', path: '#view-violation' },
        { label: 'C. Violation Settlement Report', path: '#violation-settlement-report' },
      ],
    },
    {
      id: 'transactional_report',
      label: 'Transactional Reports',
      icon: ICONS.report,
      children: [
        { label: 'A. Transaction Report', path: '#transaction-report' },
        { label: 'B. Rejected Transactions', path: '#rejected-transaction' },
        { label: 'C. Settled Transactions', path: '#settled-transaction' },
        { label: 'D. Transaction Search', path: '#transaction-search' },
        { label: 'E. Toll Fare Report', path: '#toll-fare-report' },
      ],
    },
    {
      id: 'summary_report',
      label: 'Summary Report',
      icon: ICONS.summary,
      children: [
        { label: 'A. Transaction Summary', path: '#transaction-summary' },
        { label: 'B. NHAI Traffic Report', path: '#nhai-traffic-report' },
        { label: 'C. Settlement Summary', path: '#settlement-summary' },
        { label: 'D. Pass Summary', path: '#pass-summary' },
      ],
    },
    {
      id: 'pass_issuance',
      label: 'Pass Issuance',
      icon: ICONS.pass,
      children: [
        { label: 'A. Pass Issuance', path: '/pass-issuance?tab=issue' },
        { label: 'B. Pass Issuance Approval', path: '/pass-issuance?tab=approval' },
        { label: 'C. Pass Issuance View', path: '/pass-issuance?tab=view' },
        { label: 'D. View Customer', path: '/pass-issuance?tab=customer' },
        { label: 'E. Customer Approval', path: '/pass-issuance?tab=cust-approval' },
      ],
    },
  ],

  'Concessionaire': [
    {
      id: 'dashboard',
      label: 'Dashboard',
      path: '/',
      icon: ICONS.dashboard,
    },
    {
      id: 'user_management',
      label: 'User Management',
      icon: ICONS.users,
      children: [
        { label: 'A. Create User', path: '/users?action=create' },
        { label: 'B. Unlock/Lock User', path: '/users?tab=locked' },
        { label: 'C. User Activity & Audit', path: '/activity' },
      ],
    },
    {
      id: 'tag_details',
      label: 'Tag Details',
      icon: ICONS.tag,
      children: [
        { label: 'A. Request Tag Details', path: '/tag-details?tab=request' },
        { label: 'B. Blacklist Search History', path: '/tag-details?tab=blacklist' },
      ],
    },
    {
      id: 'recon_management',
      label: 'Recon Management',
      icon: ICONS.recon,
      children: [
        { label: 'A. TRS Report', path: '#trs-report' },
        { label: 'B. Cycle Wise Report', path: '#cycle-wise-report' },
        { label: 'C. Violation Settlement Report', path: '#violation-settlement-recon' },
      ],
    },
    {
      id: 'dispute_handling',
      label: 'Dispute Handling',
      icon: ICONS.dispute,
      children: [
        { label: 'A. Dispute Dashboard', path: '#dispute-dashboard' },
        { label: 'B. Validate Dispute', path: '#validate-dispute' },
        { label: 'C. Approve Dispute', path: '#approve-dispute' },
        { label: 'D. Dispute Detail Report', path: '#dispute-detail-report' },
      ],
    },
    {
      id: 'violation_management',
      label: 'Violation Management',
      icon: ICONS.violation,
      children: [
        { label: 'A. Violation Dashboard', path: '#violation-dashboard' },
        { label: 'B. View Violation', path: '#view-violation' },
        { label: 'C. Violation Settlement Report', path: '#violation-settlement-report' },
      ],
    },
    {
      id: 'transactional_report',
      label: 'Transactional Reports',
      icon: ICONS.report,
      children: [
        { label: 'A. Transaction Report', path: '#transaction-report' },
        { label: 'B. Rejected Transactions', path: '#rejected-transaction' },
        { label: 'C. Settled Transactions', path: '#settled-transaction' },
        { label: 'D. Transaction Search', path: '#transaction-search' },
        { label: 'E. Toll Fare Report', path: '#toll-fare-report' },
      ],
    },
    {
      id: 'summary_report',
      label: 'Summary Report',
      icon: ICONS.summary,
      children: [
        { label: 'A. Transaction Summary', path: '#transaction-summary' },
        { label: 'B. NHAI Traffic Report', path: '#nhai-traffic-report' },
        { label: 'C. Settlement Summary', path: '#settlement-summary' },
        { label: 'D. Pass Summary', path: '#pass-summary' },
      ],
    },
    {
      id: 'pass_issuance',
      label: 'Pass Issuance',
      icon: ICONS.pass,
      children: [
        { label: 'A. Pass Issuance', path: '/pass-issuance?tab=issue' },
        { label: 'B. Pass Issuance Approval', path: '/pass-issuance?tab=approval' },
        { label: 'C. Pass Issuance View', path: '/pass-issuance?tab=view' },
        { label: 'D. View Customer', path: '/pass-issuance?tab=customer' },
        { label: 'E. Customer Approval', path: '/pass-issuance?tab=cust-approval' },
      ],
    },
  ],

  'Plaza POS': [
    {
      id: 'tag_details',
      label: 'Tag Details',
      icon: ICONS.tag,
      children: [
        { label: 'A. Request Tag Details', path: '/tag-details?tab=request' },
        { label: 'B. Blacklist Search History', path: '/tag-details?tab=blacklist' },
      ],
    },
    {
      id: 'pass_issuance',
      label: 'Pass Issuance',
      icon: ICONS.pass,
      children: [
        { label: 'A. Pass Issuance', path: '/pass-issuance?tab=issue' },
        { label: 'B. Pass Issuance Approval', path: '/pass-issuance?tab=approval' },
        { label: 'C. Pass Issuance View', path: '/pass-issuance?tab=view' },
        { label: 'D. View Customer', path: '/pass-issuance?tab=customer' },
        { label: 'E. Customer Approval', path: '/pass-issuance?tab=cust-approval' },
      ],
    },
  ],

  'Request Tag Details': [
    {
      id: 'tag_details',
      label: 'Tag Details',
      icon: ICONS.tag,
      children: [
        { label: 'A. Request Tag Details', path: '/tag-details?tab=request' },
        { label: 'B. Blacklist Search History', path: '/tag-details?tab=blacklist' },
      ],
    },
  ],

  // Fallback for Bank role if assigned
  'Bank': [
    {
      id: 'dashboard',
      label: 'Dashboard',
      path: '/',
      icon: ICONS.dashboard,
    },
    {
      id: 'user_activity',
      label: 'User Activity & Audit',
      path: '/activity',
      icon: ICONS.users,
    },
    {
      id: 'recon_management',
      label: 'Recon Management',
      icon: ICONS.recon,
      children: [
        { label: 'A. TRS Report', path: '#trs-report' },
        { label: 'B. Cycle Wise Report', path: '#cycle-wise-report' },
        { label: 'C. Violation Settlement Report', path: '#violation-settlement-recon' },
      ],
    },
    {
      id: 'dispute_handling',
      label: 'Dispute Handling',
      icon: ICONS.dispute,
      children: [
        { label: 'A. Dispute Dashboard', path: '#dispute-dashboard' },
        { label: 'B. Dispute Detail Report', path: '#dispute-detail-report' },
      ],
    },
    {
      id: 'summary_report',
      label: 'Summary Report',
      icon: ICONS.summary,
      children: [
        { label: 'A. Transaction Summary', path: '#transaction-summary' },
        { label: 'B. Settlement Summary', path: '#settlement-summary' },
      ],
    },
  ],
};

import { MENU_TREE, getRoleMenuDefaults } from '../pages/UserList/menuConfig';

export const getRoleNavigation = (role) => {
  return ROLE_NAVIGATION_MAP[role] || ROLE_NAVIGATION_MAP['Admin'];
};

export const filterNavigationByPermissions = (sections, menuAccess) => {
  if (!sections || !Array.isArray(sections)) return [];
  // If no menuAccess is defined at all (null/undefined), show all sections as fallback
  if (menuAccess === null || menuAccess === undefined) {
    return sections;
  }
  // If menuAccess is explicitly empty, return no sections
  if (!Array.isArray(menuAccess) || menuAccess.length === 0) {
    return [];
  }

  const allowedSet = new Set(menuAccess);

  const normalize = (str) =>
    (str || '')
      .replace(/^[A-Z]\.\s*/, '')
      .replace(/\s*\/\s*/g, '/')
      .replace(/\s+/g, ' ')
      .replace(/s$/i, '')
      .trim()
      .toLowerCase();

  return sections
    .map((item) => {
      // Check top-level permission
      const isParentAllowed =
        allowedSet.has(item.id) ||
        (item.id === 'user_activity' && (allowedSet.has('user_activity') || allowedSet.has('user_management')));

      // If no children, it's a leaf item (e.g. Dashboard) — only show if parent is explicitly allowed
      if (!item.children || item.children.length === 0) {
        return isParentAllowed ? item : null;
      }

      // If parent module itself is not allowed in permissions, hide the entire group
      if (!isParentAllowed) {
        return null;
      }

      // If item has children, filter sub-items STRICTLY by allowedSet
      const filteredChildren = item.children.filter((child) => {
        // Direct match by explicit subId or child id
        if (child.subId && allowedSet.has(child.subId)) return true;
        if (child.id && allowedSet.has(child.id)) return true;

        // User activity link fallback
        if (child.path === '/activity' || (child.label && child.label.toLowerCase().includes('user activity'))) {
          return allowedSet.has('user_activity') || allowedSet.has('user_management');
        }

        // Match child label against MENU_TREE sub-items for permission lookup
        const cleanChildLabel = normalize(child.label);
        const groupInTree = MENU_TREE.find((m) => m.id === item.id);
        if (groupInTree && groupInTree.subs && groupInTree.subs.length > 0) {
          const matchedSub = groupInTree.subs.find(
            (s) => normalize(s.label) === cleanChildLabel
          );
          if (matchedSub) {
            // Sub-item found in config — enforce its specific permission
            return allowedSet.has(matchedSub.id);
          }
          // Sub-item not in config — deny by default (strict enforcement)
          return false;
        }

        // No sub-items defined for this parent in MENU_TREE — allow if parent is allowed
        return true;
      });

      // If all sub-items were filtered out, hide section completely
      if (filteredChildren.length === 0) {
        return null;
      }

      return {
        ...item,
        children: filteredChildren,
      };
    })
    .filter(Boolean);
};

export const getRoleSlug = (role) => {
  switch (role) {
    case 'Master Admin':
      return 'master-admin';
    case 'Admin':
      return 'admin';
    case 'Plaza Admin':
    case 'Plaza Manager':
      return 'plaza-admin';
    case 'Bank':
    case 'Bank Auditor':
    case 'Recon Officer':
      return 'bank-auditor';
    case 'Concessionaire':
      return 'concessionaire';
    case 'Plaza POS':
    case 'Cashier':
      return 'plaza-pos';
    case 'Request Tag Details':
    case 'Dispute Handler':
    case 'Compliance Auditor':
      return 'request-tag-details';
    default:
      return 'master-admin';
  }
};

export const hasDashboardAccess = (userOrRole) => {
  if (!userOrRole) return false;
  if (typeof userOrRole === 'object') {
    const role = userOrRole.role || 'Admin';
    const roleHasAccess = ['Master Admin', 'Admin', 'Plaza Admin', 'Concessionaire', 'Bank'].includes(role);
    if (!roleHasAccess) return false;
    if (userOrRole.menuAccess && Array.isArray(userOrRole.menuAccess)) {
      return userOrRole.menuAccess.includes('dashboard');
    }
    return true;
  }
  return ['Master Admin', 'Admin', 'Plaza Admin', 'Concessionaire', 'Bank'].includes(userOrRole);
};

export const hasMenuAccess = (user, menuId) => {
  if (!user) return false;
  const menuAccess = user.menuAccess || getRoleMenuDefaults(user.role);
  if (!menuAccess || !Array.isArray(menuAccess)) return true;
  if (menuId === 'user_activity') {
    return menuAccess.includes('user_activity') || menuAccess.includes('user_management');
  }
  return menuAccess.includes(menuId);
};

export const getDefaultRouteForUser = (user) => {
  if (!user) return '/login';
  const role = user.role || 'Admin';
  const menuAccess = user.menuAccess || getRoleMenuDefaults(role);

  // If dashboard is permitted, go to '/'
  if (hasDashboardAccess(user)) {
    return '/';
  }

  // Filter sections to find the first accessible top-level or sub-route
  const baseSections = getRoleNavigation(role);
  const visible = filterNavigationByPermissions(baseSections, menuAccess);

  for (const sec of visible) {
    if (sec.path && !sec.path.startsWith('#') && sec.path !== '/') {
      return sec.path;
    }
    if (sec.children && sec.children.length > 0) {
      for (const ch of sec.children) {
        if (ch.path && !ch.path.startsWith('#')) {
          return ch.path;
        }
      }
    }
  }

  return '/tag-details';
};

export const getDefaultRouteForRole = (role) => {
  return getDefaultRouteForUser({ role });
};



