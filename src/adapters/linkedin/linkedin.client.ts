/**
 * LinkedIn Community Management API Client Interface & Mock Implementation
 */

export interface LinkedInCommentObject {
  $URN: string; // e.g. "urn:li:comment:(urn:li:activity:li_act_3001,li_cmt_301)"
  actor: string; // e.g. "urn:li:person:usr_li_1"
  actorName: string;
  actorHeadline?: string;
  message: {
    text: string;
  };
  created: {
    time: number; // Milliseconds timestamp
    actor: string;
  };
  parentComment?: string;
  likesSummary?: {
    totalLikes: number;
  };
  commentsSummary?: {
    totalComments: number;
  };
}

export interface LinkedInApiClient {
  getActivityComments(activityUrn: string, limit?: number): Promise<{ elements: LinkedInCommentObject[] }>;
  createComment(activityUrn: string, text: string, parentCommentUrn?: string): Promise<LinkedInCommentObject>;
}

export class MockLinkedInApiClient implements LinkedInApiClient {
  private commentStore = new Map<string, LinkedInCommentObject[]>();

  constructor() {
    this.seedMockData();
  }

  private seedMockData() {
    const activityUrn = 'urn:li:activity:li_act_3001';
    const comments: LinkedInCommentObject[] = [
      {
        $URN: 'urn:li:comment:(urn:li:activity:li_act_3001,li_cmt_301)',
        actor: 'urn:li:person:david_chen',
        actorName: 'David Chen',
        actorHeadline: 'VP of Engineering @ CloudScale | Distributed Systems Enthusiast',
        message: { text: 'Insightful breakdown on API design patterns. How do you handle idempotency at scale with high concurrency?' },
        created: { time: Date.now() - 3600 * 1000 * 12, actor: 'urn:li:person:david_chen' },
        likesSummary: { totalLikes: 18 },
        commentsSummary: { totalComments: 1 },
      },
      {
        $URN: 'urn:li:comment:(urn:li:activity:li_act_3001,li_cmt_302)',
        actor: 'urn:li:person:chidi_nwosu',
        actorName: 'Chidi Nwosu',
        actorHeadline: 'Staff Architect @ DistributedTech',
        message: { text: 'Great question David! We employ distributed Redis locks keyed by Idempotency-Key paired with atomic database state transitions.' },
        created: { time: Date.now() - 3600 * 1000 * 10, actor: 'urn:li:person:chidi_nwosu' },
        parentComment: 'urn:li:comment:(urn:li:activity:li_act_3001,li_cmt_301)',
        likesSummary: { totalLikes: 8 },
        commentsSummary: { totalComments: 0 },
      },
    ];

    this.commentStore.set(activityUrn, comments);
  }

  async getActivityComments(activityUrn: string, limit = 50): Promise<{ elements: LinkedInCommentObject[] }> {
    const list = this.commentStore.get(activityUrn) || [];
    return { elements: list.slice(0, limit) };
  }

  async createComment(activityUrn: string, text: string, parentCommentUrn?: string): Promise<LinkedInCommentObject> {
    const cmtId = `li_cmt_${Date.now()}`;
    const newComment: LinkedInCommentObject = {
      $URN: `urn:li:comment:(${activityUrn},${cmtId})`,
      actor: 'urn:li:person:current_user',
      actorName: 'Engineering Lead',
      actorHeadline: 'Author',
      message: { text },
      created: { time: Date.now(), actor: 'urn:li:person:current_user' },
      parentComment: parentCommentUrn,
      likesSummary: { totalLikes: 0 },
      commentsSummary: { totalComments: 0 },
    };

    const list = this.commentStore.get(activityUrn) || [];
    list.push(newComment);
    this.commentStore.set(activityUrn, list);

    return newComment;
  }
}
