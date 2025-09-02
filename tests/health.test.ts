import request from 'supertest';
import { createApp } from '../src/app';

describe('Health Endpoint', () => {
  const app = createApp();

  describe('GET /v1/health', () => {
    it('should return 200 with health status', async () => {
      const response = await request(app)
        .get('/v1/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('traceId');
    });

    it('should echo X-Request-Id if provided', async () => {
      const requestId = 'test-request-123';
      const response = await request(app)
        .get('/v1/health')
        .set('X-Request-Id', requestId)
        .expect(200);

      expect(response.body).toHaveProperty('requestId', requestId);
      expect(response.headers['x-request-id']).toBe(requestId);
    });

    it('should not require authentication', async () => {
      await request(app)
        .get('/v1/health')
        .expect(200);
    });
  });
});