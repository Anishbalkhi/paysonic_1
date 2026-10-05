import httpClient from '../api/httpClient';

const API_BASE = '/api/violation/bulk-action';

class ViolationBulkActionService {
  /**
   * Search violation transactions with pagination and filters
   */
  async search(params) {
    const response = await httpClient.post(`${API_BASE}/search`, params);
    return response.data;
  }

  /**
   * Apply bulk action (Approve / Reject / Mark Reviewed) on selected IDs
   */
  async applyBulkAction(payload) {
    const response = await httpClient.post(`${API_BASE}/apply`, payload);
    return response.data;
  }

  /**
   * Export violation transactions as Excel (.xlsx)
   */
  async exportExcel(params) {
    const response = await httpClient.post(`${API_BASE}/export`, params, {
      responseType: 'blob'
    });
    const blob = new Blob([response.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Violation_Bulk_Action_${Date.now()}.xlsx`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }

  /**
   * Export violation transactions as CSV (.csv)
   */
  async exportCsv(params) {
    const response = await httpClient.post(`${API_BASE}/export/csv`, params, {
      responseType: 'blob'
    });
    const blob = new Blob([response.data], {
      type: 'text/csv;charset=utf-8;'
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Violation_Bulk_Action_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }
}

export default new ViolationBulkActionService();
