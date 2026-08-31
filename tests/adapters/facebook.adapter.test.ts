import { describe, it, expect } from 'vitest';
import { FacebookCommentAdapter } from '../../src/adapters/facebook/facebook.adapter.js';

describe('FacebookCommentAdapter', () => {
  it('should normalize Facebook Graph nodes and sub-comments', async () => {
    const adapter = new FacebookCommentAdapter();
    const result = await adapter.fetchComments({ platformPostId: 'fb_post_4001' });

    expect(result.comments.length).toBeGreaterThanOrEqual(3);

    const rootComment = result.comments.find((c) => c.platformCommentId === 'fb_cmt_401');
    expect(rootComment).toBeDefined();
    expect(rootComment?.author.name).toBe('Sophia Miller');

    const subComment = result.comments.find((c) => c.platformCommentId === 'fb_cmt_402');
    expect(subComment).toBeDefined();
    expect(subComment?.platformParentCommentId).toBe('fb_cmt_401');
  });

  it('should post a reply on a Facebook comment', async () => {
    const adapter = new FacebookCommentAdapter();
    const reply = await adapter.postReply({
      platformPostId: 'fb_post_4001',
      platformCommentId: 'fb_cmt_401',
      content: 'Thanks for sharing with your community!',
    });

    expect(reply.content).toBe('Thanks for sharing with your community!');
    expect(reply.platformParentCommentId).toBe('fb_cmt_401');
  });
});
