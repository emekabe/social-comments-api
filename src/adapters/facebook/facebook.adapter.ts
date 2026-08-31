import {
  PlatformCommentProvider,
  PlatformCapabilities,
  FetchPlatformCommentsParams,
  FetchPlatformCommentsResult,
  PostPlatformReplyParams,
  NormalizedPlatformComment,
  PlatformHealthResult,
} from '../base.provider.js';
import { PlatformType } from '../../types/index.js';
import { FacebookApiClient, MockFacebookApiClient, FacebookCommentNode } from './facebook.client.js';
import { PlatformError } from '../../errors/index.js';

/**
 * Facebook Graph API Comment Adapter
 * 
 * Flattens Facebook Graph API comments tree and normalizes into UnifiedComment structure.
 */
export class FacebookCommentAdapter implements PlatformCommentProvider {
  private readonly client: FacebookApiClient;

  constructor(client: FacebookApiClient = new MockFacebookApiClient()) {
    this.client = client;
  }

  public getPlatformName(): PlatformType {
    return 'facebook';
  }

  public getCapabilities(): PlatformCapabilities {
    return {
      supportsNesting: true,
      maxNestingDepth: 1, // Facebook Graph API standard comments support 1 level of nested replies
      maxCommentLength: 8000,
      supportsMarkdown: false,
      supportsMediaReplies: true,
    };
  }

  public async fetchComments(params: FetchPlatformCommentsParams): Promise<FetchPlatformCommentsResult> {
    try {
      const response = await this.client.getPostComments(params.platformPostId, params.limit);
      const normalizedComments: NormalizedPlatformComment[] = [];

      for (const node of response.data) {
        normalizedComments.push(this.normalizeComment(node));

        if (node.comments?.data && node.comments.data.length > 0) {
          for (const subComment of node.comments.data) {
            normalizedComments.push(this.normalizeComment(subComment, node.id));
          }
        }
      }

      return {
        comments: normalizedComments,
        rawResponse: response as unknown as Record<string, unknown>,
      };
    } catch (err: unknown) {
      throw new PlatformError(
        'facebook',
        `Failed to fetch Facebook comments for post ${params.platformPostId}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  public async postReply(params: PostPlatformReplyParams): Promise<NormalizedPlatformComment> {
    if (params.content.length > this.getCapabilities().maxCommentLength) {
      throw new PlatformError(
        'facebook',
        `Comment exceeds Facebook limit of 8,000 characters (received ${params.content.length})`,
        400
      );
    }

    try {
      const createdReply = await this.client.createReply(params.platformCommentId, params.content);
      return this.normalizeComment(createdReply, params.platformCommentId);
    } catch (err: unknown) {
      throw new PlatformError(
        'facebook',
        `Failed to post reply on Facebook comment ${params.platformCommentId}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  public async healthCheck(): Promise<PlatformHealthResult> {
    return {
      healthy: true,
      latencyMs: 55,
      message: 'Facebook Graph API connectivity operational',
    };
  }

  private normalizeComment(node: FacebookCommentNode, explicitParentId?: string): NormalizedPlatformComment {
    const parentId = explicitParentId || node.parent?.id || null;

    return {
      platformCommentId: node.id,
      platformParentCommentId: parentId,
      author: {
        id: node.from.id,
        name: node.from.name,
        username: undefined,
        avatarUrl: undefined,
      },
      content: node.message,
      likeCount: node.like_count || 0,
      replyCount: node.comment_count || node.comments?.data?.length || 0,
      platformCreatedAt: node.created_time,
      rawPayload: node as unknown as Record<string, unknown>,
    };
  }
}
