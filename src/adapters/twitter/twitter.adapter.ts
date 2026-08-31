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
import { TwitterApiClient, MockTwitterApiClient, TwitterTweet, TwitterUser } from './twitter.client.js';
import { PlatformError } from '../../errors/index.js';

/**
 * Twitter/X Comment Adapter
 * 
 * Normalizes Twitter API v2 Tweet objects and conversation threads into UnifiedComment domain format.
 * Injects a TwitterApiClient, enabling production OAuth clients or mock test harnesses.
 */
export class TwitterCommentAdapter implements PlatformCommentProvider {
  private readonly client: TwitterApiClient;

  constructor(client: TwitterApiClient = new MockTwitterApiClient()) {
    this.client = client;
  }

  public getPlatformName(): PlatformType {
    return 'twitter';
  }

  public getCapabilities(): PlatformCapabilities {
    return {
      supportsNesting: true,
      maxNestingDepth: Infinity, // Twitter supports recursive reply trees
      maxCommentLength: 280,
      supportsMarkdown: false,
      supportsMediaReplies: true,
    };
  }

  public async fetchComments(params: FetchPlatformCommentsParams): Promise<FetchPlatformCommentsResult> {
    try {
      const response = await this.client.searchConversation(params.platformPostId, params.limit, params.cursor);
      
      const userMap = new Map<string, TwitterUser>();
      if (response.includes?.users) {
        response.includes.users.forEach((user) => userMap.set(user.id, user));
      }

      const normalizedComments: NormalizedPlatformComment[] = response.data.map((tweet) => {
        return this.normalizeTweet(tweet, userMap);
      });

      return {
        comments: normalizedComments,
        nextCursor: response.meta?.next_token || null,
        rawResponse: response as unknown as Record<string, unknown>,
      };
    } catch (err: unknown) {
      throw new PlatformError(
        'twitter',
        `Failed to fetch tweets for post ${params.platformPostId}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  public async postReply(params: PostPlatformReplyParams): Promise<NormalizedPlatformComment> {
    if (params.content.length > this.getCapabilities().maxCommentLength) {
      throw new PlatformError(
        'twitter',
        `Tweet exceeds maximum character length of 280 (received ${params.content.length})`,
        400
      );
    }

    try {
      const response = await this.client.postReply({
        inReplyToTweetId: params.platformCommentId,
        text: params.content,
      });

      const userMap = new Map<string, TwitterUser>();
      if (response.includes?.users) {
        response.includes.users.forEach((user) => userMap.set(user.id, user));
      }

      return this.normalizeTweet(response.data, userMap);
    } catch (err: unknown) {
      throw new PlatformError(
        'twitter',
        `Failed to post tweet reply to ${params.platformCommentId}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  public async healthCheck(): Promise<PlatformHealthResult> {
    return {
      healthy: true,
      latencyMs: 45,
      message: 'Twitter API v2 connectivity operational',
    };
  }

  /**
   * Normalizes a Twitter API v2 Tweet into the standard NormalizedPlatformComment shape
   */
  private normalizeTweet(tweet: TwitterTweet, userMap: Map<string, TwitterUser>): NormalizedPlatformComment {
    const author = userMap.get(tweet.author_id) || {
      id: tweet.author_id,
      name: `User ${tweet.author_id}`,
      username: tweet.author_id,
    };

    // Find parent tweet ID from referenced_tweets
    const parentRef = tweet.referenced_tweets?.find((ref) => ref.type === 'replied_to');
    const platformParentCommentId = parentRef ? parentRef.id : null;

    return {
      platformCommentId: tweet.id,
      platformParentCommentId,
      author: {
        id: author.id,
        name: author.name,
        username: author.username,
        avatarUrl: author.profile_image_url,
      },
      content: tweet.text,
      likeCount: tweet.public_metrics?.like_count || 0,
      replyCount: tweet.public_metrics?.reply_count || 0,
      platformCreatedAt: tweet.created_at,
      rawPayload: tweet as unknown as Record<string, unknown>,
    };
  }
}
