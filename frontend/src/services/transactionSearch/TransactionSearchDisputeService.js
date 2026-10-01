/**
 * TransactionSearchDisputeService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Communicates strictly with real database backend endpoints:
 *   - GET /api/reports/transaction-search/dispute/search
 *   - GET /api/reports/transaction-search/dispute/export
 *   - GET /api/reports/transaction-search/dispute/export/csv
 *
 * All data originates strictly from the Railway MySQL DB (dispute_transactions).
 */

import httpClient from '../api/httpClient';
import UserActivityService from '../userActivity/UserActivityService';

class TransactionSearchDisputeService {
  /**
   * Search dispute transactions directly from Railway MySQL database
   */
  async searchDisputes({ fromDate, toDate, plazaId, functionCode, page = 0, size = 25 }) {
    const params = {
      page,
      size
    };
    if (fromDate) params.fromDate = fromDate;
    if (toDate) params.toDate = toDate;
    if (plazaId && plazaId !== 'ALL') params.plazaId = plazaId;
    if (functionCode && functionCode !== 'ALL') params.functionCode = functionCode;

    const res = await httpClient.get('/api/reports/transaction-search/dispute/search', { params });
    return res.data;
  }

  /**
   * Export Excel directly from server streaming endpoint
   */
  async exportExcel({ fromDate, toDate, plazaId, functionCode }) {
    try {
      const session = JSON.parse(localStorage.getItem('paysonic_auth_session') || '{}');
      UserActivityService.recordAuditEvent({
        module: 'Transactional Reports',
        action: 'EXPORT_TRANSACTION_SEARCH_DISPUTE_EXCEL',
        actionLabel: 'Exported Transaction Search Dispute (Excel)',
        status: 'SUCCESS',
        target: 'Transaction Search - Dispute Transaction',
        details: `Exported Dispute Transactions range: ${fromDate} to ${toDate}`,
        actor: session.name ? { id: session.id, name: session.name, role: session.role } : undefined
      });
    } catch (e) {
      console.warn('[TransactionSearchDisputeService] Audit event logging error:', e);
    }

    const params = {};
    if (fromDate) params.fromDate = fromDate;
    if (toDate) params.toDate = toDate;
    if (plazaId && plazaId !== 'ALL') params.plazaId = plazaId;
    if (functionCode && functionCode !== 'ALL') params.functionCode = functionCode;

    const response = await httpClient.get('/api/reports/transaction-search/dispute/export', {
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
    link.setAttribute('download', `Transaction_Search_Dispute_${timestamp}.xlsx`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    return { success: true };
  }

  /**
   * Export CSV directly from server streaming endpoint
   */
  async exportCsv({ fromDate, toDate, plazaId, functionCode }) {
    try {
      const session = JSON.parse(localStorage.getItem('paysonic_auth_session') || '{}');
      UserActivityService.recordAuditEvent({
        module: 'Transactional Reports',
        action: 'EXPORT_TRANSACTION_SEARCH_DISPUTE_CSV',
        actionLabel: 'Exported Transaction Search Dispute (CSV)',
        status: 'SUCCESS',
        target: 'Transaction Search - Dispute Transaction',
        details: `Exported Dispute Transactions CSV range: ${fromDate} to ${toDate}`,
        actor: session.name ? { id: session.id, name: session.name, role: session.role } : undefined
      });
    } catch (e) {
      console.warn('[TransactionSearchDisputeService] Audit event logging error:', e);
    }

    const params = {};
    if (fromDate) params.fromDate = fromDate;
    if (toDate) params.toDate = toDate;
    if (plazaId && plazaId !== 'ALL') params.plazaId = plazaId;
    if (functionCode && functionCode !== 'ALL') params.functionCode = functionCode;

    const response = await httpClient.get('/api/reports/transaction-search/dispute/export/csv', {
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
    link.setAttribute('download', `Transaction_Search_Dispute_${timestamp}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    return { success: true };
  }
}

export default new TransactionSearchDisputeService();
