import { UnifiedComment } from '../types/index.js';

/**
 * Builds a hierarchical comment tree from a flat list of normalized comments.
 * 
 * Supports single-level nesting (Instagram, Facebook, LinkedIn) and arbitrary deep nesting (Twitter).
 * Comments without matched parent comments default to root level to prevent lost comments.
 */
export function buildCommentTree(comments: UnifiedComment[]): UnifiedComment[] {
  const commentMap = new Map<string, UnifiedComment>();
  const rootComments: UnifiedComment[] = [];

  // Clone objects to avoid mutation side-effects and initialize empty replies array
  comments.forEach((c) => {
    commentMap.set(c.id, { ...c, replies: [] });
    // Also index by platformCommentId for cross-referencing platform native IDs
    if (c.platformCommentId) {
      commentMap.set(`platform:${c.platformCommentId}`, commentMap.get(c.id)!);
    }
  });

  comments.forEach((c) => {
    const current = commentMap.get(c.id)!;
    
    // Resolve parent either via internal parentId or platformParentCommentId
    let parent: UnifiedComment | undefined;
    if (c.parentId && commentMap.has(c.parentId)) {
      parent = commentMap.get(c.parentId);
    } else if (c.platformParentCommentId && commentMap.has(`platform:${c.platformParentCommentId}`)) {
      parent = commentMap.get(`platform:${c.platformParentCommentId}`);
    }

    if (parent && parent.id !== current.id) {
      if (!parent.replies) {
        parent.replies = [];
      }
      parent.replies.push(current);
    } else {
      rootComments.push(current);
    }
  });

  // Sort root comments and replies chronologically
  const sortByDate = (a: UnifiedComment, b: UnifiedComment) =>
    new Date(a.platformCreatedAt).getTime() - new Date(b.platformCreatedAt).getTime();

  rootComments.sort(sortByDate);

  const sortRepliesRecursively = (comment: UnifiedComment) => {
    if (comment.replies && comment.replies.length > 0) {
      comment.replies.sort(sortByDate);
      comment.replies.forEach(sortRepliesRecursively);
    }
  };

  rootComments.forEach(sortRepliesRecursively);

  return rootComments;
}
