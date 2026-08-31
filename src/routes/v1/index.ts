import { Router } from 'express';
import { listPlatforms } from '../../controllers/platform.controller.js';
import { listPosts, getPost, listPostsSchema, getPostSchema } from '../../controllers/post.controller.js';
import {
  getComments,
  createReply,
  getCommentsSchema,
  createReplySchema,
} from '../../controllers/comment.controller.js';
import { validateRequest } from '../../middleware/validation.middleware.js';
import { idempotencyMiddleware } from '../../middleware/idempotency.middleware.js';

const router = Router();

/**
 * Health Check Endpoint
 */
router.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/**
 * Platform Endpoints
 */
router.get('/platforms', listPlatforms);

/**
 * Post Endpoints
 */
router.get('/posts', validateRequest(listPostsSchema), listPosts);
router.get('/posts/:postId', validateRequest(getPostSchema), getPost);

/**
 * Comment Endpoints
 */
router.get('/posts/:postId/comments', validateRequest(getCommentsSchema), getComments);
router.post(
  '/posts/:postId/comments/:commentId/replies',
  idempotencyMiddleware(),
  validateRequest(createReplySchema),
  createReply
);

export default router;
