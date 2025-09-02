import request from 'supertest';
import { createRealApp } from '../../src/app-real';

describe('Real Contacts Endpoints', () => {
  const app = createRealApp();
  const validToken = 'test_token_123';

  describe('GET /v1/contacts (RPC)', () => {
    it('should return contacts from RPC service', async () => {
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

      // Check contact structure matches API contract
      if (response.body.data.length > 0) {
        const contact = response.body.data[0];
        expect(contact).toHaveProperty('id');
        expect(contact).toHaveProperty('name');
        expect(contact).toHaveProperty('emails');
        expect(contact).toHaveProperty('created_at');
        expect(contact).toHaveProperty('updated_at');
        expect(Array.isArray(contact.emails)).toBe(true);

        // Verify omit vs null policy
        if (contact.company === undefined) {
          expect(contact).not.toHaveProperty('company');
        }
        if (contact.phones === undefined) {
          expect(contact).not.toHaveProperty('phones');
        }
      }
    });

    it('should support search functionality', async () => {
      const response = await request(app)
        .get('/v1/contacts?q=John')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      // Should filter results based on search query
      if (response.body.data.length > 0) {
        const contact = response.body.data[0];
        expect(contact.name.toLowerCase()).toContain('john');
      }
    });
  });

  describe('GET /v1/contacts/:id (RPC)', () => {
    it('should return specific contact from RPC service', async () => {
      const response = await request(app)
        .get('/v1/contacts/con_a1b2c3d4')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', 'con_a1b2c3d4');
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('emails');
      expect(Array.isArray(response.body.emails)).toBe(true);

      // Check email structure
      if (response.body.emails.length > 0) {
        const email = response.body.emails[0];
        expect(email).toHaveProperty('email');
        expect(email).toHaveProperty('type');
        expect(email).toHaveProperty('is_primary');
        expect(['work', 'personal', 'other']).toContain(email.type);
      }

      // Check phone structure if present
      if (response.body.phones) {
        expect(Array.isArray(response.body.phones)).toBe(true);
        if (response.body.phones.length > 0) {
          const phone = response.body.phones[0];
          expect(phone).toHaveProperty('phone');
          expect(phone).toHaveProperty('type');
          expect(phone).toHaveProperty('is_primary');
          expect(['mobile', 'work', 'home', 'other']).toContain(phone.type);
        }
      }
    });

    it('should return 404 for non-existent contact', async () => {
      const response = await request(app)
        .get('/v1/contacts/con_nonexist')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('code', 'NOT_FOUND');
      expect(response.body).toHaveProperty('traceId');
    });
  });
});