/**
 * DateWiseReconService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Communicates with backend endpoints for Date Wise Reconciliation Report:
 *   - GET /api/reports/date-wise-recon/search
 *   - GET /api/reports/date-wise-recon/export
 *
 * All data aggregates directly from real MySQL database.
 */

import httpClient from '../api/httpClient';
import UserActivityService from '../userActivity/UserActivityService';

class DateWiseReconService {
  /**
   * Search date-wise reconciliation parent summary and child breakdowns
   */
  async searchDateWiseRecon({ fromDate, toDate, plazaId = '' }) {
    const params = {};
    if (fromDate) params.fromDate = fromDate;
    if (toDate) params.toDate = toDate;
    if (plazaId) params.plazaId = plazaId;

    const res = await httpClient.get('/api/reports/date-wise-recon/search', { params });
    return res.data;
  }

  /**
   * Export Date Wise Recon directly from server streaming endpoint
   */
  async exportExcel({ fromDate, toDate, plazaId = '' }) {
    try {
      const session = JSON.parse(localStorage.getItem('paysonic_auth_session') || '{}');
      UserActivityService.recordAuditEvent({
        module: 'Recon Management',
        action: 'EXPORT_DATE_WISE_RECON',
        actionLabel: 'Exported Date Wise Recon Report (Excel)',
        status: 'SUCCESS',
        target: 'Date Wise Recon',
        details: `Exported Date Wise Recon report range: ${fromDate} to ${toDate}`,
        actor: session.name ? { id: session.id, name: session.name, role: session.role } : undefined
      });
    } catch (e) {
      console.warn('[DateWiseReconService] Audit logging failed:', e);
    }

    const params = {};
    if (fromDate) params.fromDate = fromDate;
    if (toDate) params.toDate = toDate;
    if (plazaId) params.plazaId = plazaId;

    const response = await httpClient.get('/api/reports/date-wise-recon/export', {
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
    link.setAttribute('download', `Date_Wise_Recon_${timestamp}.xlsx`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    return { success: true };
  }
}

export default new DateWiseReconService();
