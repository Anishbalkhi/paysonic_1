/**
 * TollFareReportService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Communicates strictly with real database backend endpoints:
 *   - GET /api/reports/toll-fare/search
 *   - GET /api/reports/toll-fare/export
 *   - GET /api/reports/toll-fare/export/csv
 *
 * All data originates strictly from the Railway MySQL DB (plaza_fares).
 */

import httpClient from '../api/httpClient';
import UserActivityService from '../userActivity/UserActivityService';

class TollFareReportService {
  /**
   * Search toll fares from live Railway database
   */
  async searchTollFares({ plazaId = '501101', vehicleClass }) {
    const params = {};
    if (plazaId) params.plazaId = plazaId;
    if (vehicleClass && vehicleClass !== 'ALL') params.vehicleClass = vehicleClass;

    const res = await httpClient.get('/api/reports/toll-fare/search', { params });
    return res.data;
  }

  /**
   * Export Excel directly from server streaming endpoint
   */
  async exportExcel({ plazaId = '501101', vehicleClass }) {
    try {
      const session = JSON.parse(localStorage.getItem('paysonic_auth_session') || '{}');
      UserActivityService.recordAuditEvent({
        module: 'Transactional Reports',
        action: 'EXPORT_TOLL_FARE_REPORT_EXCEL',
        actionLabel: 'Exported Toll Fare Report (Excel)',
        status: 'SUCCESS',
        target: 'Toll Fare Report',
        details: `Exported Toll Fare matrix for Plaza: ${plazaId}`,
        actor: session.name ? { id: session.id, name: session.name, role: session.role } : undefined
      });
    } catch (e) {
      console.warn('[TollFareReportService] Audit event logging error:', e);
    }

    const params = {};
    if (plazaId) params.plazaId = plazaId;
    if (vehicleClass && vehicleClass !== 'ALL') params.vehicleClass = vehicleClass;

    const response = await httpClient.get('/api/reports/toll-fare/export', {
      params,
      responseType: 'blob'
    });

    const blob = new Blob([response.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    link.setAttribute('download', `Toll_Fare_Report_${plazaId}_${timestamp}.xlsx`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    return { success: true };
  }

  /**
   * Export CSV directly from server streaming endpoint
   */
  async exportCsv({ plazaId = '501101', vehicleClass }) {
    try {
      const session = JSON.parse(localStorage.getItem('paysonic_auth_session') || '{}');
      UserActivityService.recordAuditEvent({
        module: 'Transactional Reports',
        action: 'EXPORT_TOLL_FARE_REPORT_CSV',
        actionLabel: 'Exported Toll Fare Report (CSV)',
        status: 'SUCCESS',
        target: 'Toll Fare Report',
        details: `Exported Toll Fare CSV for Plaza: ${plazaId}`,
        actor: session.name ? { id: session.id, name: session.name, role: session.role } : undefined
      });
    } catch (e) {
      console.warn('[TollFareReportService] Audit event logging error:', e);
    }

    const params = {};
    if (plazaId) params.plazaId = plazaId;
    if (vehicleClass && vehicleClass !== 'ALL') params.vehicleClass = vehicleClass;

    const response = await httpClient.get('/api/reports/toll-fare/export/csv', {
      params,
      responseType: 'blob'
    });

    const blob = new Blob([response.data], {
      type: 'text/csv;charset=utf-8;'
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    link.setAttribute('download', `Toll_Fare_Report_${plazaId}_${timestamp}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    return { success: true };
  }
}

export default new TollFareReportService();
