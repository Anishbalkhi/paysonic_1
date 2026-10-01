import axios from 'axios';

const API_BASE = '/api/summary/pass-summary';

class PassSummaryService {
  async getReport(params) {
    const response = await axios.post(`${API_BASE}/search`, params);
    return response.data;
  }

  async exportExcel(params) {
    const response = await axios.post(`${API_BASE}/export`, params, { responseType: 'blob' });
    const blob = new Blob([response.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Pass_Summary_Report_${Date.now()}.xlsx`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }

  async exportCsv(params) {
    const response = await axios.post(`${API_BASE}/export/csv`, params, { responseType: 'blob' });
    const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Pass_Summary_Report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }
}

export default new PassSummaryService();
