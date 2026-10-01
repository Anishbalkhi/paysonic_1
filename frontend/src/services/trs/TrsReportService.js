/**
 * TrsReportService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Communicates strictly with real database backend endpoints:
 *   - GET /api/reports/trs/search
 *   - GET /api/reports/trs/export
 *   - GET /api/reports/trs/export/csv
 *
 * No fake or mock data fallbacks. All data originates strictly from the Railway MySQL DB.
 */

import httpClient from '../api/httpClient';
import UserActivityService from '../userActivity/UserActivityService';

class TrsReportService {
  /**
   * Search transactions directly from the MySQL database
   */
  async searchTransactions({ fromDate, toDate, plazaId, status, page = 0, size = 25 }) {
    const params = {
      page,
      size
    };
    if (fromDate) params.fromDate = fromDate;
    if (toDate) params.toDate = toDate;
    if (plazaId && plazaId !== 'ALL') params.plazaId = plazaId;
    if (status && status !== 'ALL') params.status = status;

    // Directly query real database endpoint
    const res = await httpClient.get('/api/reports/trs/search', { params });
    return res.data;
  }

  /**
   * Export Excel directly from server streaming endpoint
   */
  async exportExcel({ fromDate, toDate, plazaId, status }) {
    // Record audit event in user activity audit trail
    try {
      const session = JSON.parse(localStorage.getItem('paysonic_auth_session') || '{}');
      UserActivityService.recordAuditEvent({
        module: 'Transactional Reports',
        action: 'EXPORT_TRANSACTION_REPORT_EXCEL',
        actionLabel: 'Exported Transaction Report (Excel)',
        status: 'SUCCESS',
        target: 'Transaction Report',
        details: `Exported Transaction report range: ${fromDate} to ${toDate}`,
        actor: session.name ? { id: session.id, name: session.name, role: session.role } : undefined
      });
    } catch (e) {
      console.warn('[TrsReportService] Audit event logging error:', e);
    }

    const params = {};
    if (fromDate) params.fromDate = fromDate;
    if (toDate) params.toDate = toDate;
    if (plazaId && plazaId !== 'ALL') params.plazaId = plazaId;
    if (status && status !== 'ALL') params.status = status;

    const response = await httpClient.get('/api/reports/trs/export', {
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
    link.setAttribute('download', `Transaction_Report_${timestamp}.xlsx`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    return { success: true };
  }

  /**
   * Export CSV directly from server streaming endpoint
   */
  async exportCsv({ fromDate, toDate, plazaId, status }) {
    try {
      const session = JSON.parse(localStorage.getItem('paysonic_auth_session') || '{}');
      UserActivityService.recordAuditEvent({
        module: 'Transactional Reports',
        action: 'EXPORT_TRANSACTION_REPORT_CSV',
        actionLabel: 'Exported Transaction Report (CSV)',
        status: 'SUCCESS',
        target: 'Transaction Report',
        details: `Exported Transaction report CSV range: ${fromDate} to ${toDate}`,
        actor: session.name ? { id: session.id, name: session.name, role: session.role } : undefined
      });
    } catch (e) {
      console.warn('[TrsReportService] Audit event logging error:', e);
    }

    const params = {};
    if (fromDate) params.fromDate = fromDate;
    if (toDate) params.toDate = toDate;
    if (plazaId && plazaId !== 'ALL') params.plazaId = plazaId;
    if (status && status !== 'ALL') params.status = status;

    const response = await httpClient.get('/api/reports/trs/export/csv', {
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
    link.setAttribute('download', `Transaction_Report_${timestamp}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    return { success: true };
  }
}

export default new TrsReportService();

