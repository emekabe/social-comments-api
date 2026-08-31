/**
 * Instagram Graph API Client Interface & Mock Implementation
 */

export interface InstagramGraphComment {
  id: string;
  text: string;
  timestamp: string;
  username: string;
  like_count: number;
  from?: {
    id: string;
    username: string;
  };
  parent_id?: string;
  replies?: {
    data: InstagramGraphComment[];
  };
}

export interface InstagramApiClient {
  getMediaComments(mediaId: string, limit?: number): Promise<{ data: InstagramGraphComment[]; paging?: { cursors: { after: string } } }>;
  postCommentReply(commentId: string, message: string): Promise<InstagramGraphComment>;
}

export class MockInstagramApiClient implements InstagramApiClient {
  private commentStore = new Map<string, InstagramGraphComment[]>();

  constructor() {
    this.seedMockData();
  }

  private seedMockData() {
    const mediaId = 'ig_media_2001';
    const comments: InstagramGraphComment[] = [
      {
        id: 'ig_cmt_201',
        text: 'This visual aesthetic is stunning! What filter preset was used here? ✨',
        timestamp: new Date(Date.now() - 3600 * 1000 * 8).toISOString(),
        username: 'aesthetic_creator',
        like_count: 32,
        from: { id: 'usr_ig_1', username: 'aesthetic_creator' },
        replies: {
          data: [
            {
              id: 'ig_cmt_202',
              text: 'Custom Lightroom curve! Drop us a DM and we will send the preset bundle link 🎨',
              timestamp: new Date(Date.now() - 3600 * 1000 * 6).toISOString(),
              username: 'brand_studio',
              like_count: 5,
              parent_id: 'ig_cmt_201',
              from: { id: 'usr_ig_self', username: 'brand_studio' },
            },
          ],
        },
      },
      {
        id: 'ig_cmt_203',
        text: 'Ordered the new release yesterday. Can not wait for it to arrive! 🔥📦',
        timestamp: new Date(Date.now() - 3600 * 1000 * 3).toISOString(),
        username: 'marcus_fit',
        like_count: 11,
        from: { id: 'usr_ig_2', username: 'marcus_fit' },
      },
    ];

    this.commentStore.set(mediaId, comments);
  }

  async getMediaComments(mediaId: string, limit = 50): Promise<{ data: InstagramGraphComment[] }> {
    const comments = this.commentStore.get(mediaId) || [];
    return { data: comments.slice(0, limit) };
  }

  async postCommentReply(commentId: string, message: string): Promise<InstagramGraphComment> {
    const newReply: InstagramGraphComment = {
      id: `ig_cmt_${Date.now()}`,
      text: message,
      timestamp: new Date().toISOString(),
      username: 'brand_studio',
      like_count: 0,
      parent_id: commentId,
      from: { id: 'usr_ig_self', username: 'brand_studio' },
    };

    for (const list of this.commentStore.values()) {
      const parent = list.find((c) => c.id === commentId);
      if (parent) {
        if (!parent.replies) parent.replies = { data: [] };
        parent.replies.data.push(newReply);
        break;
      }
    }

    return newReply;
  }
}
