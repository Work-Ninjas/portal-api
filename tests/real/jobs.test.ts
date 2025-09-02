import request from 'supertest';
import { createRealApp } from '../../src/app-real';

describe('Real Jobs Endpoints', () => {
  const app = createRealApp();
  const validToken = 'test_token_123';

  describe('GET /v1/jobs (RPC)', () => {
    it('should return jobs from RPC service with status mapping', async () => {
      const response = await request(app)
        .get('/v1/jobs')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('limit', 25);
      expect(response.body).toHaveProperty('offset', 0);
      expect(response.body).toHaveProperty('has_more');
      expect(Array.isArray(response.body.data)).toBe(true);

      // Check job structure matches API contract
      if (response.body.data.length > 0) {
        const job = response.body.data[0];
        expect(job).toHaveProperty('id');
        expect(job).toHaveProperty('title');
        expect(job).toHaveProperty('status');
        expect(job).toHaveProperty('status_updated_at');
        expect(job).toHaveProperty('priority');
        expect(job).toHaveProperty('contact_id');
        expect(job).toHaveProperty('created_at');
        expect(job).toHaveProperty('updated_at');

        // Verify canonical status values
        const validStatuses = [
          'open', 'scheduled', 'in_progress', 'blocked', 
          'awaiting_review', 'completed', 'canceled', 'archived'
        ];
        expect(validStatuses).toContain(job.status);

        // Verify priority mapping
        const validPriorities = ['low', 'medium', 'high', 'urgent'];
        expect(validPriorities).toContain(job.priority);

        // Check omit vs null policy for optional fields
        if (job.status_reason === undefined) {
          expect(job).not.toHaveProperty('status_reason');
        }
        if (job.scheduled_start === undefined) {
          expect(job).not.toHaveProperty('scheduled_start');
        }
      }
    });

    it('should filter jobs by status', async () => {
      const response = await request(app)
        .get('/v1/jobs?status=in_progress')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      
      // All returned jobs should have the requested status
      response.body.data.forEach((job: any) => {
        expect(job.status).toBe('in_progress');
      });
    });

    it('should handle blocked jobs with status_reason', async () => {
      const response = await request(app)
        .get('/v1/jobs?status=blocked')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      
      // Check if any blocked jobs have status_reason
      const blockedJobs = response.body.data.filter((job: any) => job.status === 'blocked');
      if (blockedJobs.length > 0) {
        const jobWithReason = blockedJobs.find((job: any) => job.status_reason);
        if (jobWithReason) {
          expect(typeof jobWithReason.status_reason).toBe('string');
          expect(jobWithReason.status_reason.length).toBeGreaterThan(0);
        }
      }
    });

    it('should handle completed jobs correctly', async () => {
      const response = await request(app)
        .get('/v1/jobs?status=completed')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      
      // All returned jobs should have completed status
      response.body.data.forEach((job: any) => {
        expect(job.status).toBe('completed');
      });
    });

    it('should support search functionality', async () => {
      const response = await request(app)
        .get('/v1/jobs?q=HVAC')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      
      // Results should be filtered by search term
      if (response.body.data.length > 0) {
        const job = response.body.data[0];
        expect(job.title.toLowerCase()).toContain('hvac');
      }
    });

    it('should validate status parameter', async () => {
      const response = await request(app)
        .get('/v1/jobs?status=invalid_status')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(422);

      expect(response.body).toHaveProperty('code', 'VALIDATION_FAILED');
      expect(response.body).toHaveProperty('errors');
      expect(response.body.errors).toContainEqual(
        expect.objectContaining({
          field: 'status',
          message: 'Invalid status value'
        })
      );
    });

    it('should respect pagination parameters', async () => {
      const response = await request(app)
        .get('/v1/jobs?limit=2&offset=0')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.limit).toBe(2);
      expect(response.body.offset).toBe(0);
      expect(response.body.data.length).toBeLessThanOrEqual(2);
    });
  });
});