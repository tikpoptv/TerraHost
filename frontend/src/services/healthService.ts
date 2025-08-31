import api from '@/lib/api';

export class HealthService {
  async checkHealth() {
    return await api.get('/health');
  }
}

export const healthService = new HealthService();
