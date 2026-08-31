/**
 * Core Domain Types and Interfaces for Social Comments API
 */

export type PlatformType = 'twitter' | 'instagram' | 'linkedin' | 'facebook' | (string & {});

/**
 * Normalized representation of a comment author across all platforms
 */
export interface CommentAuthor {
  id: string;
  name: string;
  username?: string;
  avatarUrl?: string;
}

/**
 * Normalized domain model for a social media comment.
 * Preserves raw platform payload in `rawPayload` for auditing and platform-specific feature extraction.
 */
export interface UnifiedComment {
  id: string;
  postId: string;
  platform: PlatformType;
  platformCommentId: string;
  platformParentCommentId: string | null;
  parentId: string | null;
  author: CommentAuthor;
  content: string;
  likeCount: number;
  replyCount: number;
  rawPayload: Record<string, unknown>;
  platformCreatedAt: string; // ISO 8601 string
  createdAt: string;
  updatedAt: string;
  replies?: UnifiedComment[];
}

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    hasMore?: boolean;
    nextCursor?: string | null;
    platform?: PlatformType;
    view?: 'tree' | 'flat';
    source?: 'sync' | 'db' | 'live';
  };
}

/**
 * Standard API error structure
 */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    timestamp: string;
  };
}

/**
 * Options for retrieving comments
 */
export interface GetCommentsOptions {
  view?: 'tree' | 'flat';
  source?: 'sync' | 'db' | 'live';
  page?: number;
  limit?: number;
}

/**
 * Parameters for creating a reply
 */
export interface CreateReplyParams {
  postId: string;
  commentId: string;
  content: string;
  idempotencyKey?: string;
}

/**
 * Post domain model
 */
export interface PostDomain {
  id: string;
  platform: PlatformType;
  platformPostId: string;
  content: string;
  scheduledAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
