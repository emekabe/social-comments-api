/**
 * Facebook Graph API Client Interface & Mock Implementation
 */

export interface FacebookCommentNode {
  id: string; // e.g. "fb_post_4001_fb_cmt_401"
  message: string;
  created_time: string;
  from: {
    id: string;
    name: string;
  };
  like_count?: number;
  comment_count?: number;
  parent?: {
    id: string;
  };
  comments?: {
    data: FacebookCommentNode[];
  };
}

export interface FacebookApiClient {
  getPostComments(postId: string, limit?: number): Promise<{ data: FacebookCommentNode[] }>;
  createReply(commentId: string, message: string): Promise<FacebookCommentNode>;
}

export class MockFacebookApiClient implements FacebookApiClient {
  private commentStore = new Map<string, FacebookCommentNode[]>();

  constructor() {
    this.seedMockData();
  }

  private seedMockData() {
    const postId = 'fb_post_4001';
    const comments: FacebookCommentNode[] = [
      {
        id: 'fb_cmt_401',
        message: 'Excited about the brand overhaul! Are the new templates accessible to Community edition users?',
        created_time: new Date(Date.now() - 3600 * 1000 * 14).toISOString(),
        from: { id: 'usr_fb_1', name: 'Sophia Miller' },
        like_count: 24,
        comment_count: 1,
        comments: {
          data: [
            {
              id: 'fb_cmt_402',
              message: 'Hi Sophia! Yes, standard tier templates are completely accessible in Community edition.',
              created_time: new Date(Date.now() - 3600 * 1000 * 11).toISOString(),
              from: { id: 'usr_fb_page', name: 'Product Marketing Team' },
              like_count: 6,
              parent: { id: 'fb_cmt_401' },
            },
          ],
        },
      },
      {
        id: 'fb_cmt_403',
        message: 'Shared this with our entire marketing team. Excellent work!',
        created_time: new Date(Date.now() - 3600 * 1000 * 5).toISOString(),
        from: { id: 'usr_fb_2', name: 'Daniel Brooks' },
        like_count: 15,
        comment_count: 0,
      },
    ];

    this.commentStore.set(postId, comments);
  }

  async getPostComments(postId: string, limit = 50): Promise<{ data: FacebookCommentNode[] }> {
    const list = this.commentStore.get(postId) || [];
    return { data: list.slice(0, limit) };
  }

  async createReply(commentId: string, message: string): Promise<FacebookCommentNode> {
    const replyId = `fb_cmt_${Date.now()}`;
    const newReply: FacebookCommentNode = {
      id: replyId,
      message,
      created_time: new Date().toISOString(),
      from: { id: 'usr_fb_page', name: 'Product Marketing Team' },
      like_count: 0,
      comment_count: 0,
      parent: { id: commentId },
    };

    for (const list of this.commentStore.values()) {
      const parent = list.find((c) => c.id === commentId);
      if (parent) {
        if (!parent.comments) parent.comments = { data: [] };
        parent.comments.data.push(newReply);
        break;
      }
    }

    return newReply;
  }
}
