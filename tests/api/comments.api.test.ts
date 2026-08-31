import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db/client.js';

describe('Social Comments REST API (E2E Integration)', () => {
  const app = createApp();
  const twitterPostId = '00000000-0000-0000-0000-000000000001';

  beforeAll(async () => {
    // Ensure DB is ready
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('GET /api/v1/health', () => {
    it('should return 200 OK with service status', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.timestamp).toBeDefined();
    });
  });

  describe('GET /api/v1/platforms', () => {
    it('should list all supported platforms and their capabilities', async () => {
      const res = await request(app).get('/api/v1/platforms');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(4);

      const platforms = res.body.data.map((p: { platform: string }) => p.platform);
      expect(platforms).toContain('twitter');
      expect(platforms).toContain('instagram');
      expect(platforms).toContain('linkedin');
      expect(platforms).toContain('facebook');
    });
  });

  describe('GET /api/v1/posts', () => {
    it('should list scheduled and published posts', async () => {
      const res = await request(app).get('/api/v1/posts');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(4);
      expect(res.body.meta.total).toBeGreaterThanOrEqual(4);
    });

    it('should retrieve a specific post by ID', async () => {
      const res = await request(app).get(`/api/v1/posts/${twitterPostId}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(twitterPostId);
      expect(res.body.data.platform).toBe('twitter');
    });
  });

  describe('GET /api/v1/posts/:postId/comments', () => {
    it('should retrieve comments in threaded tree view by default', async () => {
      const res = await request(app).get(`/api/v1/posts/${twitterPostId}/comments`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.meta.view).toBe('tree');
      expect(Array.isArray(res.body.data)).toBe(true);

      const rootComment = res.body.data.find(
        (c: { platformCommentId: string }) => c.platformCommentId === 'tw_cmt_101'
      );
      expect(rootComment).toBeDefined();
      expect(rootComment.replies.length).toBeGreaterThanOrEqual(1);
    });

    it('should retrieve flat comments when view=flat', async () => {
      const res = await request(app).get(`/api/v1/posts/${twitterPostId}/comments?view=flat`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.meta.view).toBe('flat');
    });

    it('should return 404 for non-existent post', async () => {
      const res = await request(app).get('/api/v1/posts/non-existent-id/comments');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('POST /api/v1/posts/:postId/comments/:commentId/replies', () => {
    it('should post a reply to an existing comment', async () => {
      const commentsRes = await request(app).get(`/api/v1/posts/${twitterPostId}/comments?view=flat`);
      const parentComment = commentsRes.body.data[0];

      const res = await request(app)
        .post(`/api/v1/posts/${twitterPostId}/comments/${parentComment.id}/replies`)
        .send({
          content: 'Replying to comment from integration test',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.content).toBe('Replying to comment from integration test');
      expect(res.body.data.parentId).toBe(parentComment.id);
    });

    it('should enforce idempotency when Idempotency-Key header is provided', async () => {
      const commentsRes = await request(app).get(`/api/v1/posts/${twitterPostId}/comments?view=flat`);
      const parentComment = commentsRes.body.data[0];
      const idempotencyKey = `idem_test_${Date.now()}`;

      // First Request
      const res1 = await request(app)
        .post(`/api/v1/posts/${twitterPostId}/comments/${parentComment.id}/replies`)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          content: 'Idempotency test reply message',
        });

      expect(res1.status).toBe(201);
      expect(res1.headers['x-cache-lookup']).toBe('MISS');
      const createdId = res1.body.data.id;

      // Duplicate Request with same key and body
      const res2 = await request(app)
        .post(`/api/v1/posts/${twitterPostId}/comments/${parentComment.id}/replies`)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          content: 'Idempotency test reply message',
        });

      expect(res2.status).toBe(201);
      expect(res2.headers['x-cache-lookup']).toBe('HIT');
      expect(res2.body.data.id).toBe(createdId);
      expect(res2.body.data.content).toBe('Idempotency test reply message');
    });

    it('should reject request when body validation fails (empty content)', async () => {
      const commentsRes = await request(app).get(`/api/v1/posts/${twitterPostId}/comments?view=flat`);
      const parentComment = commentsRes.body.data[0];

      const res = await request(app)
        .post(`/api/v1/posts/${twitterPostId}/comments/${parentComment.id}/replies`)
        .send({
          content: '',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
