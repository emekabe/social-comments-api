import { prisma } from '../db/client.js';
import { PostDomain, PlatformType } from '../types/index.js';
import { NotFoundError } from '../errors/index.js';

export class PostService {
  /**
   * Retrieve a post by internal UUID
   */
  async getPostById(id: string): Promise<PostDomain> {
    const post = await prisma.post.findUnique({
      where: { id },
    });

    if (!post) {
      throw new NotFoundError('Post', id);
    }

    return this.mapToDomain(post);
  }

  /**
   * Retrieve a post by platform and external native platform post ID
   */
  async getPostByPlatformId(platform: PlatformType, platformPostId: string): Promise<PostDomain | null> {
    const post = await prisma.post.findUnique({
      where: {
        platform_platformPostId_unique: {
          platform,
          platformPostId,
        },
      },
    });

    return post ? this.mapToDomain(post) : null;
  }

  /**
   * List all posts with pagination
   */
  async listPosts(page = 1, limit = 50): Promise<{ posts: PostDomain[]; total: number }> {
    const skip = (page - 1) * limit;
    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.post.count(),
    ]);

    return {
      posts: posts.map((p) => this.mapToDomain(p)),
      total,
    };
  }

  private mapToDomain(post: {
    id: string;
    platform: string;
    platformPostId: string;
    content: string;
    scheduledAt: Date | null;
    publishedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): PostDomain {
    return {
      id: post.id,
      platform: post.platform as PlatformType,
      platformPostId: post.platformPostId,
      content: post.content,
      scheduledAt: post.scheduledAt ? post.scheduledAt.toISOString() : null,
      publishedAt: post.publishedAt ? post.publishedAt.toISOString() : null,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
    };
  }
}

export const postService = new PostService();
