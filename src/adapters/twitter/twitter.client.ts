/**
 * Twitter API v2 Types and Mock Client
 * 
 * In production, this client wraps Twitter's v2 REST API (e.g. via twitter-api-v2 SDK).
 * Here, we provide an in-memory mock client with realistic v2 data payloads that
 * makes testing and local evaluation frictionless.
 */

export interface TwitterUser {
  id: string;
  name: string;
  username: string;
  profile_image_url?: string;
}

export interface TwitterTweet {
  id: string;
  text: string;
  author_id: string;
  conversation_id: string;
  in_reply_to_user_id?: string;
  referenced_tweets?: Array<{
    type: 'replied_to' | 'quoted' | 'retweeted';
    id: string;
  }>;
  public_metrics: {
    retweet_count: number;
    reply_count: number;
    like_count: number;
    quote_count: number;
  };
  created_at: string;
}

export interface TwitterApiResponse {
  data: TwitterTweet[];
  includes?: {
    users?: TwitterUser[];
  };
  meta?: {
    result_count: number;
    next_token?: string;
  };
}

export interface TwitterApiClient {
  searchConversation(conversationId: string, limit?: number, nextToken?: string): Promise<TwitterApiResponse>;
  postReply(params: { inReplyToTweetId: string; text: string }): Promise<{ data: TwitterTweet; includes?: { users?: TwitterUser[] } }>;
}

/**
 * Mock Twitter API v2 Client for seamless local testing
 */
export class MockTwitterApiClient implements TwitterApiClient {
  private tweetStore = new Map<string, TwitterTweet[]>();
  private userStore = new Map<string, TwitterUser>();

  constructor() {
    this.seedMockData();
  }

  private seedMockData() {
    // Mock user database
    const users: TwitterUser[] = [
      { id: 'usr_tw_1', name: 'Sarah Connor', username: 'sarah_c', profile_image_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330' },
      { id: 'usr_tw_2', name: 'Alex Rivera', username: 'arivera_tech', profile_image_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d' },
      { id: 'usr_tw_3', name: 'Elena Rostova', username: 'elena_dev', profile_image_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb' },
      { id: 'usr_tw_self', name: 'Social Scheduler Bot', username: 'scheduler_app', profile_image_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe' },
    ];
    users.forEach((u) => this.userStore.set(u.id, u));

    // Seed mock tweets for Twitter post 'tw_post_1001'
    const conversationId = 'tw_post_1001';
    const comments: TwitterTweet[] = [
      {
        id: 'tw_cmt_101',
        text: 'Huge fan of this feature! Will this support automated webhook notifications too?',
        author_id: 'usr_tw_1',
        conversation_id: conversationId,
        public_metrics: { retweet_count: 2, reply_count: 1, like_count: 14, quote_count: 0 },
        created_at: new Date(Date.now() - 3600 * 1000 * 5).toISOString(),
      },
      {
        id: 'tw_cmt_102',
        text: 'Yes @sarah_c! Webhook event streaming is slated for the Q3 milestone.',
        author_id: 'usr_tw_2',
        conversation_id: conversationId,
        referenced_tweets: [{ type: 'replied_to', id: 'tw_cmt_101' }],
        public_metrics: { retweet_count: 0, reply_count: 0, like_count: 6, quote_count: 0 },
        created_at: new Date(Date.now() - 3600 * 1000 * 4).toISOString(),
      },
      {
        id: 'tw_cmt_103',
        text: 'Love the clean API interface. Keep up the amazing work team!',
        author_id: 'usr_tw_3',
        conversation_id: conversationId,
        public_metrics: { retweet_count: 1, reply_count: 0, like_count: 9, quote_count: 0 },
        created_at: new Date(Date.now() - 3600 * 1000 * 2).toISOString(),
      },
    ];

    this.tweetStore.set(conversationId, comments);
  }

  async searchConversation(conversationId: string, limit = 50): Promise<TwitterApiResponse> {
    const tweets = this.tweetStore.get(conversationId) || [];
    const sliced = tweets.slice(0, limit);
    const users = Array.from(this.userStore.values());

    return {
      data: sliced,
      includes: { users },
      meta: { result_count: sliced.length },
    };
  }

  async postReply(params: { inReplyToTweetId: string; text: string }): Promise<{ data: TwitterTweet; includes?: { users?: TwitterUser[] } }> {
    const newTweetId = `tw_cmt_${Date.now()}`;
    const botUser = this.userStore.get('usr_tw_self')!;

    const newTweet: TwitterTweet = {
      id: newTweetId,
      text: params.text,
      author_id: botUser.id,
      conversation_id: 'tw_post_1001',
      referenced_tweets: [{ type: 'replied_to', id: params.inReplyToTweetId }],
      public_metrics: { retweet_count: 0, reply_count: 0, like_count: 0, quote_count: 0 },
      created_at: new Date().toISOString(),
    };

    // Store in mock memory
    for (const [convId, list] of this.tweetStore.entries()) {
      if (list.some((t) => t.id === params.inReplyToTweetId) || convId === 'tw_post_1001') {
        list.push(newTweet);
        break;
      }
    }

    return {
      data: newTweet,
      includes: { users: [botUser] },
    };
  }
}
