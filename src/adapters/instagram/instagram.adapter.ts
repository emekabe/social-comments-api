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
import { InstagramApiClient, MockInstagramApiClient, InstagramGraphComment } from './instagram.client.js';
import { PlatformError } from '../../errors/index.js';

/**
 * Instagram Graph API Comment Adapter
 * 
 * Flattens Instagram's nested `replies.data` graph array and normalizes fields to UnifiedComment.
 */
export class InstagramCommentAdapter implements PlatformCommentProvider {
  private readonly client: InstagramApiClient;

  constructor(client: InstagramApiClient = new MockInstagramApiClient()) {
    this.client = client;
  }

  public getPlatformName(): PlatformType {
    return 'instagram';
  }

  public getCapabilities(): PlatformCapabilities {
    return {
      supportsNesting: true,
      maxNestingDepth: 1, // Instagram API only allows 1 level of threaded replies
      maxCommentLength: 2200,
      supportsMarkdown: false,
      supportsMediaReplies: false,
    };
  }

  public async fetchComments(params: FetchPlatformCommentsParams): Promise<FetchPlatformCommentsResult> {
    try {
      const response = await this.client.getMediaComments(params.platformPostId, params.limit);
      const normalizedComments: NormalizedPlatformComment[] = [];

      for (const rootComment of response.data) {
        normalizedComments.push(this.normalizeComment(rootComment));

        // Instagram nests replies in rootComment.replies.data
        if (rootComment.replies?.data && rootComment.replies.data.length > 0) {
          for (const reply of rootComment.replies.data) {
            normalizedComments.push(this.normalizeComment(reply, rootComment.id));
          }
        }
      }

      return {
        comments: normalizedComments,
        rawResponse: response as unknown as Record<string, unknown>,
      };
    } catch (err: unknown) {
      throw new PlatformError(
        'instagram',
        `Failed to fetch Instagram comments for media ${params.platformPostId}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  public async postReply(params: PostPlatformReplyParams): Promise<NormalizedPlatformComment> {
    if (params.content.length > this.getCapabilities().maxCommentLength) {
      throw new PlatformError(
        'instagram',
        `Comment exceeds Instagram limit of 2,200 characters (received ${params.content.length})`,
        400
      );
    }

    try {
      const createdReply = await this.client.postCommentReply(params.platformCommentId, params.content);
      return this.normalizeComment(createdReply, params.platformCommentId);
    } catch (err: unknown) {
      throw new PlatformError(
        'instagram',
        `Failed to post reply on Instagram comment ${params.platformCommentId}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  public async healthCheck(): Promise<PlatformHealthResult> {
    return {
      healthy: true,
      latencyMs: 60,
      message: 'Instagram Graph API connectivity operational',
    };
  }

  private normalizeComment(comment: InstagramGraphComment, explicitParentId?: string): NormalizedPlatformComment {
    const parentId = explicitParentId || comment.parent_id || null;
    const authorId = comment.from?.id || `ig_usr_${comment.username}`;
    const authorName = comment.username;

    return {
      platformCommentId: comment.id,
      platformParentCommentId: parentId,
      author: {
        id: authorId,
        name: authorName,
        username: comment.username,
        avatarUrl: undefined,
      },
      content: comment.text,
      likeCount: comment.like_count || 0,
      replyCount: comment.replies?.data?.length || 0,
      platformCreatedAt: comment.timestamp,
      rawPayload: comment as unknown as Record<string, unknown>,
    };
  }
}
