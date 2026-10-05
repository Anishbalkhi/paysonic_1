import httpClient from '../api/httpClient';

const API_BASE = '/api/summary/nhai-traffic';

class NhaiTrafficService {
  /**
   * Fetch aggregated NHAI traffic report
   */
  async getReport(params) {
    const response = await httpClient.post(`${API_BASE}/search`, params);
    return response.data;
  }

  /**
   * Export NHAI traffic report as Excel (.xlsx)
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
    link.setAttribute('download', `NHAI_Traffic_Report_${Date.now()}.xlsx`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }

  /**
   * Export NHAI traffic report as CSV (.csv)
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
    link.setAttribute('download', `NHAI_Traffic_Report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }
}

export default new NhaiTrafficService();
