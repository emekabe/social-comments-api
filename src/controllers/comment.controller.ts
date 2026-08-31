import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { commentService } from '../services/comment.service.js';
import { ApiResponse, UnifiedComment } from '../types/index.js';

export const getCommentsSchema = {
  params: z.object({
    postId: z.string().min(1, 'Post ID is required'),
  }),
  query: z.object({
    view: z.enum(['tree', 'flat']).optional().default('tree'),
    source: z.enum(['sync', 'db', 'live']).optional().default('sync'),
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(50),
  }),
};

export const createReplySchema = {
  params: z.object({
    postId: z.string().min(1, 'Post ID is required'),
    commentId: z.string().min(1, 'Comment ID is required'),
  }),
  body: z.object({
    content: z.string().min(1, 'Reply content cannot be empty').max(8000, 'Reply content exceeds max length of 8000 characters'),
  }),
};

export async function getComments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const postId = req.params.postId;
    const view = (req.query.view as 'tree' | 'flat') || 'tree';
    const source = (req.query.source as 'sync' | 'db' | 'live') || 'sync';
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;

    const { comments, total } = await commentService.getComments(postId, {
      view,
      source,
      page,
      limit,
    });

    const response: ApiResponse<UnifiedComment[]> = {
      success: true,
      data: comments,
      meta: {
        total,
        page,
        limit,
        view,
        source,
      },
    };

    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
}

export async function createReply(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { postId, commentId } = req.params;
    const { content } = req.body;
    const idempotencyKey = req.header('Idempotency-Key') || undefined;

    const createdReply = await commentService.createReply({
      postId,
      commentId,
      content,
      idempotencyKey,
    });

    const response: ApiResponse<UnifiedComment> = {
      success: true,
      data: createdReply,
    };

    res.status(201).json(response);
  } catch (err) {
    next(err);
  }
}
