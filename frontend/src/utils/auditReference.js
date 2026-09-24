/**
 * Paysonic Audit Reference Utility
 * Maps audit events and module actions to canonical entity references.
 *
 * Railway's AOP aspect writes target = module name (e.g. "User Management")
 * for all records. The actual entity ID lives in event.before:
 *   - DELETE/TOGGLE/APPROVE: before is a raw string  e.g. "PSN0001"
 *   - CREATE/UPDATE:         before is an object     e.g. { id: "PSN0001", ... }
 * We extract from there when target is the generic module name.
 */

// Attempt to extract a real entity ID from the before/after payloads
const extractEntityId = (event) => {
  const before = event.before;
  const after  = event.after;
  // String form: DELETE_USER, TOGGLE_LOCK, APPROVE_USER store userId as raw string in before
  if (typeof before === 'string' && before.trim()) return before.trim();
  // Object form: CREATE_USER / UPDATE_USER store the entity under before.id
  if (before && typeof before === 'object' && before.id) return before.id;
  // Fallback: check after.id
  if (after && typeof after === 'object' && after.id) return after.id;
  return null;
};

export const referenceFor = (event) => {
  if (!event) return { refId: 'N/A', label: 'General', type: 'system' };

  // If referenceId is already a meaningful value (not the generic module name), use it
  if (event.referenceId && event.referenceId !== event.module) {
    return {
      refId: event.referenceId,
      label: event.target || event.referenceId,
      type: event.module ? event.module.toLowerCase().replace(/\s+/g, '-') : 'general',
    };
  }

  const mod = (event.module || '').toLowerCase();
  const id = event.id ? String(event.id).replace(/\D/g, '') : '0000';

  if (mod.includes('user')) {
    // Try to get real entity ID: first from before/after payloads, then from target
    const entityId =
      extractEntityId(event) ||
      ((event.target || '').match(/PSN\w+/i) || [])[0] ||
      `PSN${id.padStart(4, '0').slice(-4)}`;
    return { refId: String(entityId).toUpperCase(), label: 'User Account', type: 'user' };
  }

  if (mod.includes('session') || (event.action || '').toLowerCase().includes('logout')) {
    const sesId =
      extractEntityId(event) ||
      ((event.target || '').match(/SES-[\w]+/i) || [])[0] ||
      `SES-${id.slice(-6)}`;
    return { refId: String(sesId).toUpperCase(), label: 'Session', type: 'session' };
  }

  if (mod.includes('dispute')) {
    return { refId: `DSP-${id.slice(-5) || '48201'}`, label: 'Dispute Case', type: 'dispute' };
  }

  if (mod.includes('recon')) {
    return { refId: `RCN-${id.slice(-4) || '8192'}`, label: 'Recon Batch', type: 'recon' };
  }

  if (mod.includes('violation')) {
    return { refId: `VIO-${id.slice(-5) || '99120'}`, label: 'Violation Record', type: 'violation' };
  }

  if (mod.includes('transaction') || mod.includes('report')) {
    const expId = extractEntityId(event) || `TXN-${id.slice(-6) || '748291'}`;
    return { refId: String(expId).toUpperCase(), label: 'Report / Export', type: 'transaction' };
  }

  if (mod.includes('tag')) {
    return { refId: `TAG-${id.slice(-5) || '10293'}`, label: 'FASTag Request', type: 'tag' };
  }

  if (mod.includes('pass')) {
    return { refId: `PSS-${id.slice(-4) || '5501'}`, label: 'Pass Issuance', type: 'pass' };
  }

  if (mod.includes('on boarding') || mod.includes('onboarding')) {
    return { refId: `PLZ-${id.slice(-3) || '104'}`, label: 'Plaza Entity', type: 'plaza' };
  }

  return {
    refId: `REF-${id.slice(-4) || '0001'}`,
    label: event.module || 'System',
    type: 'system',
  };
};

export default {
  referenceFor,
};
