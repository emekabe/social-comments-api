import { describe, it, expect } from 'vitest';
import { LinkedInCommentAdapter } from '../../src/adapters/linkedin/linkedin.adapter.js';

describe('LinkedInCommentAdapter', () => {
  it('should normalize LinkedIn URN structures and timestamps', async () => {
    const adapter = new LinkedInCommentAdapter();
    const result = await adapter.fetchComments({ platformPostId: 'li_act_3001' });

    expect(result.comments.length).toBeGreaterThanOrEqual(2);

    const rootComment = result.comments[0];
    expect(rootComment.author.name).toBe('David Chen');
    expect(rootComment.author.id).toBe('urn:li:person:david_chen');
    expect(rootComment.likeCount).toBe(18);

    const childComment = result.comments[1];
    expect(childComment.author.name).toBe('Chidi Nwosu');
    expect(childComment.platformParentCommentId).toContain('li_cmt_301');
  });

  it('should post a reply to a LinkedIn comment', async () => {
    const adapter = new LinkedInCommentAdapter();
    const reply = await adapter.postReply({
      platformPostId: 'li_act_3001',
      platformCommentId: 'urn:li:comment:(urn:li:activity:li_act_3001,li_cmt_301)',
      content: 'Appreciate the feedback, David!',
    });

    expect(reply.content).toBe('Appreciate the feedback, David!');
    expect(reply.platformParentCommentId).toBe('urn:li:comment:(urn:li:activity:li_act_3001,li_cmt_301)');
  });
});
