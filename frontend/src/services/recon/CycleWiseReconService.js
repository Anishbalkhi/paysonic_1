/**
 * CycleWiseReconService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Communicates with backend endpoints for Cycle Wise Reconciliation Report:
 *   - GET /api/reports/cycle-wise-recon/search
 *   - GET /api/reports/cycle-wise-recon/export
 *
 * All data aggregates directly from real MySQL database.
 */

import httpClient from '../api/httpClient';
import UserActivityService from '../userActivity/UserActivityService';

class CycleWiseReconService {
  /**
   * Search cycle-wise reconciliation data
   */
  async searchCycleWiseRecon({ fromDate, toDate, plazaId = '', cycle = '', dateType = '' }) {
    const params = {};
    if (fromDate) params.fromDate = fromDate;
    if (toDate) params.toDate = toDate;
    if (plazaId) params.plazaId = plazaId;
    if (cycle) params.cycle = cycle;
    if (dateType) params.dateType = dateType;

    const res = await httpClient.get('/api/reports/cycle-wise-recon/search', { params });
    return res.data;
  }

  /**
   * Export Cycle Wise Recon directly from server streaming endpoint
   */
  async exportExcel({ fromDate, toDate, plazaId = '', cycle = '', dateType = '' }) {
    try {
      const session = JSON.parse(localStorage.getItem('paysonic_auth_session') || '{}');
      UserActivityService.recordAuditEvent({
        module: 'Recon Management',
        action: 'EXPORT_CYCLE_WISE_RECON',
        actionLabel: 'Exported Cycle Wise Recon Report (Excel)',
        status: 'SUCCESS',
        target: 'Cycle Wise Recon',
        details: `Exported Cycle Wise Recon report range: ${fromDate} to ${toDate}${dateType ? ` (Date Type: ${dateType})` : ''}`,
        actor: session.name ? { id: session.id, name: session.name, role: session.role } : undefined
      });
    } catch (e) {
      console.warn('[CycleWiseReconService] Audit logging failed:', e);
    }

    const params = {};
    if (fromDate) params.fromDate = fromDate;
    if (toDate) params.toDate = toDate;
    if (plazaId) params.plazaId = plazaId;
    if (cycle) params.cycle = cycle;
    if (dateType) params.dateType = dateType;

    const response = await httpClient.get('/api/reports/cycle-wise-recon/export', {
      params,
      responseType: 'blob'
    });

    const blob = new Blob([response.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Cycle_Wise_Report_${Date.now()}.xlsx`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
}

export default new CycleWiseReconService();
