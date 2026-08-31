# Social Comments API

A multi-platform social media comment management API designed for scheduling and engagement platforms. It enables retrieving comment threads, organizing hierarchical conversations, and publishing replies across Twitter/X, Instagram, LinkedIn, and Facebook through an extensible adapter architecture.

---

## 1. Project Overview

Social Comments API extends a social media scheduling backend to provide unified comment retrieval and reply publishing across multiple social networks. It normalizes disparate platform comment models into a standardized domain format while preserving native payloads for platform-specific capabilities. Built around an extensible Adapter/Strategy pattern, the system allows onboarding new social channels without modifying core business services or API endpoints.

---

## 2. Features and Flow

- **Post & Account Context**: Posts are created and scheduled prior to comment synchronization; each post in our database is linked to its native social network via a composite unique key `(platform, platformPostId)`.
- **Platform Mocking**: Third-party social network SDKs/APIs are cleanly mocked in dedicated client stubs (`MockTwitterApiClient`, `MockInstagramApiClient`, etc.) to allow instant local evaluation without requiring live OAuth tokens or developer app credentials.
- **Threading Topologies**:
  - *Twitter/X*: Supports recursive, multi-level nested reply trees.
  - *Instagram, Facebook, LinkedIn*: Support single-level threaded replies (`root comment -> direct reply`). Sub-replies to replies are rejected with a 400 Validation Error per platform rules.
- **Sync Model**: Comment retrieval defaults to `source=sync` (fetching latest from platform, upserting to local database, and returning the structured tree). A `source=db` mode is provided for cached offline reads, and `source=live` for pass-through evaluation.
- **Idempotency**: Clients submitting replies may send an optional `Idempotency-Key` header. Requests matching an existing key and body hash receive the cached `201 Created` response to prevent duplicate social posts on network retries.
- **Database Engine**: Uses SQLite (`file:./dev.db`) by default for zero-setup execution, while adhering to standard SQL and Prisma ORM conventions for drop-in PostgreSQL compatibility.

---

## 3. Tech Stack and Why

- **TypeScript (v5.5)**: Provides end-to-end type safety, eliminating runtime shape mismatches across heterogeneous social platform payloads.
- **Node.js & Express (v4.19)**: Minimal, battle-tested, un-opinionated HTTP layer with low overhead and wide ecosystem compatibility.
- **Prisma ORM (v5.22)**: Type-safe database client with declarative schema modeling (`prisma/schema.prisma`), automated SQL migrations, and reliable foreign key cascade handling.
- **Zod (v3.23)**: Schema validation for incoming query parameters, route params, and request payloads with automated error mapping.
- **Vitest & Supertest**: Fast, modern test runner with native TypeScript support for both unit testing adapters and executing full end-to-end HTTP integration tests.

---

## 4. Architecture Overview

The system centers around the **Adapter / Strategy Pattern** coupled with a central **Registry**:

```
┌────────────────────────────────────────────────────────┐
│                   REST API Layer                       │
│  GET /posts/:id/comments   POST /posts/:id/.../replies │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                    CommentService                      │
└───────────────────────────┬────────────────────────────┘
                            │ Resolves adapter via
┌───────────────────────────▼────────────────────────────┐
│                   PlatformRegistry                     │
└───────┬──────────────┬───────────────┬─────────────────┘
        │              │               │
┌───────▼──────┐┌──────▼──────┐┌───────▼──────┐┌─────────▼────────┐
│TwitterAdapter││InstagramAdpt││LinkedInAdapter││ FacebookAdapter │
└───────┬──────┘└──────┬──────┘└───────┬──────┘└─────────┬────────┘
        │              │               │                 │
┌───────▼──────┐┌──────▼──────┐┌───────▼──────┐┌─────────▼────────┐
│ Twitter API  ││ Instagram   ││ LinkedIn REST││  Facebook Graph  │
│ Client / SDK ││ Graph Client││ Client / SDK ││   Client / SDK   │
└──────────────┘└─────────────┘└──────────────┘└──────────────────┘
```

### The `PlatformCommentProvider` Interface
Every social network implements a common contract defined in `src/adapters/base.provider.ts`:
- `getPlatformName()`: Returns the platform identifier (`'twitter'`, `'instagram'`, etc.).
- `getCapabilities()`: Declares constraints such as `maxNestingDepth` and `maxCommentLength`.
- `fetchComments(params)`: Retrieves and normalizes external comment payloads into `NormalizedPlatformComment[]`.
- `postReply(params)`: Dispatches a new reply to the platform and returns the normalized created comment.
- `healthCheck()`: Reports platform API status.

### How to Add a New Platform (e.g., TikTok)
1. Create `src/adapters/tiktok/tiktok.client.ts` with API request stubs or SDK wrapper.
2. Create `src/adapters/tiktok/tiktok.adapter.ts` implementing `PlatformCommentProvider`.
3. Register the adapter in `src/adapters/index.ts`:
   ```typescript
   platformRegistry.register(new TikTokCommentAdapter());
   ```
4. **Done**: All existing endpoints immediately support TikTok posts with zero changes to services or controllers.

---

## 5. Database Schema Summary

The database uses 3 primary tables. Full schema definition and SQL migrations can be reviewed in:
- Schema: [`prisma/schema.prisma`](prisma/schema.prisma)
- Migration SQL: [`prisma/migrations/20260831000000_init/migration.sql`](prisma/migrations/20260831000000_init/migration.sql)

### Table Relationships:
- **`posts`**: Stores scheduled and published posts across all channels.
  - Key columns: `id` (UUID PK), `platform`, `platformPostId`, `content`, `publishedAt`.
  - Constraint: Unique index on `[platform, platformPostId]`.
- **`comments`**: Stores normalized comments and reply trees.
  - Key columns: `id` (UUID PK), `postId` (FK -> `posts.id`), `parentId` (Self-referential FK -> `comments.id`), `platform`, `platformCommentId`, `authorName`, `content`, `likeCount`, `replyCount`, `rawPayload`, `platformCreatedAt`.
  - Constraint: Unique index on `[platform, platformCommentId]`. Cascade on delete for post and parent comment.
- **`idempotency_records`**: Stores request fingerprints and cached JSON responses for safe retries.
  - Key columns: `key` (PK), `requestPath`, `requestBodyHash`, `statusCode`, `responseBody`, `expiresAt`.

---

## 6. API Endpoints

For comprehensive architectural design reasoning and trade-off analysis, see [`docs/DESIGN.md`](docs/DESIGN.md).

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/health` | Health check endpoint returning system status and uptime |
| `GET` | `/api/v1/platforms` | Lists all supported social platform adapters and their capabilities |
| `GET` | `/api/v1/posts` | Lists all scheduled/published posts with pagination |
| `GET` | `/api/v1/posts/:postId` | Retrieves metadata for a specific post by internal UUID |
| `GET` | `/api/v1/posts/:postId/comments` | Retrieves comments for a post (`view=tree\|flat`, `source=sync\|db\|live`) |
| `POST` | `/api/v1/posts/:postId/comments/:commentId/replies` | Publishes a reply to a comment (supports `Idempotency-Key` header) |

---

## 7. Setup Instructions

### Prerequisites
- **Node.js**: `v18.0.0` or higher (tested on Node v20 / v22 / v26)
- **npm**: `v9.0.0` or higher

### Installation & Startup Steps

1. **Clone the repository and install dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment Variables**:
   Copy `.env.example` to `.env` (defaults to SQLite for instant local execution):
   ```bash
   cp .env.example .env
   ```

3. **Initialize Database & Seed Mock Data**:
   Running this single command automatically creates the `dev.db` SQLite database file from scratch, generates the Prisma client, applies the schema tables (`posts`, `comments`, `idempotency_records`), and seeds sample multi-platform posts and comment threads:
   ```bash
   npm run db:setup
   ```
   *(Note: You do not need an existing database file; Prisma generates `dev.db` automatically on first run).*

4. **Start Development Server**:
   ```bash
   npm run dev
   ```
   The server will start at `http://localhost:3000`.

5. **Build for Production** (Optional):
   ```bash
   npm run build
   npm start
   ```

---

## 8. How to Run Tests

The test suite covers adapter normalization, tree construction, platform registry routing, service business logic, idempotency guarantees, and end-to-end HTTP API integration.

```bash
# Run all tests once
npm test

# Run tests in watch mode
npm run test:watch
```

---

## 9. How to Use the Postman Collection

A complete Postman Collection v2.1 is located at [`docs/postman_collection.json`](docs/postman_collection.json).

### How to Import:
1. Open **Postman**.
2. Click **Import** (top left).
3. Drag and drop `docs/postman_collection.json` or browse to select it.

### Collection Variables:
The collection includes pre-configured variables with sensible defaults:
- `{{baseUrl}}`: `http://localhost:3000` (points to local instance)
- `{{postId}}`: `00000000-0000-0000-0000-000000000001` (pre-seeded Twitter post)
- `{{commentId}}`: `00000000-0000-0000-0001-000000000001` (pre-seeded comment)
- `{{platform}}`: `twitter`
- `{{apiKey}}`: `dev-api-key-placeholder`

All requests are pre-configured with sample request bodies and query parameters.
