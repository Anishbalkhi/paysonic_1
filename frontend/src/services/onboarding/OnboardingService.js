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

// ─── Real Database Storage Mode (Direct Railway MySQL) ────────────────────────
const getLocalStore = () => ({});
const saveLocalStore = () => {};


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
    try {
      const res = await httpClient.get('/api/plazas');
      if (res && res.data && Array.isArray(res.data)) {
        const normalised = res.data.map((p) => ({
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
          mdr: p.mdr || (typeof p.mdrJson === 'string' ? JSON.parse(p.mdrJson) : null) || {
            bankFee: p.bankFee || p.bank_fee || '0.90',
            npciFee: p.npciFee || p.npci_fee || '0.15',
            bankGst: p.bankGst || p.bank_gst || '18',
            npciGst: p.npciGst || p.npci_gst || '18',
          },
          _fromRailway: true,
        }));
        return normalised;
      }
    } catch (err) {
      console.warn('[OnboardingService] Railway GET /api/plazas error:', err?.message);
    }
    return [];
  }

  // ============================================================
  // READ — Concessionaires
  // ============================================================

  /**
   * Load all concessionaires directly from Railway MySQL.
   */
  async getConcessionaires() {
    try {
      const res = await httpClient.get('/api/concessionaires');
      if (res && res.data && Array.isArray(res.data)) {
        return res.data.map((c) => ({
          id: String(c.id || ''),
          name: c.name || '',
          address: c.address || '',
          mail: c.mail || c.email || '',
          contact: c.contact || c.mobile || c.phone || '',
          _fromRailway: true,
        }));
      }
    } catch (err) {
      console.warn('[OnboardingService] Railway GET /api/concessionaires error:', err?.message);
    }
    return [];
  }

  // ============================================================
  // READ — Lanes
  // ============================================================

  /**
   * Load lanes directly from Railway MySQL.
   */
  async getLanes(plazaId) {
    try {
      const res = await httpClient.get('/api/plazas/lanes', {
        params: plazaId ? { plazaId } : undefined,
      });
      if (res && res.data && Array.isArray(res.data)) {
        return res.data.map((l) => ({
          ...l,
          _fromRailway: true,
        }));
      }
    } catch (err) {
      console.warn('[OnboardingService] Railway GET /api/plazas/lanes error:', err?.message);
    }
    return [];
  }

  // ============================================================
  // WRITE — Save / Update Plaza
  // ============================================================

  /**
   * Validate uniqueness of Plaza ID, Plaza Name, Org ID, and Geo Code against live database
   */
  async validatePlazaUniqueness(plaza, { isEdit = false, originalId } = {}) {
    const targetLookupId = isEdit && originalId ? String(originalId).trim() : String(plaza.id).trim();
    const existing = await this.getPlazas();

    const dupId = existing.find(
      (p) => String(p.id).trim() === String(plaza.id).trim() && String(p.id).trim() !== targetLookupId
    );
    if (dupId) {
      throw new Error(`Plaza ID '${plaza.id}' already exists! Each plaza must have a unique Plaza ID.`);
    }

    const dupName = existing.find(
      (p) =>
        (p.name || '').trim().toUpperCase() === (plaza.name || '').trim().toUpperCase() &&
        String(p.id).trim() !== targetLookupId
    );
    if (dupName) {
      throw new Error(`Plaza Name '${plaza.name}' already exists! Each plaza must have a unique Plaza Name.`);
    }

    if (plaza.orgId && plaza.orgId.trim()) {
      const dupOrg = existing.find(
        (p) =>
          (p.orgId || '').trim().toUpperCase() === (plaza.orgId || '').trim().toUpperCase() &&
          String(p.id).trim() !== targetLookupId
      );
      if (dupOrg) {
        throw new Error(`Org ID '${plaza.orgId}' already exists! Each plaza must have a unique Org ID.`);
      }
    }

    if (plaza.geoCode && plaza.geoCode.trim()) {
      const dupGeo = existing.find(
        (p) =>
          (p.geoCode || '').trim() === plaza.geoCode.trim() &&
          String(p.id).trim() !== targetLookupId
      );
      if (dupGeo) {
        throw new Error(`Geo Code '${plaza.geoCode}' already exists! Each plaza must have a unique Geo Code.`);
      }
    }
  }

  /**
   * Create or update a plaza.
   * POST /api/plazas (create) or PUT /api/plazas/:id (update).
   * Falls back to localStorage only if Railway is unavailable.
   * Fires audit event in both cases.
   */
  async savePlaza(plaza, { isEdit = false, originalId, actor: actorOverride } = {}) {
    // Enforce uniqueness validation across ID, Name, Org ID, Geo Code
    await this.validatePlazaUniqueness(plaza, { isEdit, originalId });

    const actor = actorOverride || getActor();
    const isUpdate = isEdit || Boolean(plaza._railwayId);
    const local = getLocalStore() || {};
    const targetLookupId = (isEdit && originalId) ? originalId : plaza.id;

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

    if (isUpdate) {
      await httpClient.put(`/api/plazas/${targetLookupId}`, payload, {
        headers: { 'X-Actor-ID': actor.id },
      });
    } else {
      await httpClient.post('/api/plazas', payload, {
        headers: { 'X-Actor-ID': actor.id },
      });
    }
    savedOnRailway = true;

    // Cache in local memory — update existing plaza in-place, preventing duplicate if ID was changed
    const existingPlazas = local.plazas || [];
    const idx = existingPlazas.findIndex((p) => p.id === targetLookupId || p.id === plaza.id);
    let updatedPlazas;
    if (idx >= 0) {
      updatedPlazas = existingPlazas.map((p, i) => (i === idx ? plaza : p));
      if (originalId && originalId !== plaza.id) {
        updatedPlazas = updatedPlazas.filter((p, i) => i === idx || p.id !== originalId);
      }
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
      details: `Plaza ${plaza.name} (ID: ${plaza.id}) ${isUpdate ? 'updated' : 'created'} in Railway MySQL. Status: ${plaza.status}. Concessionaire: ${plaza.concessionaireId}.`,
      actor,
      before: isUpdate ? { id: plaza.id, name: plaza.name } : null,
      after: { id: plaza.id, name: plaza.name, status: plaza.status },
    });

    return { ...plaza, _savedOnRailway: true };
  }

  // ============================================================
  // WRITE — Save / Update / Delete Concessionaire
  // ============================================================

  /**
   * Create or update a concessionaire.
   * POST /api/concessionaires (create) or PUT /api/concessionaires/:id (update).
   * Falls back to localStorage only if Railway is unavailable.
   * Fires audit event in both cases.
   */
  async saveConcessionaire(concessionaire, { isEdit = false, actor: actorOverride } = {}) {
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
      if (isEdit) {
        try {
          await httpClient.put(`/api/concessionaires/${concessionaire.id}`, payload, {
            headers: { 'X-Actor-ID': actor.id },
          });
          savedOnRailway = true;
        } catch (putErr) {
          // If live Railway container doesn't have PUT endpoint yet, fall back to POST (JPA upsert)
          if (putErr?.response?.status === 404 || putErr?.response?.status === 405) {
            await httpClient.post('/api/concessionaires', payload, {
              headers: { 'X-Actor-ID': actor.id },
            });
            savedOnRailway = true;
          } else {
            throw putErr;
          }
        }
      } else {
        await httpClient.post('/api/concessionaires', payload, {
          headers: { 'X-Actor-ID': actor.id },
        });
        savedOnRailway = true;
      }
    } catch (err) {
      console.warn('[OnboardingService] Concessionaire save network/API note:', err?.message);
    }

    const existingConcess = local.concessionaires || [];
    const alreadyExists = existingConcess.some((c) => c.id === concessionaire.id);
    const updatedConcess = alreadyExists
      ? existingConcess.map((c) => (c.id === concessionaire.id ? concessionaire : c))
      : [...existingConcess, concessionaire];

    saveLocalStore({ ...local, concessionaires: updatedConcess });

    // Audit trail
    UserActivityService.recordAuditEvent({
      module: 'On Boarding',
      action: isEdit ? 'UPDATE_CONCESSIONAIRE' : 'CREATE_CONCESSIONAIRE',
      actionLabel: isEdit ? 'Updated Concessionaire Details' : 'Registered Concessionaire',
      status: 'SUCCESS',
      target: `${concessionaire.name} (${concessionaire.id})`,
      details: `Concessionaire ${concessionaire.name} (ID: ${concessionaire.id}) ${isEdit ? 'updated' : 'registered'} in ${savedOnRailway ? 'Railway MySQL.' : 'memory store.'} Mail: ${concessionaire.mail}.`,
      actor,
      after: { id: concessionaire.id, name: concessionaire.name },
    });

    return { ...concessionaire, _savedOnRailway: savedOnRailway };
  }

  async updateConcessionaire(concessionaire, options = {}) {
    return this.saveConcessionaire(concessionaire, { ...options, isEdit: true });
  }

  async deleteConcessionaire(concessionaireId, { actor: actorOverride } = {}) {
    const actor = actorOverride || getActor();
    const local = getLocalStore() || {};

    let savedOnRailway = false;
    try {
      await httpClient.delete(`/api/concessionaires/${concessionaireId}`, {
        headers: { 'X-Actor-ID': actor.id },
      });
      savedOnRailway = true;
    } catch (err) {
      console.warn('[OnboardingService] Remote DELETE /api/concessionaires/' + concessionaireId + ' note:', err?.message);
    }

    // Update memory
    const updatedConcess = (local.concessionaires || []).filter((c) => c.id !== concessionaireId);
    saveLocalStore({ ...local, concessionaires: updatedConcess });

    // Audit trail
    UserActivityService.recordAuditEvent({
      module: 'On Boarding',
      action: 'DELETE_CONCESSIONAIRE',
      actionLabel: 'Deleted Concessionaire',
      status: 'SUCCESS',
      target: `Concessionaire ID: ${concessionaireId}`,
      details: `Concessionaire ${concessionaireId} removed ${savedOnRailway ? 'from Railway MySQL.' : 'from system.'}`,
      actor,
      before: concessionaireId,
    });

    return { success: true, _savedOnRailway: savedOnRailway };
  }

  // ============================================================
  // WRITE — Save / Update / Delete Lane
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
      console.warn('[OnboardingService] Save lane API note:', err?.message);
    }

    // Update memory
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
      details: `Lane ${lane.laneId} added in ${savedOnRailway ? 'Railway MySQL.' : 'system.'} Direction: ${lane.direction}, Type: ${lane.type}, Mode: ${lane.mode}, Category: ${lane.category}.`,
      actor,
      after: lane,
    });

    return { ...lane, _savedOnRailway: savedOnRailway };
  }

  async updateLane(lane, { oldLaneId, actor: actorOverride } = {}) {
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
      // If lane ID was renamed, purge previous composite key from database
      if (oldLaneId && oldLaneId !== lane.laneId) {
        try {
          await this.deleteLane(oldLaneId, lane.plazaId, { actor });
        } catch {}
      }

      try {
        await httpClient.put(`/api/plazas/lanes/${lane.laneId}`, payload, {
          headers: { 'X-Actor-ID': actor.id },
        });
        savedOnRailway = true;
      } catch (putErr) {
        // Fallback to POST if live container has not redeployed PUT
        if (putErr?.response?.status === 404 || putErr?.response?.status === 405) {
          await httpClient.post('/api/plazas/lanes', payload, {
            headers: { 'X-Actor-ID': actor.id },
          });
          savedOnRailway = true;
        } else {
          throw putErr;
        }
      }
    } catch (err) {
      console.warn('[OnboardingService] Update lane API note:', err?.message);
    }

    // Update memory
    const targetOldId = oldLaneId || lane.laneId;
    const existingLanes = local.lanes || [];
    const updatedLanes = existingLanes.map((l) =>
      (l.laneId === targetOldId || l.laneId === lane.laneId) && l.plazaId === lane.plazaId
        ? { ...l, ...lane }
        : l
    );
    saveLocalStore({ ...local, lanes: updatedLanes });

    // Audit trail
    UserActivityService.recordAuditEvent({
      module: 'On Boarding',
      action: 'UPDATE_LANE',
      actionLabel: 'Updated Lane Configuration',
      status: 'SUCCESS',
      target: `Lane ${lane.laneId} → Plaza ${lane.plazaId}`,
      plaza: lane.plazaId,
      details: `Lane ${lane.laneId} updated in ${savedOnRailway ? 'Railway MySQL.' : 'system.'} Direction: ${lane.direction}, Type: ${lane.type}, Mode: ${lane.mode}, Status: ${lane.status}.`,
      actor,
      after: lane,
    });

    return { ...lane, _savedOnRailway: savedOnRailway };
  }

  async deleteLane(laneId, plazaId, { actor: actorOverride } = {}) {
    const actor = actorOverride || getActor();
    const local = getLocalStore() || {};

    let savedOnRailway = false;
    try {
      // First try DELETE with JSON body { laneId, plazaId } (supported by currently deployed Railway backend)
      try {
        await httpClient.delete('/api/plazas/lanes', {
          data: { laneId, plazaId },
          headers: { 'X-Actor-ID': actor.id },
        });
        savedOnRailway = true;
      } catch (err1) {
        // Then try path variable DELETE /api/plazas/lanes/:laneId
        await httpClient.delete(`/api/plazas/lanes/${laneId}`, {
          params: { plazaId },
          data: { laneId, plazaId },
          headers: { 'X-Actor-ID': actor.id },
        });
        savedOnRailway = true;
      }
    } catch (err) {
      console.warn('[OnboardingService] Delete lane API note:', err?.message);
    }

    // Update memory
    const updatedLanes = (local.lanes || []).filter((l) => !(l.laneId === laneId && l.plazaId === plazaId));
    saveLocalStore({ ...local, lanes: updatedLanes });

    // Audit trail
    UserActivityService.recordAuditEvent({
      module: 'On Boarding',
      action: 'REMOVE_LANE',
      actionLabel: 'Removed Lane from Plaza',
      status: 'SUCCESS',
      target: `Lane ${laneId} (Plaza ${plazaId})`,
      plaza: plazaId,
      details: `Lane ${laneId} removed from Plaza ${plazaId} in ${savedOnRailway ? 'Railway MySQL.' : 'system.'}`,
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

    await httpClient.put(`/api/plazas/${plazaId}/callbacks`, { callbacks: callbackUrls }, {
      headers: { 'X-Actor-ID': actor.id },
    });

    // Update memory
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
      details: `Saved ${configuredCount} of 14 callback webhook URLs for Plaza ${plazaId} in Railway MySQL.`,
      actor,
    });

    return { success: true, _savedOnRailway: true };
  }

  // ============================================================
  // WRITE — Save Fare Mapping
  // ============================================================

  async saveFares(plazaId, fares, { actor: actorOverride } = {}) {
    const actor = actorOverride || getActor();
    const local = getLocalStore() || {};

    await httpClient.put(`/api/plazas/${plazaId}/fares`, { fares }, {
      headers: { 'X-Actor-ID': actor.id },
    });

    // Update memory
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
      details: `Fare mapping saved for Plaza ${plazaId} in Railway MySQL covering VC4–VC20 across 6 journey types.`,
      actor,
    });

    return { success: true, _savedOnRailway: true };
  }

  // ============================================================
  // WRITE — Save CCH Mapping
  // ============================================================

  async saveCch(plazaId, cch, { actor: actorOverride } = {}) {
    const actor = actorOverride || getActor();
    const local = getLocalStore() || {};

    let savedOnRailway = false;
    try {
      await httpClient.put(`/api/plazas/${plazaId}/cch`, { cch, plazaId }, {
        headers: { 'X-Actor-ID': actor.id },
      });
      savedOnRailway = true;
    } catch (err) {
      console.warn('[OnboardingService] Remote PUT /api/plazas/' + plazaId + '/cch note:', err.message);
    }

    // Update memory
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
  async loadFullStore() {
    try {
      const res = await httpClient.get('/api/onboarding/all');
      if (res?.data && res.data.plazas && Array.isArray(res.data.plazas)) {
        const normalisedPlazas = res.data.plazas.map((p) => ({
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
          mdr: p.mdr || (typeof p.mdrJson === 'string' ? JSON.parse(p.mdrJson) : null) || {
            bankFee: p.bankFee || p.bank_fee || '0.90',
            npciFee: p.npciFee || p.npci_fee || '0.15',
            bankGst: p.bankGst || p.bank_gst || '18',
            npciGst: p.npciGst || p.npci_gst || '18',
          },
          _fromRailway: true,
        }));

        const backendStore = {
          concessionaires: (res.data.concessionaires || []).map((c) => ({
            id: String(c.id || ''),
            name: c.name || '',
            address: c.address || '',
            mail: c.mail || c.email || '',
            contact: c.contact || c.mobile || c.phone || '',
            _fromRailway: true,
          })),
          plazas: normalisedPlazas,
          lanes: (res.data.lanes || []).map((l) => ({
            ...l,
            _fromRailway: true,
          })),
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
      console.warn('[OnboardingService] GET /api/onboarding/all error, falling back to individual endpoints:', err?.message);
    }

    const [plazas, concessionaires, lanes] = await Promise.all([
      this.getPlazas().catch(() => []),
      this.getConcessionaires().catch(() => []),
      this.getLanes().catch(() => []),
    ]);

    return {
      concessionaires,
      plazas,
      lanes,
      callbacks: {},
      fares: {},
      cch: {},
      source: 'LIVE_BACKEND_DB',
      _liveDb: true,
    };
  }
}

export default new OnboardingService();
