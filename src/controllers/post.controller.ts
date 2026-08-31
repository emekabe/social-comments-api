import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { postService } from '../services/post.service.js';
import { ApiResponse, PostDomain } from '../types/index.js';

export const listPostsSchema = {
  query: z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(50),
  }),
};

export const getPostSchema = {
  params: z.object({
    postId: z.string().min(1, 'Post ID is required'),
  }),
};

export async function listPosts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;

    const { posts, total } = await postService.listPosts(page, limit);

    const response: ApiResponse<PostDomain[]> = {
      success: true,
      data: posts,
      meta: {
        total,
        page,
        limit,
        hasMore: page * limit < total,
      },
    };

    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
}

export async function getPost(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const postId = req.params.postId;
    const post = await postService.getPostById(postId);

    const response: ApiResponse<PostDomain> = {
      success: true,
      data: post,
    };

    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
}
