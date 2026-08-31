import { describe, it, expect } from 'vitest';
import { InstagramCommentAdapter } from '../../src/adapters/instagram/instagram.adapter.js';

describe('InstagramCommentAdapter', () => {
  it('should normalize Instagram Graph API comments and flatten nested replies', async () => {
    const adapter = new InstagramCommentAdapter();
    const result = await adapter.fetchComments({ platformPostId: 'ig_media_2001' });

    expect(result.comments.length).toBeGreaterThanOrEqual(2);

    const rootComment = result.comments.find((c) => c.platformCommentId === 'ig_cmt_201');
    expect(rootComment).toBeDefined();
    expect(rootComment?.platformParentCommentId).toBeNull();
    expect(rootComment?.author.username).toBe('aesthetic_creator');

    const subReply = result.comments.find((c) => c.platformCommentId === 'ig_cmt_202');
    expect(subReply).toBeDefined();
    expect(subReply?.platformParentCommentId).toBe('ig_cmt_201');
  });

  it('should post a reply on an Instagram comment', async () => {
    const adapter = new InstagramCommentAdapter();
    const reply = await adapter.postReply({
      platformPostId: 'ig_media_2001',
      platformCommentId: 'ig_cmt_201',
      content: 'Glad you loved the look!',
    });

    expect(reply.content).toBe('Glad you loved the look!');
    expect(reply.platformParentCommentId).toBe('ig_cmt_201');
  });
});
