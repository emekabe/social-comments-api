import { prisma } from '../db/client.js';
import { platformRegistry } from '../adapters/registry.js';
import { postService } from './post.service.js';
import { UnifiedComment, GetCommentsOptions, CreateReplyParams, PlatformType } from '../types/index.js';
import { NotFoundError, ValidationError } from '../errors/index.js';
import { buildCommentTree } from '../utils/tree.js';
import { NormalizedPlatformComment } from '../adapters/base.provider.js';

export class CommentService {
  /**
   * Retrieves comments for a published post.
   * 
   * Supports:
   * - source: 'sync' (default, fetches from platform, upserts to DB, returns unified tree/flat list)
   * - source: 'db' (retrieves locally cached comments only)
   * - source: 'live' (retrieves directly from platform adapter without writing to DB)
   * - view: 'tree' (default, hierarchical replies) vs 'flat' (chronological list)
   */
  async getComments(postId: string, options: GetCommentsOptions = {}): Promise<{ comments: UnifiedComment[]; total: number }> {
    const post = await postService.getPostById(postId);
    const view = options.view || 'tree';
    const source = options.source || 'sync';

    let unifiedComments: UnifiedComment[] = [];

    if (source === 'live') {
      const adapter = platformRegistry.get(post.platform);
      const fetchResult = await adapter.fetchComments({ platformPostId: post.platformPostId, limit: options.limit });
      
      unifiedComments = fetchResult.comments.map((c) => this.mapNormalizedToUnified(c, post.id, post.platform));
    } else if (source === 'sync') {
      const adapter = platformRegistry.get(post.platform);
      const fetchResult = await adapter.fetchComments({ platformPostId: post.platformPostId, limit: options.limit });

      // Synchronize comments to local DB (upsert)
      await this.syncPlatformCommentsToDb(post.id, post.platform, fetchResult.comments);

      // Query from DB to ensure internal IDs and relations are resolved
      unifiedComments = await this.getCommentsFromDb(post.id);
    } else {
      // source === 'db'
      unifiedComments = await this.getCommentsFromDb(post.id);
    }

    const total = unifiedComments.length;

    if (view === 'tree') {
      const tree = buildCommentTree(unifiedComments);
      return { comments: tree, total };
    }

    return { comments: unifiedComments, total };
  }

  /**
   * Post a reply to an existing comment
   */
  async createReply(params: CreateReplyParams): Promise<UnifiedComment> {
    const post = await postService.getPostById(params.postId);

    if (!params.content || params.content.trim().length === 0) {
      throw new ValidationError('Comment reply content cannot be empty');
    }

    // Find parent comment in DB
    const parentComment = await prisma.comment.findUnique({
      where: { id: params.commentId },
    });

    if (!parentComment || parentComment.postId !== post.id) {
      throw new NotFoundError('Comment', params.commentId);
    }

    const adapter = platformRegistry.get(post.platform);
    const capabilities = adapter.getCapabilities();

    // Check platform nesting constraints
    if (!capabilities.supportsNesting) {
      throw new ValidationError(`Platform '${post.platform}' does not support threaded replies.`);
    }

    if (capabilities.maxNestingDepth === 1 && parentComment.parentId) {
      throw new ValidationError(
        `Platform '${post.platform}' only supports single-level nesting. You cannot reply to a sub-reply.`
      );
    }

    // Delegate creation to platform adapter
    const platformReply = await adapter.postReply({
      platformPostId: post.platformPostId,
      platformCommentId: parentComment.platformCommentId,
      content: params.content.trim(),
    });

    // Save reply record to local DB with linkage
    const savedReply = await prisma.comment.upsert({
      where: {
        platform_platformCommentId_unique: {
          platform: post.platform,
          platformCommentId: platformReply.platformCommentId,
        },
      },
      create: {
        postId: post.id,
        platform: post.platform,
        platformCommentId: platformReply.platformCommentId,
        platformParentCommentId: parentComment.platformCommentId,
        parentId: parentComment.id,
        authorId: platformReply.author.id,
        authorName: platformReply.author.name,
        authorUsername: platformReply.author.username,
        authorAvatarUrl: platformReply.author.avatarUrl,
        content: platformReply.content,
        likeCount: platformReply.likeCount,
        replyCount: platformReply.replyCount,
        rawPayload: JSON.stringify(platformReply.rawPayload),
        platformCreatedAt: new Date(platformReply.platformCreatedAt),
      },
      update: {
        content: platformReply.content,
        rawPayload: JSON.stringify(platformReply.rawPayload),
      },
    });

    // Increment parent reply count in DB
    await prisma.comment.update({
      where: { id: parentComment.id },
      data: { replyCount: { increment: 1 } },
    }).catch(() => {});

    return this.mapDbRecordToUnified(savedReply);
  }

  /**
   * Synchronizes a batch of normalized platform comments into the local database
   */
  private async syncPlatformCommentsToDb(
    postId: string,
    platform: PlatformType,
    comments: NormalizedPlatformComment[]
  ): Promise<void> {
    // Step 1: Upsert all comments to guarantee existence
    for (const c of comments) {
      await prisma.comment.upsert({
        where: {
          platform_platformCommentId_unique: {
            platform,
            platformCommentId: c.platformCommentId,
          },
        },
        create: {
          postId,
          platform,
          platformCommentId: c.platformCommentId,
          platformParentCommentId: c.platformParentCommentId,
          authorId: c.author.id,
          authorName: c.author.name,
          authorUsername: c.author.username,
          authorAvatarUrl: c.author.avatarUrl,
          content: c.content,
          likeCount: c.likeCount,
          replyCount: c.replyCount,
          rawPayload: JSON.stringify(c.rawPayload),
          platformCreatedAt: new Date(c.platformCreatedAt),
        },
        update: {
          authorName: c.author.name,
          authorUsername: c.author.username,
          authorAvatarUrl: c.author.avatarUrl,
          content: c.content,
          likeCount: c.likeCount,
          replyCount: c.replyCount,
          rawPayload: JSON.stringify(c.rawPayload),
        },
      });
    }

    // Step 2: Link local parentId references for comments with platformParentCommentId
    const repliesToLink = comments.filter((c) => c.platformParentCommentId !== null);
    if (repliesToLink.length > 0) {
      const allDbComments = await prisma.comment.findMany({
        where: { postId },
        select: { id: true, platformCommentId: true },
      });

      const mapByPlatformId = new Map<string, string>();
      allDbComments.forEach((c) => mapByPlatformId.set(c.platformCommentId, c.id));

      for (const r of repliesToLink) {
        if (r.platformParentCommentId) {
          const parentDbId = mapByPlatformId.get(r.platformParentCommentId);
          if (parentDbId) {
            await prisma.comment.updateMany({
              where: {
                platform,
                platformCommentId: r.platformCommentId,
              },
              data: {
                parentId: parentDbId,
              },
            });
          }
        }
      }
    }
  }

  private async getCommentsFromDb(postId: string): Promise<UnifiedComment[]> {
    const dbComments = await prisma.comment.findMany({
      where: { postId },
      orderBy: { platformCreatedAt: 'asc' },
    });

    return dbComments.map((record) => this.mapDbRecordToUnified(record));
  }

  private mapDbRecordToUnified(record: {
    id: string;
    postId: string;
    platform: string;
    platformCommentId: string;
    platformParentCommentId: string | null;
    parentId: string | null;
    authorId: string;
    authorName: string;
    authorUsername: string | null;
    authorAvatarUrl: string | null;
    content: string;
    likeCount: number;
    replyCount: number;
    rawPayload: string;
    platformCreatedAt: Date;
    createdAt: Date;
    updatedAt: Date;
  }): UnifiedComment {
    let parsedPayload: Record<string, unknown> = {};
    try {
      parsedPayload = JSON.parse(record.rawPayload);
    } catch {
      parsedPayload = {};
    }

    return {
      id: record.id,
      postId: record.postId,
      platform: record.platform as PlatformType,
      platformCommentId: record.platformCommentId,
      platformParentCommentId: record.platformParentCommentId,
      parentId: record.parentId,
      author: {
        id: record.authorId,
        name: record.authorName,
        username: record.authorUsername || undefined,
        avatarUrl: record.authorAvatarUrl || undefined,
      },
      content: record.content,
      likeCount: record.likeCount,
      replyCount: record.replyCount,
      rawPayload: parsedPayload,
      platformCreatedAt: record.platformCreatedAt.toISOString(),
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  private mapNormalizedToUnified(
    c: NormalizedPlatformComment,
    postId: string,
    platform: PlatformType
  ): UnifiedComment {
    const now = new Date().toISOString();
    return {
      id: `live_${c.platformCommentId}`,
      postId,
      platform,
      platformCommentId: c.platformCommentId,
      platformParentCommentId: c.platformParentCommentId,
      parentId: null,
      author: c.author,
      content: c.content,
      likeCount: c.likeCount,
      replyCount: c.replyCount,
      rawPayload: c.rawPayload,
      platformCreatedAt: c.platformCreatedAt,
      createdAt: now,
      updatedAt: now,
    };
  }
}

export const commentService = new CommentService();
