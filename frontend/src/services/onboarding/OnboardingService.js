/**
 * OnboardingService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Handles all Railway API calls for the Plaza Onboarding module.
 *
 * Pattern (same as UserService):
 *   1. Try Railway backend first.
 *   2. On success → also update localStorage as a read-cache.
 *   3. On failure (network / Railway down) → fall back to localStorage only.
 *   4. Every write operation also calls UserActivityService.recordAuditEvent()
 *      so the action appears in the User Activity & Audit page.
 */

import httpClient from '../api/httpClient';
import UserActivityService from '../userActivity/UserActivityService';

const STORAGE_KEY = 'paysonic_onboarding_data_v2';

// ─── Local storage helpers ────────────────────────────────────────────────────

const getLocalStore = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
};

const saveLocalStore = (store) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {}
};

// ─── Actor helper (active logged-in user) ────────────────────────────────────

const getActor = () => {
  try {
    const session = JSON.parse(localStorage.getItem('paysonic_auth_session') || 'null');
    if (session && session.name) {
      return {
        id: session.id || 'PSN0001',
        name: session.name,
        role: session.role || 'Admin',
        ipAddress: '127.0.0.1',
      };
    }
  } catch {}
  return { id: 'PSN0001', name: 'System Admin', role: 'Admin', ipAddress: '127.0.0.1' };
};

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE CLASS
// ─────────────────────────────────────────────────────────────────────────────

class OnboardingService {
  // ============================================================
  // READ — Plazas
  // ============================================================

  /**
   * Load all plazas.
   * Tries Railway GET /api/plazas → merges with localStorage seed data as fallback.
   */
  async getPlazas() {
    const local = getLocalStore();
    const localPlazas = local?.plazas || [];

    try {
      const res = await httpClient.get('/api/plazas');
      if (res && res.data && Array.isArray(res.data) && res.data.length > 0) {
        // Merge: Railway is source of truth, but keep any local-only plazas not yet pushed
        const railwayIds = new Set(res.data.map((p) => String(p.id)));
        const localOnly = localPlazas.filter((p) => !railwayIds.has(String(p.id)));
        const merged = [...res.data, ...localOnly];

        // Normalise field names from Railway schema → frontend schema
        const normalised = merged.map((p) => ({
          id: String(p.id || p.plazaId || ''),
          name: p.name || p.plazaName || '',
          orgId: p.orgId || p.org_id || '',
          agencyId: p.agencyId || p.agency_id || '',
          concessionaireId: String(p.concessionaireId || p.concessionaire_id || ''),
          publicKey: p.publicKey || p.public_key || '',
          category: p.category || 'Toll',
          basePricing: p.basePricing || p.base_pricing || 'Distance Based',
          plazaInterface: p.plazaInterface || p.plaza_interface || 'API',
          subtype: p.subtype || 'National',
          authority: p.authority || 'NHAI',
          schemeRule: p.schemeRule || p.scheme_rule || 'Single Return',
          schemeDuration: p.schemeDuration || p.scheme_duration || '24 Hrs',
          status: p.status || 'Draft',
          state: p.state || '',
          city: p.city || '',
          activationDate: p.activationDate || p.activation_date || '',
          geoCode: p.geoCode || p.geo_code || '',
          contactAddress: p.contactAddress || p.contact_address || '',
          contactNo: p.contactNo || p.contact_no || '',
          contactMail: p.contactMail || p.contact_mail || '',
          mdr: p.mdr || {
            bankFee: p.bankFee || p.bank_fee || '0.90',
            npciFee: p.npciFee || p.npci_fee || '0.15',
            bankGst: p.bankGst || p.bank_gst || '18',
            npciGst: p.npciGst || p.npci_gst || '18',
          },
        }));

        // Update localStorage cache
        if (local) {
          saveLocalStore({ ...local, plazas: normalised });
        }

        return normalised;
      }
    } catch (err) {
      console.warn('[OnboardingService] Railway GET /api/plazas unreachable, using localStorage:', err?.message);
    }

    return localPlazas;
  }

  // ============================================================
  // READ — Concessionaires
  // ============================================================

  /**
   * Load all concessionaires.
   * Tries Railway GET /api/concessionaires → falls back to localStorage.
   */
  async getConcessionaires() {
    const local = getLocalStore();
    const localConcess = local?.concessionaires || [];

    try {
      const res = await httpClient.get('/api/concessionaires');
      if (res && res.data && Array.isArray(res.data) && res.data.length > 0) {
        const railwayIds = new Set(res.data.map((c) => String(c.id)));
        const localOnly = localConcess.filter((c) => !railwayIds.has(String(c.id)));
        const merged = [...res.data, ...localOnly];

        const normalised = merged.map((c) => ({
          id: String(c.id || ''),
          name: c.name || '',
          address: c.address || '',
          mail: c.mail || c.email || '',
          contact: c.contact || c.mobile || c.phone || '',
        }));

        if (local) {
          saveLocalStore({ ...local, concessionaires: normalised });
        }

        return normalised;
      }
    } catch (err) {
      console.warn('[OnboardingService] Railway GET /api/concessionaires unreachable, using localStorage:', err?.message);
    }

    return localConcess;
  }

  // ============================================================
  // WRITE — Save / Update Plaza
  // ============================================================

  /**
   * Create or update a plaza.
   * POST /api/plazas (create) or PUT /api/plazas/:id (update).
   * Falls back to localStorage only if Railway is unavailable.
   * Fires audit event in both cases.
   */
  async savePlaza(plaza, { isEdit = false, actor: actorOverride } = {}) {
    const actor = actorOverride || getActor();
    const isUpdate = isEdit || Boolean(plaza._railwayId);
    const local = getLocalStore() || {};

    const payload = {
      plazaId: plaza.id,
      name: plaza.name,
      orgId: plaza.orgId,
      agencyId: plaza.agencyId,
      concessionaireId: plaza.concessionaireId,
      publicKey: plaza.publicKey || '',
      category: plaza.category,
      basePricing: plaza.basePricing,
      plazaInterface: plaza.plazaInterface,
      subtype: plaza.subtype,
      authority: plaza.authority,
      schemeRule: plaza.schemeRule,
      schemeDuration: plaza.schemeDuration,
      status: plaza.status,
      state: plaza.state,
      city: plaza.city,
      activationDate: plaza.activationDate,
      geoCode: plaza.geoCode || '',
      contactAddress: plaza.contactAddress || '',
      contactNo: plaza.contactNo || '',
      contactMail: plaza.contactMail || '',
      mdr: plaza.mdr || {},
    };

    let savedOnRailway = false;

    try {
      if (isUpdate) {
        await httpClient.put(`/api/plazas/${plaza.id}`, payload, {
          headers: { 'X-Actor-ID': actor.id },
        });
      } else {
        await httpClient.post('/api/plazas', payload, {
          headers: { 'X-Actor-ID': actor.id },
        });
      }
      savedOnRailway = true;
    } catch (err) {
      console.warn(`[OnboardingService] Railway ${isUpdate ? 'PUT' : 'POST'} /api/plazas failed, localStorage only:`, err?.message);
    }

    // Always update localStorage
    const existingPlazas = local.plazas || [];
    const idx = existingPlazas.findIndex((p) => p.id === plaza.id);
    let updatedPlazas;
    if (idx >= 0) {
      updatedPlazas = existingPlazas.map((p) => (p.id === plaza.id ? plaza : p));
    } else {
      updatedPlazas = [...existingPlazas, plaza];
    }
    saveLocalStore({ ...local, plazas: updatedPlazas });

    // Audit trail
    UserActivityService.recordAuditEvent({
      module: 'On Boarding',
      action: isUpdate ? 'UPDATE_PLAZA' : 'CREATE_PLAZA',
      actionLabel: isUpdate ? 'Updated Plaza Record' : 'Created New Plaza',
      status: 'SUCCESS',
      target: `${plaza.name} (${plaza.id})`,
      plaza: plaza.name,
      details: `Plaza ${plaza.name} (ID: ${plaza.id}) ${isUpdate ? 'updated' : 'created'}. Status: ${plaza.status}. Concessionaire: ${plaza.concessionaireId}. ${savedOnRailway ? 'Persisted to Railway.' : 'Saved to localStorage only (Railway offline).'}`,
      actor,
      before: isUpdate ? { id: plaza.id, name: plaza.name } : null,
      after: { id: plaza.id, name: plaza.name, status: plaza.status },
    });

    return { ...plaza, _savedOnRailway: savedOnRailway };
  }

  // ============================================================
  // WRITE — Save Concessionaire
  // ============================================================

  /**
   * Create a concessionaire.
   * POST /api/concessionaires
   * Falls back to localStorage only if Railway is unavailable.
   * Fires audit event in both cases.
   */
  async saveConcessionaire(concessionaire, { actor: actorOverride } = {}) {
    const actor = actorOverride || getActor();
    const local = getLocalStore() || {};

    const payload = {
      concessionaireId: concessionaire.id,
      name: concessionaire.name,
      address: concessionaire.address,
      mail: concessionaire.mail,
      contact: concessionaire.contact,
    };

    let savedOnRailway = false;

    try {
      await httpClient.post('/api/concessionaires', payload, {
        headers: { 'X-Actor-ID': actor.id },
      });
      savedOnRailway = true;
    } catch (err) {
      console.warn('[OnboardingService] Railway POST /api/concessionaires failed, localStorage only:', err?.message);
    }

    // Always update localStorage
    const existingConcess = local.concessionaires || [];
    const alreadyExists = existingConcess.some((c) => c.id === concessionaire.id);
    const updatedConcess = alreadyExists
      ? existingConcess.map((c) => (c.id === concessionaire.id ? concessionaire : c))
      : [...existingConcess, concessionaire];

    saveLocalStore({ ...local, concessionaires: updatedConcess });

    // Audit trail
    UserActivityService.recordAuditEvent({
      module: 'On Boarding',
      action: 'CREATE_CONCESSIONAIRE',
      actionLabel: 'Registered Concessionaire',
      status: 'SUCCESS',
      target: `${concessionaire.name} (${concessionaire.id})`,
      details: `Concessionaire ${concessionaire.name} registered with ID ${concessionaire.id}. Mail: ${concessionaire.mail}. ${savedOnRailway ? 'Persisted to Railway.' : 'Saved to localStorage only (Railway offline).'}`,
      actor,
      after: { id: concessionaire.id, name: concessionaire.name },
    });

    return { ...concessionaire, _savedOnRailway: savedOnRailway };
  }

  // ============================================================
  // WRITE — Save Lane
  // ============================================================

  async saveLane(lane, { actor: actorOverride } = {}) {
    const actor = actorOverride || getActor();
    const local = getLocalStore() || {};

    const payload = {
      plazaId: lane.plazaId,
      laneId: lane.laneId,
      direction: lane.direction,
      type: lane.type,
      mode: lane.mode,
      category: lane.category,
      status: lane.status,
    };

    let savedOnRailway = false;

    try {
      await httpClient.post('/api/plazas/lanes', payload, {
        headers: { 'X-Actor-ID': actor.id },
      });
      savedOnRailway = true;
    } catch (err) {
      console.warn('[OnboardingService] Railway POST /api/plazas/lanes failed, localStorage only:', err?.message);
    }

    // Update localStorage
    const updatedLanes = [...(local.lanes || []), lane];
    saveLocalStore({ ...local, lanes: updatedLanes });

    // Audit trail
    UserActivityService.recordAuditEvent({
      module: 'On Boarding',
      action: 'ADD_LANE',
      actionLabel: 'Added Lane to Plaza',
      status: 'SUCCESS',
      target: `Lane ${lane.laneId} → Plaza ${lane.plazaId}`,
      plaza: lane.plazaId,
      details: `Lane ${lane.laneId} added. Direction: ${lane.direction}, Type: ${lane.type}, Mode: ${lane.mode}, Category: ${lane.category}. ${savedOnRailway ? 'Persisted to Railway.' : 'Saved to localStorage only (Railway offline).'}`,
      actor,
      after: lane,
    });

    return { ...lane, _savedOnRailway: savedOnRailway };
  }

  // ============================================================
  // WRITE — Delete Lane
  // ============================================================

  async deleteLane(laneId, plazaId, { actor: actorOverride } = {}) {
    const actor = actorOverride || getActor();
    const local = getLocalStore() || {};

    let savedOnRailway = false;

    try {
      await httpClient.delete(`/api/plazas/lanes/${laneId}`, {
        headers: { 'X-Actor-ID': actor.id },
      });
      savedOnRailway = true;
    } catch (err) {
      console.warn('[OnboardingService] Railway DELETE /api/plazas/lanes failed, localStorage only:', err?.message);
    }

    // Update localStorage
    const updatedLanes = (local.lanes || []).filter((l) => l.laneId !== laneId);
    saveLocalStore({ ...local, lanes: updatedLanes });

    // Audit trail
    UserActivityService.recordAuditEvent({
      module: 'On Boarding',
      action: 'REMOVE_LANE',
      actionLabel: 'Removed Lane from Plaza',
      status: 'SUCCESS',
      target: `Lane ${laneId} (Plaza ${plazaId})`,
      plaza: plazaId,
      details: `Lane ${laneId} removed from Plaza ${plazaId}. ${savedOnRailway ? 'Deleted from Railway.' : 'Removed from localStorage only (Railway offline).'}`,
      actor,
      before: laneId,
    });

    return { success: true, _savedOnRailway: savedOnRailway };
  }

  // ============================================================
  // WRITE — Save Callback URLs
  // ============================================================

  async saveCallbacks(plazaId, callbackUrls, { actor: actorOverride } = {}) {
    const actor = actorOverride || getActor();
    const local = getLocalStore() || {};

    let savedOnRailway = false;

    try {
      await httpClient.put(`/api/plazas/${plazaId}/callbacks`, { callbacks: callbackUrls }, {
        headers: { 'X-Actor-ID': actor.id },
      });
      savedOnRailway = true;
    } catch (err) {
      console.warn('[OnboardingService] Railway PUT /api/plazas/callbacks failed, localStorage only:', err?.message);
    }

    // Update localStorage
    const updatedCallbacks = { ...local.callbacks, [plazaId]: callbackUrls };
    saveLocalStore({ ...local, callbacks: updatedCallbacks });

    // Audit trail
    const configuredCount = Object.values(callbackUrls).filter((v) => v && v.trim()).length;
    UserActivityService.recordAuditEvent({
      module: 'On Boarding',
      action: 'SAVE_CALLBACKS',
      actionLabel: 'Updated Callback URL Configuration',
      status: 'SUCCESS',
      target: `Plaza ${plazaId} · ${configuredCount}/14 Endpoints Configured`,
      plaza: plazaId,
      details: `Saved ${configuredCount} of 14 callback webhook URLs for Plaza ${plazaId}. ${savedOnRailway ? 'Persisted to Railway.' : 'Saved to localStorage only (Railway offline).'}`,
      actor,
    });

    return { success: true, _savedOnRailway: savedOnRailway };
  }

  // ============================================================
  // WRITE — Save Fare Mapping
  // ============================================================

  async saveFares(plazaId, fares, { actor: actorOverride } = {}) {
    const actor = actorOverride || getActor();
    const local = getLocalStore() || {};

    let savedOnRailway = false;

    try {
      await httpClient.put(`/api/plazas/${plazaId}/fares`, { fares }, {
        headers: { 'X-Actor-ID': actor.id },
      });
      savedOnRailway = true;
    } catch (err) {
      console.warn('[OnboardingService] Railway PUT /api/plazas/fares failed, localStorage only:', err?.message);
    }

    // Update localStorage
    const updatedFares = { ...local.fares, [plazaId]: fares };
    saveLocalStore({ ...local, fares: updatedFares });

    // Audit trail
    UserActivityService.recordAuditEvent({
      module: 'On Boarding',
      action: 'SAVE_FARE_MAPPING',
      actionLabel: 'Updated Toll Fare Matrix',
      status: 'SUCCESS',
      target: `Plaza ${plazaId} · 17 Vehicle Classes × 6 Journey Types`,
      plaza: plazaId,
      details: `Fare mapping saved for Plaza ${plazaId} covering VC4–VC20 across 6 journey types (Single, Return, Local 10km, Local 20km, District Commercial, Monthly Pass). ${savedOnRailway ? 'Persisted to Railway.' : 'Saved to localStorage only (Railway offline).'}`,
      actor,
    });

    return { success: true, _savedOnRailway: savedOnRailway };
  }

  // ============================================================
  // WRITE — Save CCH Mapping
  // ============================================================

  async saveCch(plazaId, cch, { actor: actorOverride } = {}) {
    const actor = actorOverride || getActor();
    const local = getLocalStore() || {};

    let savedOnRailway = false;

    try {
      await httpClient.put(`/api/plazas/${plazaId}/cch`, { cch }, {
        headers: { 'X-Actor-ID': actor.id },
      });
      savedOnRailway = true;
    } catch (err) {
      console.warn('[OnboardingService] Railway PUT /api/plazas/cch failed, localStorage only:', err?.message);
    }

    // Update localStorage
    const updatedCch = { ...local.cch, [plazaId]: cch };
    saveLocalStore({ ...local, cch: updatedCch });

    // Audit trail
    const changedCount = Object.values(cch).filter((v) => v && v.current !== undefined).length;
    UserActivityService.recordAuditEvent({
      module: 'On Boarding',
      action: 'SAVE_CCH_MAPPING',
      actionLabel: 'Applied CCH Rate Update',
      status: 'SUCCESS',
      target: `Plaza ${plazaId} · ${changedCount} Vehicle Classes Updated`,
      plaza: plazaId,
      details: `CCH mapping applied for Plaza ${plazaId}. New CCH rates applied across vehicle classes VC4–VC20. ${savedOnRailway ? 'Persisted to Railway.' : 'Saved to localStorage only (Railway offline).'}`,
      actor,
    });

    return { success: true, _savedOnRailway: savedOnRailway };
  }

  // ============================================================
  // AUDIT — View events (read-only helper for completeness)
  // ============================================================

  /**
   * Synchronously retrieve current onboarded plaza names from local store/cache.
   * Enables dynamic sync with User Management plaza dropdown and other views.
   */
  getPlazaNames() {
    const local = getLocalStore();
    if (local?.plazas && Array.isArray(local.plazas)) {
      return local.plazas.map((p) => p.name || p.id).filter(Boolean);
    }
    return [];
  }

  /**
   * Load full onboarding store from Railway / Backend Database.
   * Called once on component mount to hydrate all tabs with real DB data.
   */
  async loadFullStore(localFallback) {
    try {
      const res = await httpClient.get('/api/onboarding/all');
      if (res?.data && res.data.plazas && res.data.plazas.length > 0) {
        const backendStore = {
          concessionaires: res.data.concessionaires || [],
          plazas: res.data.plazas || [],
          lanes: res.data.lanes || [],
          callbacks: res.data.callbacks || {},
          fares: res.data.fares || {},
          cch: res.data.cch || {},
          source: 'LIVE_BACKEND_DB',
          _liveDb: true,
        };
        saveLocalStore(backendStore);
        return backendStore;
      }
    } catch (err) {
      console.warn('[OnboardingService] GET /api/onboarding/all unreachable, trying individual endpoints:', err?.message);
    }

    const [plazas, concessionaires] = await Promise.all([
      this.getPlazas().catch(() => localFallback?.plazas || []),
      this.getConcessionaires().catch(() => localFallback?.concessionaires || []),
    ]);

    return {
      ...localFallback,
      plazas,
      concessionaires,
    };
  }
}

export default new OnboardingService();
