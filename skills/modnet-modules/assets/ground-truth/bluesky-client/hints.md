# Bluesky Client — Reference Implementation Hints

## Package Structure

```
bluesky-client/
  package.json           # @atproto/api dependency, modnet field
  skills/
    bluesky-client/
      SKILL.md           # Seed skill with MSS metadata
  .memory/
    sessions/            # Decision history
  data/                  # Cached feed data, user preferences
  src/
    bluesky-client.ts    # Main module entry
    bluesky-client.types.ts  # AT Protocol response types
    auth.ts              # Session management (login/logout)
    feed.ts              # Timeline fetching and rendering
    post.ts              # Post creation
    profile.ts           # Profile viewing
    social.ts            # Follow/unfollow, like/unlike actions
```

## Key AT Protocol Patterns

### Authentication

```typescript
import { BskyAgent } from '@atproto/api'

const agent = new BskyAgent({ service: 'https://bsky.social' })
await agent.login({ identifier: handle, password: appPassword })
// agent.session contains { did, handle, accessJwt, refreshJwt }
```

### Timeline Feed

```typescript
const { data } = await agent.getTimeline({ limit: 50 })
// data.feed is FeedViewPost[] with:
//   post.author.displayName, post.author.handle, post.author.avatar
//   post.record.text, post.record.createdAt
//   post.likeCount, post.replyCount, post.repostCount
//   post.viewer.like (uri if liked, undefined if not)
```

### Post Creation

```typescript
await agent.post({ text: 'Hello from my modnet module!' })
// Creates a record in app.bsky.feed.post collection
```

### Profile

```typescript
const { data } = await agent.getProfile({ actor: did })
// data.displayName, data.description, data.avatar
// data.followersCount, data.followsCount, data.postsCount
// data.viewer.following (uri if following, undefined if not)
```

### Follow/Unfollow

```typescript
// Follow
await agent.follow(did)
// Unfollow (need the follow URI from viewer.following)
await agent.deleteFollow(followUri)
```

### Like/Unlike

```typescript
// Like
const { uri } = await agent.like(postUri, postCid)
// Unlike
await agent.deleteLike(likeUri)
```

## MSS Tags Rationale

| Tag | Value | Why |
|---|---|---|
| contentType | `social` | Social media domain |
| structure | `feed` | Algorithm-sorted timeline is the primary view |
| mechanics | `post,like,follow,share` | Core social interactions |
| boundary | `ask` | User credentials involved — prompt before sharing |
| scale | 3 | Multiple file types, behavioral code, real API integration |

## Eval Dimension Mapping

### Intention (outcome)

The module should fulfill these real-world expectations:
- A user can log in with their existing Bluesky account
- They see their actual timeline (not mock data)
- They can create posts that appear on the real network
- They can view anyone's profile by handle
- Social graph operations (follow/unfollow) work correctly

### Static (process)

Structural checks:
- `package.json` has `@atproto/api` in dependencies
- `modnet` field has correct MSS tags
- `SKILL.md` exists with seed metadata
- All TypeScript compiles cleanly
- File organization follows module conventions

### Dynamic (efficiency)

Runtime behavior:
- Login form → feed transition works
- Feed pagination or infinite scroll
- Post creation → optimistic UI update
- Profile navigation from feed author clicks
- Follow/like state toggling with visual feedback
