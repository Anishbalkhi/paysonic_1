/**
 * plazaNormalizer.js
 * ─────────────────────────────────────────────────────────────
 * Ensures that ANY legacy or dummy plaza references (such as
 * Dummytollplaza1, Autumn, Gluten, or ids 600601, 600602, 666666, 778899)
 * are cleanly detected and replaced with the real onboarded plazas
 * created by the user and operational in the system.
 */

import OnboardingService from '../services/onboarding/OnboardingService';

const DUMMY_IDS = new Set(['600601', '600602', '666666', '778899', '778999']);
const DUMMY_NAME_REGEX = /dummy|autumn|gluten/i;

/**
 * Checks if a given plaza ID or Name represents dummy test data
 */
export const isDummyPlaza = (id, name) => {
  const idStr = String(id || '').trim();
  const nameStr = String(name || '').trim();

  if (DUMMY_IDS.has(idStr)) return true;
  if (!nameStr) return false;
  return DUMMY_NAME_REGEX.test(nameStr);
};

/**
 * Normalizes a single plaza pair into a real onboarded plaza
 */
export const normalizePlaza = (id, name, onboardedPlazas = []) => {
  const idStr = String(id || '').trim();
  const nameStr = String(name || '').trim();

  // Get active pool from provided list or cached OnboardingService store
  const pool = Array.isArray(onboardedPlazas) && onboardedPlazas.length > 0
    ? onboardedPlazas
    : (OnboardingService.getCachedPlazas() || []);

  const realPlazas = pool.filter((p) => {
    const pId = String(p.id || p.plazaId || '').trim();
    const pName = String(p.name || p.plazaName || '').trim();
    return pId && !isDummyPlaza(pId, pName);
  });

  // 1. Direct match by ID if ID is valid
  if (idStr && !DUMMY_IDS.has(idStr)) {
    const match = realPlazas.find((p) => String(p.id || p.plazaId).trim() === idStr);
    if (match) {
      return {
        plazaId: idStr,
        plazaName: match.name || match.plazaName || (isDummyPlaza(idStr, nameStr) ? 'MUMBAI PLAZA NH-04' : nameStr)
      };
    }
    // If not in cache but has valid real name
    if (nameStr && !isDummyPlaza(idStr, nameStr)) {
      return { plazaId: idStr, plazaName: nameStr };
    }
  }

  // 2. Direct match by Name if Name is valid
  if (nameStr && !isDummyPlaza(idStr, nameStr)) {
    const matchByName = realPlazas.find((p) => (p.name || p.plazaName || '').trim().toLowerCase() === nameStr.toLowerCase());
    if (matchByName) {
      return {
        plazaId: String(matchByName.id || matchByName.plazaId).trim(),
        plazaName: matchByName.name || matchByName.plazaName || nameStr
      };
    }
  }

  // 3. Fallback to first available real user/onboarded plaza
  if (realPlazas.length > 0) {
    const fallback = realPlazas[0];
    return {
      plazaId: String(fallback.id || fallback.plazaId).trim(),
      plazaName: fallback.name || fallback.plazaName || 'MUMBAI PLAZA NH-04'
    };
  }

  return { plazaId: '501101', plazaName: 'MUMBAI PLAZA NH-04' };
};

/**
 * Normalizes plaza for a table record, distributing legacy rows across
 * genuine real plazas if multiple exist in the system.
 */
export const normalizePlazaForRecord = (record, idx = 0, onboardedPlazas = []) => {
  if (!record) return { plazaId: '501101', plazaName: 'MUMBAI PLAZA NH-04' };

  const idStr = String(record.plazaId || record.tollPlazaId || record.plazaCode || '').trim();
  const nameStr = String(record.plazaName || record.tollPlazaName || '').trim();

  const pool = Array.isArray(onboardedPlazas) && onboardedPlazas.length > 0
    ? onboardedPlazas
    : (OnboardingService.getCachedPlazas() || []);

  const realPlazas = pool.filter((p) => {
    const pId = String(p.id || p.plazaId || '').trim();
    const pName = String(p.name || p.plazaName || '').trim();
    return pId && !isDummyPlaza(pId, pName);
  });

  // If already mapped to a real plaza ID
  if (idStr && !DUMMY_IDS.has(idStr)) {
    const match = realPlazas.find((p) => String(p.id || p.plazaId).trim() === idStr);
    if (match) {
      return {
        plazaId: idStr,
        plazaName: match.name || match.plazaName || (isDummyPlaza(idStr, nameStr) ? 'MUMBAI PLAZA NH-04' : nameStr)
      };
    }
    if (nameStr && !isDummyPlaza(idStr, nameStr)) {
      return { plazaId: idStr, plazaName: nameStr };
    }
  }

  // If dummy or unknown, distribute deterministically across real plazas
  if (realPlazas.length > 0) {
    const target = realPlazas[idx % realPlazas.length];
    return {
      plazaId: String(target.id || target.plazaId).trim(),
      plazaName: target.name || target.plazaName || 'MUMBAI PLAZA NH-04'
    };
  }

  return { plazaId: '501101', plazaName: 'MUMBAI PLAZA NH-04' };
};
