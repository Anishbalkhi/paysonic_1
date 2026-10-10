/**
 * plazaScopeUtils.js
 * ─────────────────────────────────────────────────────────────
 * Centralized Multi-Tenant Data Segregation & Scoping Engine
 * 
 * Rules:
 * 1. Master Admin / Admin / Bank:
 *    - Global access across all plazas.
 *    - isPlazaLocked = false, defaultPlazaId = 'ALL'.
 * 
 * 2. Concessionaire:
 *    - Portfolio access across all plazas assigned to this Concessionaire.
 *    - isPlazaLocked = false, defaultPlazaId = 'ALL' (meaning all of their plazas).
 * 
 * 3. Plaza Admin / Plaza POS / Lane Operator (e.g. Pune Bypass):
 *    - Strict single-plaza access locked to their assigned plaza.
 *    - isPlazaLocked = true, defaultPlazaId = assignedPlazaId.
 */

/**
 * Normalizes a string for robust fuzzy/slug matching
 */
export function normalizePlazaSlug(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Checks if a plaza matches an identifier (ID, Name, or Slug)
 */
export function isPlazaMatch(plaza, identifier) {
  if (!plaza || !identifier) return false;

  const idStr = String(plaza.id || '').trim().toLowerCase();
  const nameStr = String(plaza.name || '').trim().toLowerCase();
  const identStr = String(identifier).trim().toLowerCase();

  // Direct match by ID or exact name
  if (idStr === identStr || nameStr === identStr) return true;

  // Extract ID enclosed in brackets [502202] or parentheses (502202)
  const bracketMatch = identStr.match(/\[(\d+)\]/) || identStr.match(/\((\d+)\)/);
  if (bracketMatch && idStr === bracketMatch[1].toLowerCase()) return true;

  // Slug / clean match
  const plazaSlug = normalizePlazaSlug(plaza.name || plaza.id);
  const identSlug = normalizePlazaSlug(identifier);

  if (plazaSlug && identSlug) {
    if (plazaSlug === identSlug) return true;
    if (plazaSlug.includes(identSlug) || identSlug.includes(plazaSlug)) return true;
  }

  return false;
}

/**
 * Filters a list of plazas according to the current user's role and scope
 * 
 * @param {Array} allPlazas - List of all onboarded plaza objects
 * @param {Object} currentUser - Active user session from AuthContext
 * @returns {Array} - Filtered list of plazas visible to this user
 */
export function getScopedPlazas(allPlazas = [], currentUser = null) {
  if (!Array.isArray(allPlazas)) return [];
  if (!currentUser || !currentUser.role) return allPlazas;

  const role = currentUser.role;

  // 1. Master Admin, Admin, and Bank have full global scope
  if (role === 'Master Admin' || role === 'Admin' || role === 'Bank') {
    return allPlazas;
  }

  // 2. Concessionaire: sees all plazas belonging to their portfolio
  if (role === 'Concessionaire') {
    const userPlazasList = Array.isArray(currentUser.plazas) && currentUser.plazas.length > 0
      ? currentUser.plazas
      : (currentUser.assignedPlaza || currentUser.plaza || '')
          .split(/[,;\n]/)
          .map((s) => s.trim())
          .filter(Boolean);

    if (userPlazasList.length === 0 || userPlazasList.some((p) => /all plazas/i.test(p))) {
      return allPlazas;
    }

    const matched = allPlazas.filter((p) => {
      // Match by concessionaire ID / Name if available
      if (currentUser.concessionaireId && p.concessionaireId && String(p.concessionaireId) === String(currentUser.concessionaireId)) {
        return true;
      }
      if (currentUser.concessionaireName && (p.concessionaireName || p.concessionaire)) {
        const cName = String(p.concessionaireName || p.concessionaire).toLowerCase();
        if (cName.includes(String(currentUser.concessionaireName).toLowerCase())) return true;
      }
      // Match against assigned plazas list
      return userPlazasList.some((assigned) => isPlazaMatch(p, assigned));
    });

    if (matched.length > 0) {
      return matched;
    }

    // Secure fallback: Generate synthetic objects for assigned plazas rather than leaking allPlazas
    return userPlazasList.map((assigned, idx) => {
      const cleanName = assigned.replace(/\s*\[\d+\]$/, '').replace(/\s*\(\d+\)$/, '').trim().toUpperCase();
      const idMatch = assigned.match(/\[(\d+)\]/) || assigned.match(/\((\d+)\)/);
      const fallbackId = idMatch ? idMatch[1] : `90000${idx + 1}`;
      return {
        id: fallbackId,
        name: cleanName,
        label: `${cleanName} (${fallbackId})`,
        codeLabel: `${fallbackId} - ${cleanName}`,
        status: 'Active',
        _isFallback: true,
      };
    });
  }

  // 3. Plaza Admin / Plaza POS / Lane Operator / Cashier: strictly single assigned plaza
  const assigned = (
    currentUser.assignedPlaza ||
    currentUser.plaza ||
    (Array.isArray(currentUser.plazas) && currentUser.plazas[0]) ||
    ''
  ).trim();

  if (!assigned || /all plazas/i.test(assigned)) {
    return allPlazas;
  }

  const matched = allPlazas.filter((p) => isPlazaMatch(p, assigned));

  if (matched.length > 0) {
    return matched;
  }

  // Fallback if not yet loaded from DB: create a synthetic plaza record so UI doesn't crash
  const cleanName = assigned.replace(/\s*\[\d+\]$/, '').replace(/\s*\(\d+\)$/, '').trim().toUpperCase();
  const idMatch = assigned.match(/\[(\d+)\]/) || assigned.match(/\((\d+)\)/);
  let fallbackId = idMatch ? idMatch[1] : currentUser.assignedPlazaId;
  if (!fallbackId) {
    if (/mumbai/i.test(assigned)) fallbackId = '501101';
    else if (/solapur/i.test(assigned)) fallbackId = '505505';
    else if (/pune/i.test(assigned)) fallbackId = '502202';
    else if (/nashik/i.test(assigned)) fallbackId = '503303';
    else if (/kolhapur/i.test(assigned)) fallbackId = '504404';
    else fallbackId = '101001';
  }

  return [
    {
      id: String(fallbackId),
      name: cleanName,
      label: `${cleanName} (${fallbackId})`,
      codeLabel: `${fallbackId} - ${cleanName}`,
      status: 'Active',
      _isFallback: true,
    },
  ];
}

/**
 * Returns whether plaza selection is locked for this user
 */
export function isUserPlazaLocked(currentUser) {
  if (!currentUser || !currentUser.role) return false;
  const singlePlazaRoles = [
    'Plaza Admin',
    'Plaza POS',
    'Request Tag Details',
    'Cashier',
    'Lane POS',
    'Support Operator'
  ];
  return singlePlazaRoles.includes(currentUser.role);
}

/**
 * Returns the default plazaId to initialize dropdowns with
 */
export function getInitialPlazaScope(scopedPlazas = [], currentUser = null) {
  const isLocked = isUserPlazaLocked(currentUser);
  if (isLocked) {
    if (Array.isArray(scopedPlazas) && scopedPlazas.length > 0 && scopedPlazas[0]?.id) {
      return scopedPlazas[0].id;
    }
    const assigned = (currentUser?.assignedPlaza || currentUser?.plaza || '').trim();
    const idMatch = assigned.match(/\((\d+)\)/);
    if (idMatch) return idMatch[1];
    if (currentUser?.assignedPlazaId) return String(currentUser.assignedPlazaId);
    if (currentUser?.plazaId) return String(currentUser.plazaId);
    if (/mumbai/i.test(assigned)) return '501101';
    if (/solapur/i.test(assigned)) return '505505';
    if (/pune/i.test(assigned)) return '502202';
    if (/nashik/i.test(assigned)) return '503303';
    if (/kolhapur/i.test(assigned)) return '504404';
  }
  return 'ALL';
}

/**
 * Safely filters an array of records according to user role and scoped plazas
 */
export function filterRecordsByPlazaScope(records = [], scopedPlazas = [], currentUser = null, getPlazaIdFn = null) {
  if (!Array.isArray(records) || records.length === 0) return [];
  if (!currentUser || !currentUser.role) return records;

  const role = currentUser.role;
  // Master Admin, Admin, Bank see everything
  if (role === 'Master Admin' || role === 'Admin' || role === 'Bank') {
    return records;
  }

  // If no scoped plazas are available, return empty rather than leaking un-scoped data
  if (!Array.isArray(scopedPlazas) || scopedPlazas.length === 0) {
    return [];
  }

  // Build lookup sets and matching logic for scoped plazas
  const allowedIds = new Set(scopedPlazas.map((p) => String(p.id || '').trim().toLowerCase()).filter(Boolean));

  return records.filter((rec) => {
    if (!rec) return false;
    let recId = '';
    let recName = '';

    if (typeof getPlazaIdFn === 'function') {
      const extracted = getPlazaIdFn(rec);
      if (typeof extracted === 'object' && extracted !== null) {
        recId = String(extracted.id || extracted.plazaId || '').trim().toLowerCase();
        recName = String(extracted.name || extracted.plazaName || '').trim();
      } else {
        recId = String(extracted || '').trim().toLowerCase();
      }
    } else {
      recId = String(rec.plazaId || rec.tollPlazaId || rec.id || rec.plazaCode || '').trim().toLowerCase();
      recName = String(rec.plazaName || rec.tollPlazaName || rec.name || '').trim();
    }

    // Direct ID match
    if (recId && allowedIds.has(recId)) return true;

    // Fuzzy match against any scoped plaza
    return scopedPlazas.some((sp) => {
      if (recId && String(sp.id).toLowerCase() === recId) return true;
      if (recName && isPlazaMatch(sp, recName)) return true;
      if (recId && isPlazaMatch(sp, recId)) return true;
      return false;
    });
  });
}
