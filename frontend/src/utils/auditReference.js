/**
 * Paysonic Audit Reference Utility
 * Maps audit events and module actions to canonical entity references
 */

export const referenceFor = (event) => {
  if (!event) return { refId: 'N/A', label: 'General', type: 'system' };

  if (event.referenceId) {
    return {
      refId: event.referenceId,
      label: event.target || event.referenceId,
      type: event.module ? event.module.toLowerCase().replace(/\s+/g, '-') : 'general',
    };
  }

  const mod = (event.module || '').toLowerCase();
  const id = event.id ? String(event.id).replace(/\D/g, '') : '0000';

  if (mod.includes('user')) {
    const userMatch = (event.target || '').match(/PSN\d+/i);
    const ref = userMatch ? userMatch[0].toUpperCase() : `PSN${id.padStart(4, '0').slice(-4)}`;
    return { refId: ref, label: 'User Account', type: 'user' };
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

  if (mod.includes('transaction')) {
    return { refId: `TXN-${id.slice(-6) || '748291'}`, label: 'Payment Txn', type: 'transaction' };
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
