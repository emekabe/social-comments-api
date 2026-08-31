import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { commentService } from '../../src/services/comment.service.js';
import { initializePlatformAdapters } from '../../src/adapters/index.js';
import { prisma } from '../../src/db/client.js';

describe('CommentService', () => {
  const testPostId = '00000000-0000-0000-0000-000000000001'; // Seeded Twitter post

  beforeAll(async () => {
    initializePlatformAdapters();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should retrieve comments in tree format by default', async () => {
    const result = await commentService.getComments(testPostId, { view: 'tree', source: 'sync' });

    expect(result.comments).toBeDefined();
    expect(result.total).toBeGreaterThanOrEqual(2);

    // Tree should group replies under root comment
    const root = result.comments.find((c) => c.platformCommentId === 'tw_cmt_101');
    expect(root).toBeDefined();
    expect(root?.replies).toBeDefined();
    expect(root?.replies?.length).toBeGreaterThanOrEqual(1);
    expect(root?.replies?.[0].platformCommentId).toBe('tw_cmt_102');
  });

  it('should retrieve flat comments when view=flat', async () => {
    const result = await commentService.getComments(testPostId, { view: 'flat', source: 'db' });

    expect(result.comments).toBeDefined();
    expect(result.total).toBeGreaterThanOrEqual(2);
    // Every comment in flat view should be at root array
    const allHaveNoDirectRepliesArray = result.comments.every((c) => !c.replies || c.replies.length === 0);
    expect(allHaveNoDirectRepliesArray).toBe(true);
  });

  it('should throw NotFoundError for non-existent post', async () => {
    await expect(
      commentService.getComments('non-existent-uuid', { view: 'tree' })
    ).rejects.toThrow(/not found/);
  });

  it('should create a reply and link it to the parent comment', async () => {
    const initialComments = await commentService.getComments(testPostId, { source: 'db' });
    const parent = initialComments.comments[0];

    const reply = await commentService.createReply({
      postId: testPostId,
      commentId: parent.id,
      content: 'Automated test reply from CommentService suite',
    });

    expect(reply.content).toBe('Automated test reply from CommentService suite');
    expect(reply.parentId).toBe(parent.id);
    expect(reply.platformParentCommentId).toBe(parent.platformCommentId);
  });
});
