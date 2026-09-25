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
      path: '/users',
      icon: ICONS.users,
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
        { subId: 'tag_details_request_tag_details', label: 'A. Request Tag Details', path: '/tag-details?tab=request' },
        { subId: 'tag_details_blacklist_search_history', label: 'B. Blacklist Search History', path: '/tag-details?tab=blacklist' },
      ],
    },
    {
      id: 'recon_management',
      label: 'Recon Management',
      icon: ICONS.recon,
      children: [
        { subId: 'recon_management_upload_recon_file', label: 'A. Upload Recon File', path: '#upload-recon' },
        { subId: 'recon_management_recon_file_status', label: 'B. Recon File Status', path: '#recon-status' },
        { subId: 'recon_management_trs_report', label: 'C. TRS Report', path: '#trs-report' },
        { subId: 'recon_management_cycle_wise_report', label: 'D. Cycle Wise Report', path: '#cycle-wise-report' },
        { subId: 'recon_management_violation_settlement_report', label: 'E. Violation Settlement Report', path: '#violation-settlement-recon' },
      ],
    },
    {
      id: 'dispute_handling',
      label: 'Dispute Handling',
      icon: ICONS.dispute,
      children: [
        { subId: 'dispute_handling_dispute_dashboard', label: 'A. Dispute Dashboard', path: '#dispute-dashboard' },
        { subId: 'dispute_handling_dispute_file_upload', label: 'B. Dispute File Upload', path: '#dispute-file-upload' },
        { subId: 'dispute_handling_dispute_file_status', label: 'C. Dispute File Status', path: '#dispute-file-status' },
        { subId: 'dispute_handling_chargeback_assign', label: 'D. Chargeback Assign', path: '#chargeback-assign' },
        { subId: 'dispute_handling_validate_dispute', label: 'E. Validate Dispute', path: '#validate-dispute' },
        { subId: 'dispute_handling_approve_dispute', label: 'F. Approve Dispute', path: '#approve-dispute' },
        { subId: 'dispute_handling_dispute_detail_report', label: 'G. Dispute Detail Report', path: '#dispute-detail-report' },
      ],
    },
    {
      id: 'violation_management',
      label: 'Violation Management',
      icon: ICONS.violation,
      children: [
        { subId: 'violation_management_violation_dashboard', label: 'A. Violation Dashboard', path: '#violation-dashboard' },
        { subId: 'violation_management_violation_validate', label: 'B. Violation Validate', path: '#violation-validate' },
        { subId: 'violation_management_view_violation', label: 'C. View Violation', path: '#view-violation' },
        { subId: 'violation_management_violation_settlement_report', label: 'D. Violation Settlement Report', path: '#violation-settlement-report' },
        { subId: 'violation_management_violation_raw_file', label: 'E. Violation Raw File', path: '#violation-raw-file' },
        { subId: 'violation_management_violation_bulk_action', label: 'F. Violation Bulk Action', path: '#violation-bulk-action' },
      ],
    },
    {
      id: 'transactional_report',
      label: 'Transactional Report',
      icon: ICONS.report,
      children: [
        { subId: 'transactional_report_transaction_report', label: 'A. Transaction Report', path: '#transaction-report' },
        { subId: 'transactional_report_rejected_transaction', label: 'B. Rejected Transaction', path: '#rejected-transaction' },
        { subId: 'transactional_report_settled_transaction', label: 'C. Settled Transaction', path: '#settled-transaction' },
        { subId: 'transactional_report_toll_fare_report', label: 'D. Toll Fare Report', path: '#toll-fare-report' },
        { subId: 'transactional_report_transaction_search', label: 'E. Transaction Search', path: '#transaction-search' },
      ],
    },
    {
      id: 'pass_issuance',
      label: 'Pass Issuance',
      icon: ICONS.pass,
      children: [
        { subId: 'pass_issuance_pass_issuance', label: 'A. Pass Issuance', path: '/pass-issuance?tab=issue' },
        { subId: 'pass_issuance_pass_issuance_approval', label: 'B. Pass Issuance Approval', path: '/pass-issuance?tab=approval' },
        { subId: 'pass_issuance_pass_issuance_view', label: 'C. Pass Issuance View', path: '/pass-issuance?tab=view' },
        { subId: 'pass_issuance_view_customer', label: 'D. View Customer', path: '/pass-issuance?tab=customer' },
        { subId: 'pass_issuance_customer_approval', label: 'E. Customer Approval', path: '/pass-issuance?tab=cust-approval' },
      ],
    },
    {
      id: 'summary_report',
      label: 'Summary Report',
      icon: ICONS.summary,
      children: [
        { subId: 'summary_report_transaction_summary', label: 'A. Transaction Summary', path: '#transaction-summary' },
        { subId: 'summary_report_nhai_traffic_report', label: 'B. NHAI Traffic Report', path: '#nhai-traffic-report' },
        { subId: 'summary_report_settlement_summary', label: 'C. Settlement Summary', path: '#settlement-summary' },
        { subId: 'summary_report_pass_summary', label: 'D. Pass Summary', path: '#pass-summary' },
      ],
    },
    {
      id: 'on_boarding',
      label: 'On Boarding',
      icon: ICONS.onboarding,
      children: [
        { subId: 'on_boarding_on_boarding_approver', label: 'A. On Boarding Approver', path: '#on-boarding-approver' },
        { subId: 'on_boarding_view_group', label: 'B. View Group', path: '#view-group' },
        { subId: 'on_boarding_view_company', label: 'C. View Company', path: '#view-company' },
        { subId: 'on_boarding_view_division', label: 'D. View Division', path: '#view-division' },
        { subId: 'on_boarding_viewproject', label: 'E. ViewProject', path: '#view-project' },
        { subId: 'on_boarding_view_plaza', label: 'F. View Plaza', path: '#view-plaza' },
        { subId: 'on_boarding_plaza_doc_upload_file', label: 'G. Plaza Doc Upload File', path: '#plaza-doc-upload-file' },
        { subId: 'on_boarding_approve_palza_upload', label: 'H. Approve Plaza Upload', path: '#approve-plaza-upload' },
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
      path: '/users',
      icon: ICONS.users,
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
      path: '/users',
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
      path: '/users',
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
      // Check top-level permission strictly against allowedSet
      const isParentAllowed = allowedSet.has(item.id);

      // If no children, it's a leaf item (e.g. Dashboard, User Management, User Activity)
      // Only show if parent is explicitly allowed
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

        // Match child label against MENU_TREE sub-items for permission lookup
        const cleanChildLabel = normalize(child.label);
        const groupInTree = MENU_TREE.find((m) => m.id === item.id);
        if (groupInTree && groupInTree.subs && groupInTree.subs.length > 0) {
          const matchedSub = groupInTree.subs.find(
            (s) => normalize(s.label) === cleanChildLabel
          );
          if (matchedSub) {
            return allowedSet.has(matchedSub.id);
          }
          return false;
        }

        // If no sub-items defined in MENU_TREE, allow if parent is allowed
        return isParentAllowed;
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



