import { useState, useEffect, useCallback, useMemo } from 'react';
import OnboardingService from '../services/onboarding/OnboardingService';

/**
  * useOnboardedPlazas
  * ─────────────────────────────────────────────────────────────
  * Provides a reactive, real-time list of all plazas onboarded in the system.
  * - Automatically updates when a new plaza is onboarded.
  * - Automatically removes deleted plazas in real time.
  * - Synced across all pages and modules via window events and storage.
  */
export const useOnboardedPlazas = () => {
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
  const formattedPlazas = useMemo(() => {
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

  const getPlazaLabel = useCallback(
    (plazaId) => {
      if (!plazaId || plazaId === 'ALL') return 'All Plazas';
      const found = formattedPlazas.find((p) => String(p.id) === String(plazaId));
      return found ? found.label : `Plaza ${plazaId}`;
    },
    [formattedPlazas]
  );

  return {
    plazas: formattedPlazas,
    rawPlazas: plazas,
    loading,
    refresh: fetchLivePlazas,
    getPlazaLabel,
  };
};

export default useOnboardedPlazas;
