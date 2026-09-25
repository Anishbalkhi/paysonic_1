export const ROLE_NO_USER_TYPE = ['Master Admin', 'Admin', 'Bank'];
export const ALL_PLAZAS = [
  'Mumbai Plaza NH-04',
  'Pune Bypass Plaza',
  'Nashik Toll Plaza',
  'Solapur Plaza NH-65',
  'Kolhapur Plaza'
];
export const ROLE_AUTO_ALL_PLAZA = ['Master Admin', 'Admin'];
export const ROLE_NO_PLAZA = ['Bank'];

export const MENU_TREE = [
  { id: 'dashboard', label: 'Dashboard', subs: [] },
  {
    id: 'user_management',
    label: 'User Management',
    subs: [
      { id: 'user_management_create_user', label: 'Create User' },
      { id: 'user_management_approve_user', label: 'Approve User' },
      { id: 'user_management_assign_user', label: 'Assign User' },
      { id: 'user_management_lock_unlock_user', label: 'Unlock/ Lock User' }
    ]
  },
  {
    id: 'user_activity',
    label: 'User Activity & Audit',
    subs: []
  },
  {
    id: 'tag_details',
    label: 'Tag Details',
    subs: [
      { id: 'tag_details_request_tag_details', label: 'Request Tag Details' },
      { id: 'tag_details_blacklist_search_history', label: 'Blacklist Search History' }
    ]
  },
  {
    id: 'recon_management',
    label: 'Recon Management',
    subs: [
      { id: 'recon_management_upload_recon_file', label: 'Upload Recon File' },
      { id: 'recon_management_recon_file_status', label: 'Recon File Status' },
      { id: 'recon_management_trs_report', label: 'TRS Report' },
      { id: 'recon_management_cycle_wise_report', label: 'Cycle Wise Report' },
      { id: 'recon_management_violation_settlement_report', label: 'Violation Settlement Report' }
    ]
  },
  {
    id: 'dispute_handling',
    label: 'Dispute Handling',
    subs: [
      { id: 'dispute_handling_dispute_dashboard', label: 'Dispute Dashboard' },
      { id: 'dispute_handling_dispute_file_upload', label: 'Dispute File Upload' },
      { id: 'dispute_handling_dispute_file_status', label: 'Dispute File Status' },
      { id: 'dispute_handling_chargeback_assign', label: 'Chargeback Assign' },
      { id: 'dispute_handling_validate_dispute', label: 'Validate Dispute' },
      { id: 'dispute_handling_approve_dispute', label: 'Approve Dispute' },
      { id: 'dispute_handling_dispute_detail_report', label: 'Dispute Detail Report' }
    ]
  },
  {
    id: 'violation_management',
    label: 'Violation Management',
    subs: [
      { id: 'violation_management_violation_dashboard', label: 'Violation Dashboard' },
      { id: 'violation_management_violation_validate', label: 'Violation Validate' },
      { id: 'violation_management_view_violation', label: 'View Violation' },
      { id: 'violation_management_violation_settlement_report', label: 'Violation Settlement Report' },
      { id: 'violation_management_violation_raw_file', label: 'Violation Raw File' },
      { id: 'violation_management_violation_bulk_action', label: 'Violation Bulk Action' }
    ]
  },
  {
    id: 'transactional_report',
    label: 'Transactional Report',
    subs: [
      { id: 'transactional_report_transaction_report', label: 'Transaction Report' },
      { id: 'transactional_report_rejected_transaction', label: 'Rejected Transaction' },
      { id: 'transactional_report_settled_transaction', label: 'Settled Transaction' },
      { id: 'transactional_report_toll_fare_report', label: 'Toll Fare Report' },
      { id: 'transactional_report_transaction_search', label: 'Transaction Search' }
    ]
  },
  {
    id: 'pass_issuance',
    label: 'Pass Issuance',
    subs: [
      { id: 'pass_issuance_pass_issuance', label: 'Pass Issuance' },
      { id: 'pass_issuance_pass_issuance_approval', label: 'Pass Issuance Approval' },
      { id: 'pass_issuance_pass_issuance_view', label: 'Pass Issuance View' },
      { id: 'pass_issuance_view_customer', label: 'View Customer' },
      { id: 'pass_issuance_customer_approval', label: 'Customer Approval' }
    ]
  },
  {
    id: 'summary_report',
    label: 'Summary Report',
    subs: [
      { id: 'summary_report_transaction_summary', label: 'Transaction Summary' },
      { id: 'summary_report_nhai_traffic_report', label: 'NHAI Traffic Report' },
      { id: 'summary_report_settlement_summary', label: 'Settlement Summary' },
      { id: 'summary_report_pass_summary', label: 'Pass Summary' }
    ]
  },
  {
    id: 'on_boarding',
    label: 'On Boarding',
    subs: [
      { id: 'on_boarding_view_plaza', label: 'View Plaza' },
      { id: 'on_boarding_add_concessionaire', label: 'Add Concessionaire' },
      { id: 'on_boarding_add_plaza', label: 'Add Plaza' },
      { id: 'on_boarding_lane_details', label: 'Lane Details' },
      { id: 'on_boarding_callback_url', label: 'Callback URLs' },
      { id: 'on_boarding_fare_mapping', label: 'Fare Mapping' },
      { id: 'on_boarding_cch_mapping', label: 'CCH Mapping' },
      { id: 'on_boarding_on_boarding_approver', label: 'On Boarding Approver' },
      { id: 'on_boarding_view_group', label: 'View Group' },
      { id: 'on_boarding_view_company', label: 'View Company' },
      { id: 'on_boarding_view_division', label: 'View Division' },
      { id: 'on_boarding_viewproject', label: 'ViewProject' },
      { id: 'on_boarding_plaza_doc_upload_file', label: 'Plaza Doc Upload File' },
      { id: 'on_boarding_approve_palza_upload', label: 'Approve Palza Upload' }
    ]
  }
];

export const ROLE_MENU_DEFAULTS = {
  Admin: [
    'dashboard',
    'user_management', 'user_management_create_user', 'user_management_approve_user', 'user_management_assign_user', 'user_management_lock_unlock_user',
    'user_activity',
    'tag_details', 'tag_details_request_tag_details', 'tag_details_blacklist_search_history',
    'recon_management', 'recon_management_trs_report', 'recon_management_cycle_wise_report', 'recon_management_violation_settlement_report',
    'dispute_handling', 'dispute_handling_dispute_dashboard', 'dispute_handling_validate_dispute', 'dispute_handling_approve_dispute', 'dispute_handling_dispute_detail_report',
    'violation_management', 'violation_management_violation_dashboard', 'violation_management_violation_validate', 'violation_management_violation_settlement_report', 'violation_management_violation_raw_file', 'violation_management_violation_bulk_action',
    'transactional_report', 'transactional_report_transaction_report', 'transactional_report_rejected_transaction', 'transactional_report_settled_transaction', 'transactional_report_toll_fare_report', 'transactional_report_transaction_search',
    'pass_issuance', 'pass_issuance_pass_issuance', 'pass_issuance_pass_issuance_approval', 'pass_issuance_pass_issuance_view', 'pass_issuance_view_customer', 'pass_issuance_customer_approval',
    'summary_report', 'summary_report_transaction_summary', 'summary_report_nhai_traffic_report', 'summary_report_settlement_summary', 'summary_report_pass_summary',
    'on_boarding', 'on_boarding_view_plaza', 'on_boarding_add_concessionaire', 'on_boarding_add_plaza', 'on_boarding_lane_details', 'on_boarding_callback_url', 'on_boarding_fare_mapping', 'on_boarding_cch_mapping'
  ],
  'Plaza Admin': [
    'dashboard',
    'user_management', 'user_management_create_user', 'user_management_assign_user', 'user_management_lock_unlock_user',
    'tag_details', 'tag_details_request_tag_details', 'tag_details_blacklist_search_history',
    'recon_management', 'recon_management_trs_report', 'recon_management_cycle_wise_report', 'recon_management_violation_settlement_report',
    'dispute_handling', 'dispute_handling_dispute_dashboard', 'dispute_handling_validate_dispute', 'dispute_handling_approve_dispute', 'dispute_handling_dispute_detail_report',
    'violation_management', 'violation_management_violation_dashboard', 'violation_management_view_violation', 'violation_management_violation_settlement_report',
    'transactional_report', 'transactional_report_transaction_report', 'transactional_report_rejected_transaction', 'transactional_report_settled_transaction', 'transactional_report_transaction_search', 'transactional_report_toll_fare_report',
    'summary_report', 'summary_report_transaction_summary', 'summary_report_nhai_traffic_report', 'summary_report_settlement_summary', 'summary_report_pass_summary',
    'pass_issuance', 'pass_issuance_pass_issuance', 'pass_issuance_pass_issuance_approval', 'pass_issuance_pass_issuance_view', 'pass_issuance_view_customer', 'pass_issuance_customer_approval',
    'on_boarding', 'on_boarding_view_plaza', 'on_boarding_lane_details', 'on_boarding_callback_url', 'on_boarding_fare_mapping', 'on_boarding_cch_mapping'
  ],
  Concessionaire: [
    'dashboard',
    'user_management', 'user_management_create_user', 'user_management_assign_user', 'user_management_lock_unlock_user',
    'tag_details', 'tag_details_request_tag_details', 'tag_details_blacklist_search_history',
    'recon_management', 'recon_management_trs_report', 'recon_management_cycle_wise_report', 'recon_management_violation_settlement_report',
    'dispute_handling', 'dispute_handling_dispute_dashboard', 'dispute_handling_validate_dispute', 'dispute_handling_approve_dispute', 'dispute_handling_dispute_detail_report',
    'violation_management', 'violation_management_violation_dashboard', 'violation_management_view_violation', 'violation_management_violation_settlement_report',
    'transactional_report', 'transactional_report_transaction_report', 'transactional_report_rejected_transaction', 'transactional_report_settled_transaction', 'transactional_report_transaction_search', 'transactional_report_toll_fare_report',
    'summary_report', 'summary_report_transaction_summary', 'summary_report_nhai_traffic_report', 'summary_report_settlement_summary', 'summary_report_pass_summary',
    'pass_issuance', 'pass_issuance_pass_issuance', 'pass_issuance_pass_issuance_approval', 'pass_issuance_pass_issuance_view', 'pass_issuance_view_customer', 'pass_issuance_customer_approval',
    'on_boarding', 'on_boarding_view_plaza', 'on_boarding_add_concessionaire', 'on_boarding_add_plaza', 'on_boarding_lane_details', 'on_boarding_callback_url', 'on_boarding_fare_mapping', 'on_boarding_cch_mapping'
  ],
  'Plaza POS': [
    'tag_details', 'tag_details_request_tag_details', 'tag_details_blacklist_search_history',
    'pass_issuance', 'pass_issuance_pass_issuance', 'pass_issuance_pass_issuance_approval', 'pass_issuance_pass_issuance_view', 'pass_issuance_view_customer', 'pass_issuance_customer_approval'
  ],
  'Request Tag Details': [
    'tag_details', 'tag_details_request_tag_details', 'tag_details_blacklist_search_history'
  ],
  Bank: []
};

// All IDs for Master Admin (every module and every sub-item)
const allMenuIds = [];
MENU_TREE.forEach((m) => {
  allMenuIds.push(m.id);
  m.subs.forEach((s) => allMenuIds.push(s.id));
});
ROLE_MENU_DEFAULTS['Master Admin'] = allMenuIds;

export const getAllMenuIds = () => allMenuIds;

export const getRoleMenuDefaults = (role) => {
  if (!role) return [];
  if (role === 'Master Admin') return allMenuIds;
  return ROLE_MENU_DEFAULTS[role] || [];
};

export const buildAccessGroups = (role, wantDefault) => {
  const defaults = getRoleMenuDefaults(role);
  const defaultSet = new Set(defaults);
  const groups = [];

  MENU_TREE.forEach((m) => {
    if (m.subs.length === 0) {
      const inDefault = defaultSet.has(m.id);
      if (inDefault === wantDefault) {
        groups.push({ id: m.id, label: m.label, leaf: true });
      }
      return;
    }
    const subs = m.subs.filter((s) => {
      const inDefault = defaultSet.has(s.id);
      return inDefault === wantDefault;
    });
    if (subs.length > 0) {
      groups.push({ id: m.id, label: m.label, leaf: false, subs });
    }
  });

  return groups;
};

// Fixed ordered list of all menu IDs for bitmask serialization
export const ALL_ORDERED_MENU_IDS = allMenuIds;

/**
 * Encodes an array of menu permission IDs into a compact hexadecimal string (10-15 chars)
 */
export function encodeMenuAccessToHex(selected) {
  if (!Array.isArray(selected) || selected.length === 0) return '';
  let mask = 0n;
  const set = new Set(selected);
  allMenuIds.forEach((id, idx) => {
    if (set.has(id)) mask |= (1n << BigInt(idx));
  });
  return mask.toString(16);
}

/**
 * Decodes a hexadecimal bitmask string back into the array of allowed menu IDs
 */
export function decodeMenuAccessFromHex(hex) {
  if (!hex || typeof hex !== 'string') return null;
  try {
    const cleanHex = hex.trim();
    if (!cleanHex) return null;
    const mask = BigInt('0x' + cleanHex);
    const result = [];
    allMenuIds.forEach((id, idx) => {
      if ((mask & (1n << BigInt(idx))) !== 0n) {
        result.push(id);
      }
    });
    return result;
  } catch (e) {
    return null;
  }
}

/**
 * Parses userType string to extract clean userType and any encoded menuAccess bitmask
 */
export function parseUserTypeWithPermissions(rawUserType) {
  if (!rawUserType) return { cleanUserType: '—', menuAccess: null };
  const str = String(rawUserType).trim();
  if (str.includes('#M:')) {
    const parts = str.split('#M:');
    const cleanUserType = parts[0] ? parts[0].trim() : '—';
    const hex = parts[1] ? parts[1].trim() : null;
    if (hex === '0' || hex === 'none' || hex === '') {
      return { cleanUserType: cleanUserType || '—', menuAccess: [] };
    }
    const menuAccess = hex ? decodeMenuAccessFromHex(hex) : null;
    return { cleanUserType: cleanUserType || '—', menuAccess };
  }
  return { cleanUserType: str, menuAccess: null };
}

/**
 * Formats a clean userType and menuAccess array into a serialized userType string that fits within VARCHAR(50)
 */
export function buildUserTypeWithPermissions(cleanUserType, menuAccess) {
  const base = cleanUserType && cleanUserType !== '—' ? cleanUserType.trim() : 'Toll Plaza';
  if (Array.isArray(menuAccess)) {
    if (menuAccess.length === 0) {
      return `${base}#M:0`;
    }
    const hex = encodeMenuAccessToHex(menuAccess);
    if (hex) {
      return `${base}#M:${hex}`;
    }
  }
  return base;
}

