import httpClient from '../api/httpClient';
import { IS_DEV_MODE } from '../config/env';
import mockData from '../../data/productDetail.json';

class ProductService {
  async getProductDetails(id) {
    if (IS_DEV_MODE) {
      return Promise.resolve(mockData);
    }
    const res = await httpClient.get(`/api/products/${id}`);
    return res.data;
  }
}

export default new ProductService();
