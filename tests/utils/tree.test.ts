import { describe, it, expect } from 'vitest';
import { buildCommentTree } from '../../src/utils/tree.js';
import { UnifiedComment } from '../../src/types/index.js';

describe('buildCommentTree', () => {
  const createMockComment = (
    id: string,
    parentId: string | null = null,
    platformParentId: string | null = null,
    date = '2026-08-30T10:00:00Z'
  ): UnifiedComment => ({
    id,
    postId: 'post_1',
    platform: 'twitter',
    platformCommentId: `plt_${id}`,
    platformParentCommentId: platformParentId,
    parentId,
    author: { id: 'usr_1', name: 'User' },
    content: `Comment ${id}`,
    likeCount: 0,
    replyCount: 0,
    rawPayload: {},
    platformCreatedAt: date,
    createdAt: date,
    updatedAt: date,
  });

  it('should organize flat comments into hierarchical parent-child trees', () => {
    const comments: UnifiedComment[] = [
      createMockComment('c1', null, null, '2026-08-30T10:00:00Z'),
      createMockComment('c2', 'c1', 'plt_c1', '2026-08-30T10:05:00Z'),
      createMockComment('c3', 'c2', 'plt_c2', '2026-08-30T10:10:00Z'), // nested reply to reply
      createMockComment('c4', null, null, '2026-08-30T10:15:00Z'),
    ];

    const tree = buildCommentTree(comments);

    expect(tree).toHaveLength(2); // c1 and c4 at root
    expect(tree[0].id).toBe('c1');
    expect(tree[0].replies).toHaveLength(1);
    expect(tree[0].replies?.[0].id).toBe('c2');
    expect(tree[0].replies?.[0].replies?.[0].id).toBe('c3');

    expect(tree[1].id).toBe('c4');
    expect(tree[1].replies).toHaveLength(0);
  });

  it('should fall back to platformParentCommentId when internal parentId is null', () => {
    const comments: UnifiedComment[] = [
      createMockComment('c10', null, null, '2026-08-30T10:00:00Z'),
      createMockComment('c11', null, 'plt_c10', '2026-08-30T10:05:00Z'),
    ];

    const tree = buildCommentTree(comments);

    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe('c10');
    expect(tree[0].replies).toHaveLength(1);
    expect(tree[0].replies?.[0].id).toBe('c11');
  });

  it('should handle orphaned comments gracefully at root level', () => {
    const comments: UnifiedComment[] = [
      createMockComment('c20', 'c_non_existent', 'plt_non_existent', '2026-08-30T10:00:00Z'),
    ];

    const tree = buildCommentTree(comments);

    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe('c20');
  });
});
