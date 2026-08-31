import { PlatformType } from '../types/index.js';

export interface PlatformCapabilities {
  supportsNesting: boolean;
  maxNestingDepth: number; // e.g. 1 for single-level replies (Instagram), Infinity for deep threads (Twitter/Reddit)
  maxCommentLength: number;
  supportsMarkdown: boolean;
  supportsMediaReplies: boolean;
}

export interface NormalizedPlatformComment {
  platformCommentId: string;
  platformParentCommentId: string | null;
  author: {
    id: string;
    name: string;
    username?: string;
    avatarUrl?: string;
  };
  content: string;
  likeCount: number;
  replyCount: number;
  platformCreatedAt: string; // ISO 8601 string
  rawPayload: Record<string, unknown>; // Preserves raw platform-native response
}

export interface FetchPlatformCommentsParams {
  platformPostId: string;
  limit?: number;
  cursor?: string;
}

export interface FetchPlatformCommentsResult {
  comments: NormalizedPlatformComment[];
  nextCursor?: string | null;
  rawResponse?: Record<string, unknown>;
}

export interface PostPlatformReplyParams {
  platformPostId: string;
  platformCommentId: string;
  content: string;
}

export interface PlatformHealthResult {
  healthy: boolean;
  latencyMs?: number;
  message?: string;
}

/**
 * Common Platform Comment Provider Interface (Strategy/Adapter Pattern)
 * 
 * Every social platform (Twitter/X, Instagram, LinkedIn, Facebook, etc.) implements this
 * interface. The core business logic interacts ONLY with this contract, decoupling platform-specific
 * SDKs, API quirks, and data structures from domain logic.
 */
export interface PlatformCommentProvider {
  /**
   * Unique platform identifier (e.g. 'twitter', 'instagram', 'linkedin', 'facebook')
   */
  getPlatformName(): PlatformType;

  /**
   * Describes platform capabilities and constraints (e.g. nesting depth, max character limits)
   */
  getCapabilities(): PlatformCapabilities;

  /**
   * Fetches and normalizes comments for a given published post on the platform.
   */
  fetchComments(params: FetchPlatformCommentsParams): Promise<FetchPlatformCommentsResult>;

  /**
   * Posts a reply to an existing comment on the native platform.
   */
  postReply(params: PostPlatformReplyParams): Promise<NormalizedPlatformComment>;

  /**
   * Checks connectivity and credentials for the platform API.
   */
  healthCheck?(): Promise<PlatformHealthResult>;
}
