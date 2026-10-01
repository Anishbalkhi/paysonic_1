/**
 * DisputeReportService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Communicates strictly with live database backend endpoints:
 *   - GET /api/disputes/search
 *   - GET /api/disputes/export/excel
 *   - GET /api/disputes/export/csv
 *
 * No fake or mock data. All data originates directly from the Railway MySQL DB.
 */

import httpClient from '../api/httpClient';
import UserActivityService from '../userActivity/UserActivityService';

class DisputeReportService {
  /**
   * Search dispute transactions directly from Railway MySQL database
   */
  async searchDisputes({ fromDate, toDate, plazaId, functionCode, page = 0, size = 50 }) {
    const params = { page, size };
    if (fromDate) params.fromDate = fromDate;
    if (toDate) params.toDate = toDate;
    if (plazaId && plazaId !== 'ALL') params.plazaId = plazaId;
    if (functionCode && functionCode !== 'ALL') params.functionCode = functionCode;

    const res = await httpClient.get('/api/disputes/search', { params });
    return res.data;
  }

  /**
   * Export Excel (.xlsx) file streaming directly from Railway backend
   */
  async exportExcel({ fromDate, toDate, plazaId, functionCode }) {
    try {
      const session = JSON.parse(localStorage.getItem('paysonic_auth_session') || '{}');
      UserActivityService.recordAuditEvent({
        module: 'Dispute Handling',
        action: 'EXPORT_DISPUTE_EXCEL',
        actionLabel: 'Exported Dispute Detail Report (Excel)',
        status: 'SUCCESS',
        target: 'Dispute Detail Report',
        details: `Exported Excel for range: ${fromDate} to ${toDate}`,
        actor: session.name ? { id: session.id, name: session.name, role: session.role } : undefined
      });
    } catch (e) {
      console.warn('[DisputeReportService] Audit event logging error:', e);
    }

    const params = {};
    if (fromDate) params.fromDate = fromDate;
    if (toDate) params.toDate = toDate;
    if (plazaId && plazaId !== 'ALL') params.plazaId = plazaId;
    if (functionCode && functionCode !== 'ALL') params.functionCode = functionCode;

    const response = await httpClient.get('/api/disputes/export/excel', {
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
    link.setAttribute('download', `Dispute_Detail_Report_${timestamp}.xlsx`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    return { success: true };
  }

  /**
   * Export CSV (.csv) file streaming directly from Railway backend with UTF-8 BOM
   */
  async exportCsv({ fromDate, toDate, plazaId, functionCode }) {
    try {
      const session = JSON.parse(localStorage.getItem('paysonic_auth_session') || '{}');
      UserActivityService.recordAuditEvent({
        module: 'Dispute Handling',
        action: 'EXPORT_DISPUTE_CSV',
        actionLabel: 'Exported Dispute Detail Report (CSV)',
        status: 'SUCCESS',
        target: 'Dispute Detail Report',
        details: `Exported CSV for range: ${fromDate} to ${toDate}`,
        actor: session.name ? { id: session.id, name: session.name, role: session.role } : undefined
      });
    } catch (e) {
      console.warn('[DisputeReportService] Audit event logging error:', e);
    }

    const params = {};
    if (fromDate) params.fromDate = fromDate;
    if (toDate) params.toDate = toDate;
    if (plazaId && plazaId !== 'ALL') params.plazaId = plazaId;
    if (functionCode && functionCode !== 'ALL') params.functionCode = functionCode;

    const response = await httpClient.get('/api/disputes/export/csv', {
      params,
      responseType: 'blob'
    });

    const blob = new Blob([response.data], {
      type: 'text/csv; charset=UTF-8'
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    link.setAttribute('download', `Dispute_Detail_Report_${timestamp}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    return { success: true };
  }
}

export default new DisputeReportService();
