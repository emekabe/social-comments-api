import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Social Comments database...');

  // Clean existing tables for deterministic seed state
  await prisma.idempotencyRecord.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.post.deleteMany();

  // 1. Seed Twitter Post
  const twitterPost = await prisma.post.create({
    data: {
      id: '00000000-0000-0000-0000-000000000001',
      platform: 'twitter',
      platformPostId: 'tw_post_1001',
      content: 'Announcing our new multi-platform comment sync engine! Thread your thoughts below 👇 #buildinpublic',
      publishedAt: new Date(Date.now() - 3600 * 1000 * 24),
    },
  });

  // 2. Seed Instagram Post
  const instagramPost = await prisma.post.create({
    data: {
      id: '00000000-0000-0000-0000-000000000002',
      platform: 'instagram',
      platformPostId: 'ig_media_2001',
      content: 'Behind the scenes of our brand design refresh ✨ What do you think of the new palette?',
      publishedAt: new Date(Date.now() - 3600 * 1000 * 48),
    },
  });

  // 3. Seed LinkedIn Post
  const linkedInPost = await prisma.post.create({
    data: {
      id: '00000000-0000-0000-0000-000000000003',
      platform: 'linkedin',
      platformPostId: 'li_act_3001',
      content: 'Excited to share our technical architecture breakdown on building resilient distributed APIs.',
      publishedAt: new Date(Date.now() - 3600 * 1000 * 72),
    },
  });

  // 4. Seed Facebook Post
  const facebookPost = await prisma.post.create({
    data: {
      id: '00000000-0000-0000-0000-000000000004',
      platform: 'facebook',
      platformPostId: 'fb_post_4001',
      content: 'Major product update: Community edition templates are now officially live for all users!',
      publishedAt: new Date(Date.now() - 3600 * 1000 * 96),
    },
  });

  // Seed sample comments for Twitter post
  const twRoot1 = await prisma.comment.create({
    data: {
      id: '00000000-0000-0000-0001-000000000001',
      postId: twitterPost.id,
      platform: 'twitter',
      platformCommentId: 'tw_cmt_101',
      authorId: 'usr_tw_1',
      authorName: 'Sarah Connor',
      authorUsername: 'sarah_c',
      authorAvatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330',
      content: 'Huge fan of this feature! Will this support automated webhook notifications too?',
      likeCount: 14,
      replyCount: 1,
      rawPayload: JSON.stringify({ id: 'tw_cmt_101', text: 'Huge fan of this feature!' }),
      platformCreatedAt: new Date(Date.now() - 3600 * 1000 * 5),
    },
  });

  await prisma.comment.create({
    data: {
      id: '00000000-0000-0000-0001-000000000002',
      postId: twitterPost.id,
      platform: 'twitter',
      platformCommentId: 'tw_cmt_102',
      platformParentCommentId: 'tw_cmt_101',
      parentId: twRoot1.id,
      authorId: 'usr_tw_2',
      authorName: 'Alex Rivera',
      authorUsername: 'arivera_tech',
      authorAvatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d',
      content: 'Yes @sarah_c! Webhook event streaming is slated for the Q3 milestone.',
      likeCount: 6,
      replyCount: 0,
      rawPayload: JSON.stringify({ id: 'tw_cmt_102', text: 'Yes @sarah_c! Webhook event streaming...' }),
      platformCreatedAt: new Date(Date.now() - 3600 * 1000 * 4),
    },
  });

  await prisma.comment.create({
    data: {
      id: '00000000-0000-0000-0001-000000000003',
      postId: twitterPost.id,
      platform: 'twitter',
      platformCommentId: 'tw_cmt_103',
      authorId: 'usr_tw_3',
      authorName: 'Elena Rostova',
      authorUsername: 'elena_dev',
      authorAvatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
      content: 'Love the clean API interface. Keep up the amazing work team!',
      likeCount: 9,
      replyCount: 0,
      rawPayload: JSON.stringify({ id: 'tw_cmt_103', text: 'Love the clean API interface.' }),
      platformCreatedAt: new Date(Date.now() - 3600 * 1000 * 2),
    },
  });

  // Seed sample comment for Instagram post
  const igRoot = await prisma.comment.create({
    data: {
      id: '00000000-0000-0000-0002-000000000001',
      postId: instagramPost.id,
      platform: 'instagram',
      platformCommentId: 'ig_cmt_201',
      authorId: 'usr_ig_1',
      authorName: 'aesthetic_creator',
      authorUsername: 'aesthetic_creator',
      content: 'This visual aesthetic is stunning! What filter preset was used here? ✨',
      likeCount: 32,
      replyCount: 1,
      rawPayload: JSON.stringify({ id: 'ig_cmt_201', text: 'This visual aesthetic is stunning!' }),
      platformCreatedAt: new Date(Date.now() - 3600 * 1000 * 8),
    },
  });

  await prisma.comment.create({
    data: {
      id: '00000000-0000-0000-0002-000000000002',
      postId: instagramPost.id,
      platform: 'instagram',
      platformCommentId: 'ig_cmt_202',
      platformParentCommentId: 'ig_cmt_201',
      parentId: igRoot.id,
      authorId: 'usr_ig_self',
      authorName: 'brand_studio',
      authorUsername: 'brand_studio',
      content: 'Custom Lightroom curve! Drop us a DM and we will send the preset bundle link 🎨',
      likeCount: 5,
      replyCount: 0,
      rawPayload: JSON.stringify({ id: 'ig_cmt_202', text: 'Custom Lightroom curve!' }),
      platformCreatedAt: new Date(Date.now() - 3600 * 1000 * 6),
    },
  });

  console.log(`✅ Seed completed successfully!`);
  console.log(`   - ${4} posts created`);
  console.log(`   - ${5} comments & threaded replies created`);
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
