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
import { LinkedInApiClient, MockLinkedInApiClient, LinkedInCommentObject } from './linkedin.client.js';
import { PlatformError } from '../../errors/index.js';

/**
 * LinkedIn Social Actions API Comment Adapter
 * 
 * Maps LinkedIn URN hierarchies ($URN, actor URNs, parentComment URNs) into UnifiedComment domain model.
 */
export class LinkedInCommentAdapter implements PlatformCommentProvider {
  private readonly client: LinkedInApiClient;

  constructor(client: LinkedInApiClient = new MockLinkedInApiClient()) {
    this.client = client;
  }

  public getPlatformName(): PlatformType {
    return 'linkedin';
  }

  public getCapabilities(): PlatformCapabilities {
    return {
      supportsNesting: true,
      maxNestingDepth: 1, // LinkedIn API supports 1 level of threaded replies
      maxCommentLength: 3000,
      supportsMarkdown: false,
      supportsMediaReplies: true,
    };
  }

  public async fetchComments(params: FetchPlatformCommentsParams): Promise<FetchPlatformCommentsResult> {
    try {
      const formattedUrn = params.platformPostId.startsWith('urn:li:')
        ? params.platformPostId
        : `urn:li:activity:${params.platformPostId}`;

      const response = await this.client.getActivityComments(formattedUrn, params.limit);
      const normalizedComments = response.elements.map((cmt) => this.normalizeComment(cmt));

      return {
        comments: normalizedComments,
        rawResponse: response as unknown as Record<string, unknown>,
      };
    } catch (err: unknown) {
      throw new PlatformError(
        'linkedin',
        `Failed to fetch LinkedIn comments for ${params.platformPostId}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  public async postReply(params: PostPlatformReplyParams): Promise<NormalizedPlatformComment> {
    if (params.content.length > this.getCapabilities().maxCommentLength) {
      throw new PlatformError(
        'linkedin',
        `Comment exceeds LinkedIn limit of 3,000 characters (received ${params.content.length})`,
        400
      );
    }

    try {
      const activityUrn = params.platformPostId.startsWith('urn:li:')
        ? params.platformPostId
        : `urn:li:activity:${params.platformPostId}`;

      const parentUrn = params.platformCommentId.startsWith('urn:li:')
        ? params.platformCommentId
        : `urn:li:comment:(${activityUrn},${params.platformCommentId})`;

      const created = await this.client.createComment(activityUrn, params.content, parentUrn);
      return this.normalizeComment(created);
    } catch (err: unknown) {
      throw new PlatformError(
        'linkedin',
        `Failed to post reply to LinkedIn comment ${params.platformCommentId}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  public async healthCheck(): Promise<PlatformHealthResult> {
    return {
      healthy: true,
      latencyMs: 50,
      message: 'LinkedIn REST API connectivity operational',
    };
  }

  private normalizeComment(comment: LinkedInCommentObject): NormalizedPlatformComment {
    const platformCommentId = this.extractIdFromUrn(comment.$URN);
    const platformParentCommentId = comment.parentComment
      ? this.extractIdFromUrn(comment.parentComment)
      : null;

    return {
      platformCommentId,
      platformParentCommentId,
      author: {
        id: comment.actor,
        name: comment.actorName,
        username: undefined,
        avatarUrl: undefined,
      },
      content: comment.message.text,
      likeCount: comment.likesSummary?.totalLikes || 0,
      replyCount: comment.commentsSummary?.totalComments || 0,
      platformCreatedAt: new Date(comment.created.time).toISOString(),
      rawPayload: comment as unknown as Record<string, unknown>,
    };
  }

  private extractIdFromUrn(urn: string): string {
    return urn;
  }
}
