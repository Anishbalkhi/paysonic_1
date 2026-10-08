import { useState, useEffect, useCallback, useMemo } from 'react';
import OnboardingService from '../services/onboarding/OnboardingService';
import { useAuth } from '../context/AuthContext';
import { getScopedPlazas, isUserPlazaLocked, getInitialPlazaScope } from '../utils/plazaScopeUtils';

/**
  * useOnboardedPlazas
  * ─────────────────────────────────────────────────────────────
  * Provides a reactive, real-time list of plazas scoped to the logged-in user.
  * - Master Admin / Admin / Bank: sees all plazas (isPlazaLocked = false, defaultPlazaId = 'ALL')
  * - Concessionaire: sees plazas in their portfolio (isPlazaLocked = false, defaultPlazaId = 'ALL')
  * - Plaza Admin (e.g. Pune Bypass): locked to their assigned plaza (isPlazaLocked = true, defaultPlazaId = assignedPlazaId)
  */
export const useOnboardedPlazas = () => {
  const { currentUser } = useAuth();
  const [plazas, setPlazas] = useState(() => {
    return OnboardingService.getCachedPlazas() || [];
  });
  const [loading, setLoading] = useState(plazas.length === 0);

  const fetchLivePlazas = useCallback(async () => {
    try {
      const live = await OnboardingService.getPlazas();
      if (Array.isArray(live)) {
        setPlazas(live);
      }
    } catch (err) {
      console.warn('[useOnboardedPlazas] Failed to fetch live plazas:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    fetchLivePlazas();

    const handlePlazasUpdated = (event) => {
      if (!isMounted) return;
      if (event?.detail?.plazas && Array.isArray(event.detail.plazas)) {
        setPlazas(event.detail.plazas);
      } else {
        fetchLivePlazas();
      }
    };

    window.addEventListener('paysonic:plazas_updated', handlePlazasUpdated);
    window.addEventListener('storage', handlePlazasUpdated);

    return () => {
      isMounted = false;
      window.removeEventListener('paysonic:plazas_updated', handlePlazasUpdated);
      window.removeEventListener('storage', handlePlazasUpdated);
    };
  }, [fetchLivePlazas]);

  // Formatted plazas with display labels: "NAME (ID)" and "ID - NAME"
  const formattedAllPlazas = useMemo(() => {
    return (plazas || []).map((p) => {
      const idStr = String(p.id || '').trim();
      const nameStr = (p.name || `Plaza ${idStr}`).trim();
      return {
        ...p,
        id: idStr,
        name: nameStr,
        label: `${nameStr} (${idStr})`,
        codeLabel: `${idStr} - ${nameStr}`,
      };
    });
  }, [plazas]);

  // Scoped Plazas strictly filtered by user's organizational boundary
  const scopedPlazas = useMemo(() => {
    return getScopedPlazas(formattedAllPlazas, currentUser);
  }, [formattedAllPlazas, currentUser]);

  const isPlazaLocked = useMemo(() => {
    return isUserPlazaLocked(currentUser);
  }, [currentUser]);

  const defaultPlazaId = useMemo(() => {
    return getInitialPlazaScope(scopedPlazas, currentUser);
  }, [scopedPlazas, currentUser]);

  const assignedPlaza = useMemo(() => {
    if (isPlazaLocked && scopedPlazas.length > 0) {
      return scopedPlazas[0];
    }
    return null;
  }, [isPlazaLocked, scopedPlazas]);

  const getPlazaLabel = useCallback(
    (plazaId) => {
      if (!plazaId || plazaId === 'ALL') {
        if (isPlazaLocked && scopedPlazas.length === 1) {
          return scopedPlazas[0].label;
        }
        return currentUser?.role === 'Concessionaire' ? 'All Portfolio Plazas' : 'All Plazas';
      }
      const found = formattedAllPlazas.find((p) => String(p.id) === String(plazaId));
      return found ? found.label : `Plaza ${plazaId}`;
    },
    [formattedAllPlazas, isPlazaLocked, scopedPlazas, currentUser]
  );

  return {
    plazas: scopedPlazas,
    allPlazas: formattedAllPlazas,
    rawPlazas: plazas,
    isPlazaLocked,
    defaultPlazaId,
    assignedPlaza,
    loading,
    refresh: fetchLivePlazas,
    getPlazaLabel,
  };
};

export default useOnboardedPlazas;

