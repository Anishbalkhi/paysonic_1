import axios from 'axios';

const API_BASE = '/api/violation/raw-file';

class ViolationRawFileService {
  /**
   * Search violation raw records with pagination and filters
   */
  async search(params) {
    const response = await axios.post(`${API_BASE}/search`, params);
    return response.data;
  }

  /**
   * Export violation raw records as Excel (.xlsx)
   */
  async exportExcel(params) {
    const response = await axios.post(`${API_BASE}/export`, params, {
      responseType: 'blob'
    });
    const blob = new Blob([response.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Violation_Raw_File_${Date.now()}.xlsx`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }

  /**
   * Export violation raw records as CSV (.csv)
   */
  async exportCsv(params) {
    const response = await axios.post(`${API_BASE}/export/csv`, params, {
      responseType: 'blob'
    });
    const blob = new Blob([response.data], {
      type: 'text/csv;charset=utf-8;'
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Violation_Raw_File_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }

  /**
   * Export violation raw records as standard Raw Text (.txt)
   */
  async exportTxt(params) {
    const response = await axios.post(`${API_BASE}/export/txt`, params, {
      responseType: 'blob'
    });
    const blob = new Blob([response.data], {
      type: 'text/plain;charset=utf-8;'
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Violation_Raw_File_${Date.now()}.txt`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }
}

export default new ViolationRawFileService();
