/**
 * RejectedTransactionService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Communicates strictly with real database backend endpoints:
 *   - GET /api/reports/rejected-transactions/search
 *   - GET /api/reports/rejected-transactions/export
 *   - GET /api/reports/rejected-transactions/export/csv
 *
 * All data originates strictly from the Railway MySQL DB (toll_transactions).
 */

import httpClient from '../api/httpClient';
import UserActivityService from '../userActivity/UserActivityService';

class RejectedTransactionService {
  /**
   * Search rejected transactions directly from Railway MySQL database
   */
  async searchRejectedTransactions({ fromDate, toDate, plazaId, reason, page = 0, size = 25 }) {
    const params = {
      page,
      size
    };
    if (fromDate) params.fromDate = fromDate;
    if (toDate) params.toDate = toDate;
    if (plazaId && plazaId !== 'ALL') params.plazaId = plazaId;
    if (reason && reason !== 'ALL') params.reason = reason;

    const res = await httpClient.get('/api/reports/rejected-transactions/search', { params });
    return res.data;
  }

  /**
   * Export Excel directly from server streaming endpoint
   */
  async exportExcel({ fromDate, toDate, plazaId, reason }) {
    try {
      const session = JSON.parse(localStorage.getItem('paysonic_auth_session') || '{}');
      UserActivityService.recordAuditEvent({
        module: 'Transactional Reports',
        action: 'EXPORT_REJECTED_TRANSACTIONS_EXCEL',
        actionLabel: 'Exported Rejected Transactions (Excel)',
        status: 'SUCCESS',
        target: 'Rejected Transaction Report',
        details: `Exported Rejected Transactions range: ${fromDate} to ${toDate}`,
        actor: session.name ? { id: session.id, name: session.name, role: session.role } : undefined
      });
    } catch (e) {
      console.warn('[RejectedTransactionService] Audit event logging error:', e);
    }

    const params = {};
    if (fromDate) params.fromDate = fromDate;
    if (toDate) params.toDate = toDate;
    if (plazaId && plazaId !== 'ALL') params.plazaId = plazaId;
    if (reason && reason !== 'ALL') params.reason = reason;

    const response = await httpClient.get('/api/reports/rejected-transactions/export', {
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
    link.setAttribute('download', `Rejected_Transactions_${timestamp}.xlsx`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    return { success: true };
  }

  /**
   * Export CSV directly from server streaming endpoint
   */
  async exportCsv({ fromDate, toDate, plazaId, reason }) {
    try {
      const session = JSON.parse(localStorage.getItem('paysonic_auth_session') || '{}');
      UserActivityService.recordAuditEvent({
        module: 'Transactional Reports',
        action: 'EXPORT_REJECTED_TRANSACTIONS_CSV',
        actionLabel: 'Exported Rejected Transactions (CSV)',
        status: 'SUCCESS',
        target: 'Rejected Transaction Report',
        details: `Exported Rejected Transactions CSV range: ${fromDate} to ${toDate}`,
        actor: session.name ? { id: session.id, name: session.name, role: session.role } : undefined
      });
    } catch (e) {
      console.warn('[RejectedTransactionService] Audit event logging error:', e);
    }

    const params = {};
    if (fromDate) params.fromDate = fromDate;
    if (toDate) params.toDate = toDate;
    if (plazaId && plazaId !== 'ALL') params.plazaId = plazaId;
    if (reason && reason !== 'ALL') params.reason = reason;

    const response = await httpClient.get('/api/reports/rejected-transactions/export/csv', {
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
    link.setAttribute('download', `Rejected_Transactions_${timestamp}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    return { success: true };
  }
}

export default new RejectedTransactionService();
