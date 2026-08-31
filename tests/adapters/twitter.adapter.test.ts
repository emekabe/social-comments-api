import { describe, it, expect } from 'vitest';
import { TwitterCommentAdapter } from '../../src/adapters/twitter/twitter.adapter.js';
import { TwitterApiClient, TwitterApiResponse } from '../../src/adapters/twitter/twitter.client.js';

describe('TwitterCommentAdapter', () => {
  it('should normalize Twitter API v2 tweets and resolve authors from includes', async () => {
    const mockClient: TwitterApiClient = {
      searchConversation: async () => {
        const response: TwitterApiResponse = {
          data: [
            {
              id: 'tw_1',
              text: 'Hello world',
              author_id: 'usr_1',
              conversation_id: 'conv_1',
              public_metrics: { retweet_count: 0, reply_count: 1, like_count: 5, quote_count: 0 },
              created_at: '2026-08-30T10:00:00Z',
            },
            {
              id: 'tw_2',
              text: 'Nice tweet!',
              author_id: 'usr_2',
              conversation_id: 'conv_1',
              referenced_tweets: [{ type: 'replied_to', id: 'tw_1' }],
              public_metrics: { retweet_count: 0, reply_count: 0, like_count: 2, quote_count: 0 },
              created_at: '2026-08-30T10:05:00Z',
            },
          ],
          includes: {
            users: [
              { id: 'usr_1', name: 'Alice', username: 'alice_w', profile_image_url: 'https://avatar/1' },
              { id: 'usr_2', name: 'Bob', username: 'bob_b' },
            ],
          },
        };
        return response;
      },
      postReply: async () => {
        throw new Error('Not implemented');
      },
    };

    const adapter = new TwitterCommentAdapter(mockClient);
    const result = await adapter.fetchComments({ platformPostId: 'conv_1' });

    expect(result.comments).toHaveLength(2);

    const [comment1, comment2] = result.comments;
    expect(comment1.platformCommentId).toBe('tw_1');
    expect(comment1.platformParentCommentId).toBeNull();
    expect(comment1.author.name).toBe('Alice');
    expect(comment1.author.username).toBe('alice_w');
    expect(comment1.likeCount).toBe(5);

    expect(comment2.platformCommentId).toBe('tw_2');
    expect(comment2.platformParentCommentId).toBe('tw_1');
    expect(comment2.author.name).toBe('Bob');
    expect(comment2.likeCount).toBe(2);
  });

  it('should reject replies exceeding 280 characters', async () => {
    const adapter = new TwitterCommentAdapter();
    const longContent = 'A'.repeat(281);

    await expect(
      adapter.postReply({
        platformPostId: 'tw_post_1001',
        platformCommentId: 'tw_cmt_101',
        content: longContent,
      })
    ).rejects.toThrow(/exceeds maximum character length/);
  });

  it('should successfully post reply via mock client', async () => {
    const adapter = new TwitterCommentAdapter();
    const reply = await adapter.postReply({
      platformPostId: 'tw_post_1001',
      platformCommentId: 'tw_cmt_101',
      content: 'This is a test reply',
    });

    expect(reply.content).toBe('This is a test reply');
    expect(reply.platformParentCommentId).toBe('tw_cmt_101');
    expect(reply.platformCommentId).toBeDefined();
  });
});
