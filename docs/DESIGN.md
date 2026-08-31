# Architecture & Engineering Design Decisions

This document details the architectural reasoning, design trade-offs, and scaling considerations for the Multi-Platform Social Media Comment System.

---

## 1. The Core Challenge: Multi-Platform Extensibility

Social media platforms have disparate API philosophies, data topologies, and threading models:
- **Twitter/X**: Graph of Tweet nodes where replies point upwards via `in_reply_to_tweet_id` or `referenced_tweets: [{ type: 'replied_to' }]`. Threads can nest indefinitely.
- **Instagram Graph API**: Two-tier comment model (`media -> comments -> replies`). Only single-level replies are permitted. Authors are Instagram usernames without traditional email or separate user objects.
- **LinkedIn Community Management API**: URN-based entities (`urn:li:comment:...`, `urn:li:activity:...`, `urn:li:person:...`) with nested millisecond timestamps and actor references.
- **Facebook Graph API**: Node-based graph objects where replies are sub-nodes under a parent comment node.

### Solution: Adapter & Strategy Pattern with Registry
To ensure adding a new platform (e.g. TikTok, YouTube, Threads) requires **zero changes to core services or routes** (Open-Closed Principle):

```
┌────────────────────────────────────────────────────────┐
│                   REST API Controllers                 │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                      CommentService                    │
└───────────────────────────┬────────────────────────────┘
                            │ (Resolves via PlatformRegistry)
┌───────────────────────────▼────────────────────────────┐
│              PlatformCommentProvider Interface         │
│  - fetchComments(params): Promise<FetchResult>         │
│  - postReply(params): Promise<NormalizedComment>       │
│  - getCapabilities(): PlatformCapabilities             │
│  - healthCheck?(): Promise<HealthResult>               │
└───────┬──────────────┬───────────────┬─────────────────┘
        │              │               │
┌───────▼──────┐┌──────▼──────┐┌───────▼──────┐┌─────────▼────────┐
│TwitterAdapter││InstagramAdpt││LinkedInAdapter││ FacebookAdapter │
└───────┬──────┘└──────┬──────┘└───────┬──────┘└─────────┬────────┘
        │              │               │                 │
┌───────▼──────┐┌──────▼──────┐┌───────▼──────┐┌─────────▼────────┐
│Twitter Client││InstagramClnt││LinkedInClient││ Facebook Client  │
│(Mock / SDK)  ││ (Mock / SDK)││ (Mock / SDK) ││   (Mock / SDK)   │
└──────────────┘└─────────────┘└──────────────┘└──────────────────┘
```

#### How to Add a New Platform (e.g., TikTok):
1. **Define Platform Client**: Create `src/adapters/tiktok/tiktok.client.ts` with API request stubs or live SDK wrapper.
2. **Implement Adapter**: Create `src/adapters/tiktok/tiktok.adapter.ts` implementing `PlatformCommentProvider`.
3. **Register Adapter**: Add `platformRegistry.register(new TikTokCommentAdapter())` in `src/adapters/index.ts`.
4. **Done**: All existing endpoints (`/posts/:postId/comments`, `/replies`) automatically support TikTok posts without modifying a single line of business or database logic.

---

## 2. Data Normalization vs. Raw Payload Preservation

### Trade-off Analysis:
- **Pure Normalization**: Loses platform-specific metadata (e.g., Twitter tweet metrics, Instagram stickers, LinkedIn actor headlines, Facebook reactions).
- **Pure Raw Storage**: Makes uniform UI rendering and cross-platform search impossible without platform-specific conditionals leaking everywhere.

### Our Approach:
We normalize all essential fields into a unified domain model (`UnifiedComment`) and store the full native platform response in a serialized `rawPayload` column (compatible with SQLite strings and PostgreSQL `JSONB`):

```typescript
export interface UnifiedComment {
  id: string;                         // Internal UUID
  postId: string;                     // Internal Post UUID
  platform: PlatformType;             // 'twitter' | 'instagram' | ...
  platformCommentId: string;         // Native platform ID
  platformParentCommentId: string | null;
  parentId: string | null;            // Internal parent ID (null if top-level)
  author: CommentAuthor;              // Normalized name, username, avatar
  content: string;
  likeCount: number;
  replyCount: number;
  rawPayload: Record<string, unknown>; // Preserved original payload
  platformCreatedAt: string;          // ISO 8601
  createdAt: string;
  updatedAt: string;
  replies?: UnifiedComment[];         // Hierarchical children
}
```

---

## 3. Database Schema & Threading Model

### Threading Model Comparison:
1. **Adjacency List (`parentId` self-reference)**:
   - *Pros*: Simple schema, fast inserts, trivial single-level reply resolution, supports arbitrary depths.
   - *Cons*: Deep recursive queries in SQL can require Common Table Expressions (CTEs).
2. **Materialized Path / Lineage (`path = "/1/4/12"` )**:
   - *Pros*: Fast subtree queries.
   - *Cons*: Complex path re-calculation if nodes are deleted or moved.
3. **Nested Sets**:
   - *Pros*: Extremely fast subtree reads.
   - *Cons*: Heavy write amplification on inserts (updating left/right boundaries across the table).

### Decision:
We use the **Adjacency List model** (`parentId` self-referential foreign key) paired with an in-memory tree builder (`buildCommentTree`). Since social scheduling products fetch comments in post-scoped batches, building the hierarchy in memory is $O(N)$ time and space, providing maximum insert speed and cross-database compatibility.

---

## 4. Sync & Retrieval Strategies

Our comment retrieval endpoint (`GET /api/v1/posts/:postId/comments`) supports three distinct synchronization modes via the `source` query parameter:

1. `source=sync` (Default):
   - Calls the platform adapter to fetch the latest comments.
   - Upserts all comments into the local database and establishes parent-child foreign key linkages.
   - Returns the normalized tree from the database.
   - *Best for*: Ensuring user views up-to-the-minute data while keeping local storage fresh.
2. `source=db` (Offline / Cached):
   - Reads directly from local DB without triggering external network calls.
   - *Best for*: Fast UI rendering, offline mode, and saving platform rate limits.
3. `source=live` (Pass-Through):
   - Fetches from platform adapter and transforms in memory without writing to DB.
   - *Best for*: Read-only previews where persistence is not required.

---

## 5. Idempotency for Reply Creation

### Problem:
When a user posts a reply to a social media comment, network timeouts or double-clicks can cause duplicate comments on the live platform (e.g. duplicate tweets or Instagram replies), frustrating users and looking unprofessional.

### Solution:
We implemented an **Idempotency Layer** using `Idempotency-Key` headers:
1. Client generates a unique UUID / key for the reply operation and sends header `Idempotency-Key: <key>`.
2. Middleware hashes the request body (`SHA-256`) and checks `idempotency_records` table.
3. **If key exists and hash matches**: Returns the cached `201 Created` response immediately with header `X-Cache-Lookup: HIT`, without calling the social platform again.
4. **If key exists with different payload**: Returns `409 Conflict` to prevent accidental key collisions.
5. **If key is new**: Executes the reply, stores the response in `idempotency_records` with an expiration TTL (24 hours), and returns `X-Cache-Lookup: MISS`.

---

## 6. Real-World Production Considerations (Future Architecture)

### A. Rate Limiting per Platform
- Social APIs enforce strict rate limits (e.g. Twitter: 450 requests / 15 min; Instagram: 200 calls / hour per user).
- *Production Design*: A Redis-backed **Token Bucket** or **Leaky Bucket** rate limiter keyed by `tenantId:platform:credentialId`. When tokens are exhausted, requests queue in BullMQ / Celery with exponential backoff rather than failing immediately.

### B. Transient Platform Failures & Circuit Breakers
- Social networks experience frequent transient 500/503 errors and network blips.
- *Production Design*: Implement a **Circuit Breaker** (e.g. Cockatiel / Opossum) with 3 states (*Closed*, *Open*, *Half-Open*). If failures exceed a 20% threshold over 30 seconds, trip the circuit and serve from local DB cache (`source=db`) with a `X-Data-Degraded: true` warning header.

### C. Webhook-Based Real-Time Ingestion
- Polling social APIs is resource-intensive and exhausts rate limits.
- *Production Design*: Register webhooks (e.g. Meta Webhooks for Instagram/Facebook, Twitter Account Activity API). When a new comment arrives, an ingest queue (`SQS` / `Kafka`) normalizes the payload and pushes real-time updates to connected clients via WebSockets / SSE.
