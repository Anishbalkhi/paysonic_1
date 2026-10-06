/**
 * auditEntityResolver.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Resolves rich target entity details from audit log events.
 * Specifically for User Management events (DELETE_USER, CREATE_USER, etc.),
 * it extracts the exact user affected (User ID, Name, Email, Role, Plaza, Status)
 * even when the raw backend record stored generic module titles or correlation IDs.
 */

// Helper to get cached users from localStorage
const getCachedUsers = () => {
  try {
    const raw = localStorage.getItem('paysonic_users_cache');
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
};

/**
 * Resolves full target user profile details from an audit event.
 */
export const resolveTargetUser = (event) => {
  if (!event) return null;

  const isUserModule = (event.module || '').toLowerCase().includes('user') ||
                       (event.action || '').toUpperCase().includes('USER') ||
                       (event.actionLabel || '').toLowerCase().includes('user');

  if (!isUserModule) return null;

  let userId = null;
  let name = null;
  let email = null;
  let role = null;
  let plaza = null;
  let mobile = null;
  let status = null;

  // 1. Inspect after payload (present in CREATE_USER, UPDATE_USER, APPROVE_USER)
  if (event.after && typeof event.after === 'object') {
    if (event.after.id) userId = event.after.id;
    if (event.after.name) name = event.after.name;
    if (event.after.email) email = event.after.email;
    if (event.after.role) role = event.after.role;
    if (event.after.assignedPlaza || event.after.plaza) plaza = event.after.assignedPlaza || event.after.plaza;
    if (event.after.mobile || event.after.contact) mobile = event.after.mobile || event.after.contact;
    if (event.after.status) status = event.after.status;
  }

  // 2. Inspect before payload (present in DELETE_USER, TOGGLE_LOCK, CREATE_USER initial state)
  if (event.before) {
    if (typeof event.before === 'string') {
      const match = event.before.trim().match(/PSN[A-Za-z0-9]+/i);
      if (match) userId = match[0].toUpperCase();
      else if (event.before.trim().length <= 32 && !event.before.includes('{')) {
        userId = event.before.trim();
      }
    } else if (typeof event.before === 'object') {
      if (!userId && event.before.id) userId = event.before.id;
      if (!name && event.before.name) name = event.before.name;
      if (!email && event.before.email) email = event.before.email;
      if (!role && event.before.role) role = event.before.role;
      if (!plaza && (event.before.assignedPlaza || event.before.plaza)) plaza = event.before.assignedPlaza || event.before.plaza;
      if (!mobile && (event.before.mobile || event.before.contact)) mobile = event.before.mobile || event.before.contact;
      if (!status && event.before.status) status = event.before.status;
    }
  }

  // 3. Inspect target string (e.g. "Sanjay (PSN0001)" or "PSN7233")
  if (event.target && event.target !== 'User Management') {
    const psnMatch = event.target.match(/PSN[A-Za-z0-9]+/i);
    if (!userId && psnMatch) userId = psnMatch[0].toUpperCase();
    if (!name && event.target.includes('(')) {
      name = event.target.split('(')[0].trim();
    }
  }

  // 4. Inspect referenceId if it's a real user ID and not a correlation ID
  if (!userId && event.referenceId && !event.referenceId.startsWith('CORR-') && event.referenceId !== event.module) {
    const refMatch = event.referenceId.match(/PSN[A-Za-z0-9]+/i);
    if (refMatch) userId = refMatch[0].toUpperCase();
  }

  // 5. Look up user in cached directory to fill in any missing attributes
  if (userId) {
    const cachedUsers = getCachedUsers();
    const matchedUser = cachedUsers.find(
      (u) => (u.id && u.id.toUpperCase() === userId.toUpperCase()) ||
             (email && u.email && u.email.toLowerCase() === email.toLowerCase())
    );

    if (matchedUser) {
      if (!name) name = matchedUser.name;
      if (!email) email = matchedUser.email;
      if (!role) role = matchedUser.role;
      if (!plaza) plaza = matchedUser.assignedPlaza || matchedUser.plaza;
      if (!mobile) mobile = matchedUser.mobile || matchedUser.contact;
      if (!status) status = matchedUser.status;
    }
  }

  const action = (event.action || '').toUpperCase();
  const actionLabel = (event.actionLabel || '').toLowerCase();
  const isDelete = action.includes('DELETE') || actionLabel.includes('trash') || actionLabel.includes('deleted');
  const isCreate = action.includes('CREATE') || actionLabel.includes('created');
  const isLock = action.includes('LOCK');
  const isApprove = action.includes('APPROVE') || actionLabel.includes('approved');

  // Derive human-readable status
  let statusDisplay = status || 'Active';
  if (isDelete) {
    statusDisplay = 'Trash User (Deleted)';
  } else if (isCreate && !status) {
    statusDisplay = 'Provisioned';
  }

  // Fallback ID if totally missing
  const finalId = userId || (event.id ? `PSN${String(event.id).replace(/\D/g, '').padStart(4, '0').slice(-4)}` : 'PSN-USER');

  return {
    id: finalId,
    name: name || 'User Profile',
    email: email || null,
    role: role || 'Operational Staff',
    plaza: plaza || 'All plazas',
    mobile: mobile || null,
    status: statusDisplay,
    isDelete,
    isCreate,
    isLock,
    isApprove,
    displayName: name ? `${name} (${finalId})` : finalId,
  };
};

/**
 * Generates an intuitive, narrative summary for the audit event.
 */
export const getEventNarrative = (event, userDetails) => {
  if (!event) return 'Operation executed successfully';

  const actorStr = event.actor?.name
    ? `${event.actor.name} (${event.actor.role || 'Admin'})`
    : 'System Administrator';

  if (userDetails) {
    const targetStr = userDetails.name
      ? `${userDetails.name} (ID: ${userDetails.id})`
      : `User ${userDetails.id}`;

    if (userDetails.isDelete) {
      return `User account ${targetStr} was deleted from active service and moved to the Trash User directory by ${actorStr}. Access credentials, role authorizations, and live sessions have been revoked.`;
    }

    if (userDetails.isCreate) {
      const roleStr = userDetails.role ? ` with assigned role '${userDetails.role}'` : '';
      const plazaStr = userDetails.plaza && userDetails.plaza !== 'All plazas' ? ` for ${userDetails.plaza}` : '';
      return `New user account was provisioned for ${targetStr}${roleStr}${plazaStr} by ${actorStr}.`;
    }

    if (userDetails.isApprove) {
      return `User onboarding request for ${targetStr} was reviewed and approved by ${actorStr}.`;
    }

    if (userDetails.isLock) {
      return `Security lock status for ${targetStr} was toggled by ${actorStr}.`;
    }

    const actionText = event.actionLabel || event.action || 'profile update';
    return `Administrative action '${actionText}' was performed on ${targetStr} by ${actorStr}.`;
  }

  if (event.details && event.details !== 'Operation executed successfully') {
    return event.details;
  }

  return `${event.actionLabel || event.action || 'Administrative action'} was executed successfully in ${event.module || 'System'} by ${actorStr}.`;
};

export default {
  resolveTargetUser,
  getEventNarrative,
};
