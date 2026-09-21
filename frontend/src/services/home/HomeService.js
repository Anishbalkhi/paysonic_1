import httpClient from '../api/httpClient';
import { IS_DEV_MODE } from '../config/env';
import mockData from '../../data/home.json';

class HomeService {
  async getDashboardData() {
    if (IS_DEV_MODE) {
      return Promise.resolve(mockData);
    }
    const res = await httpClient.get('/api/dashboard');
    return res.data;
  }
}

export default new HomeService();
