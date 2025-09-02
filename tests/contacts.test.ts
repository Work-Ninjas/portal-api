import request from 'supertest';
import { createApp } from '../src/app';

describe('Contacts Endpoints', () => {
  const app = createApp();
  const validToken = 'test_token_123';

  describe('GET /v1/contacts', () => {
    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/v1/contacts')
        .expect(401);

      expect(response.body).toHaveProperty('code', 'UNAUTHORIZED');
      expect(response.body).toHaveProperty('status', 401);
    });

    it('should return paginated contacts with authentication', async () => {
      const response = await request(app)
        .get('/v1/contacts')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('limit', 25);
      expect(response.body).toHaveProperty('offset', 0);
      expect(response.body).toHaveProperty('has_more');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should respect pagination parameters', async () => {
      const response = await request(app)
        .get('/v1/contacts?limit=1&offset=1')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.limit).toBe(1);
      expect(response.body.offset).toBe(1);
      expect(response.body.data.length).toBeLessThanOrEqual(1);
    });

    it('should validate sort direction', async () => {
      const response = await request(app)
        .get('/v1/contacts?dir=invalid')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(422);

      expect(response.body).toHaveProperty('code', 'VALIDATION_FAILED');
      expect(response.body.errors).toContainEqual(
        expect.objectContaining({
          field: 'dir',
          message: expect.stringContaining('asc')
        })
      );
    });

    it('should support search query', async () => {
      const response = await request(app)
        .get('/v1/contacts?q=john')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
    });
  });

  describe('GET /v1/contacts/:id', () => {
    it('should return 401 without authentication', async () => {
      await request(app)
        .get('/v1/contacts/con_a1b2c3d4')
        .expect(401);
    });

    it('should return contact by ID', async () => {
      const response = await request(app)
        .get('/v1/contacts/con_a1b2c3d4')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', 'con_a1b2c3d4');
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('emails');
      expect(Array.isArray(response.body.emails)).toBe(true);
    });

    it('should return 404 for non-existent contact', async () => {
      const response = await request(app)
        .get('/v1/contacts/con_notfound')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('code', 'NOT_FOUND');
    });

    it('should validate ID format', async () => {
      const response = await request(app)
        .get('/v1/contacts/invalid-id')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('code', 'BAD_REQUEST');
    });
  });
});