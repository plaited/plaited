# Valid MSS Tag Combinations

Reference table of validated MSS tag combinations. Each row represents a real-world pattern with its MSS bridge-code tags.

## Work Patterns

| Pattern | contentType | structure | mechanics | boundary | scale | Example |
|---------|------------|-----------|-----------|----------|-------|---------|
| Desk | `work-creation` | `form` | `["track"]` | `none` | S3 | Individual document editor with progress tracking |
| Table | `work-evaluation` | `pool` | `["vote", "reply"]` | `ask` | S5 | Team review board where members critique contributions |
| Meeting Room | `work-coordination` | `pool` | `["sort", "filter", "share"]` | `ask` | S6 | Cross-team coordination of table-level outputs |
| Office | `work-distribution` | `hierarchy` | `["share", "filter"]` | `ask` | S7 | Company platform with tiered access rings |

## Home Patterns

| Pattern | contentType | structure | mechanics | boundary | scale | Example |
|---------|------------|-----------|-----------|----------|-------|---------|
| Bedroom | `personal` | `collection` | `["track"]` | `none` | S3 | Private data aggregation (health, photos, schedules) |
| Living Room | `family` | `collection` | `["share", "post"]` | `ask` | S5 | Shared family space (movie night, grocery lists) |
| House | `household` | `hierarchy` | `["share"]` | `ask` | S6 | Family platform connecting bedrooms + common areas |

## Education Patterns

| Pattern | contentType | structure | mechanics | boundary | scale | Example |
|---------|------------|-----------|-----------|----------|-------|---------|
| Reflection | `education-study` | `form` | `["track"]` | `none` | S3 | Individual notes + reactions on assigned reading |
| Reaction | `education-discussion` | `thread` | `["reply", "vote"]` | `all` | S5 | Group discussion splitting into topic threads |
| Marketplace of Learning | `education` | `matrix` | `["filter", "sort", "follow"]` | `ask` | S8 | Decentralized course platform with linked classes |

## Play Patterns

| Pattern | contentType | structure | mechanics | boundary | scale | Example |
|---------|------------|-----------|-----------|----------|-------|---------|
| Connected Play | `play-cocreation` | `form` | `["limited-loops"]` | `none` | S4 | Two-person turn-based creative canvas |
| Playground | `play-community` | `pool` | `["post", "vote", "scarcity"]` | `ask` | S6 | Neighborhood game platform for verified age groups |
| Carnival | `entertainment` | `collection` | `["filter", "vote", "gold"]` | `ask` | S7 | Multi-genre entertainment platform with creator tiers |

## Commerce Patterns

| Pattern | contentType | structure | mechanics | boundary | scale | Example |
|---------|------------|-----------|-----------|----------|-------|---------|
| Product Listing | `produce` | `object` | `[]` | `ask` | S1 | Single item with price, weight, origin |
| Product Catalog | `produce` | `list` | `["sort", "filter"]` | `ask` | S2 | Sortable inventory of items from one seller |
| Farm Stand | `produce` | `collection` | `["sort", "filter"]` | `all` | S5 | Full seller module with produce categories |
| Farmers Market | `produce` | `pool` | `["sort", "filter", "vote"]` | `all` | S6 | Auto-assembled collection of farm stands |
| General Market | `commerce` | `pool` | `["sort", "filter", "vote"]` | `ask` | S6 | Auto-promoted market with diverse contentTypes |

## Social Patterns

| Pattern | contentType | structure | mechanics | boundary | scale | Example |
|---------|------------|-----------|-----------|----------|-------|---------|
| Profile | `social-identity` | `wall` | `["follow"]` | `ask` | S3 | Public accumulation of user info + karma |
| Post | `social` | `stream` | `["like", "share", "reply"]` | `all` | S3 | Content creation with social mechanics |
| Social Feed | `social` | `feed` | `["like", "follow", "share", "post"]` | `ask` | S3 | Algorithm-sorted social content |
| Community | `social` | `thread` | `["vote", "karma", "gold", "reply"]` | `ask` | S5 | Reddit-style community with reputation system |
| Social Network | `social` | `matrix` | `["like", "follow", "share", "post"]` | `ask` | S7 | Full social platform with multiple navigation paths |

## Health Patterns

| Pattern | contentType | structure | mechanics | boundary | scale | Example |
|---------|------------|-----------|-----------|----------|-------|---------|
| Health Metric | `health` | `object` | `["track"]` | `none` | S1 | Single data point (steps, weight, BP reading) |
| Health Tracker | `health` | `form` | `["track", "chart"]` | `none` | S2 | Personal health metric input + visualization |
| Health Dashboard | `health` | `collection` | `["track", "chart", "filter"]` | `ask` | S3 | Aggregated health data with sharing controls |
| Research Platform | `health-research` | `pool` | `["filter", "sort", "chart"]` | `paid` | S7 | Longitudinal study aggregating individual health modules |

## Art Patterns

| Pattern | contentType | structure | mechanics | boundary | scale | Example |
|---------|------------|-----------|-----------|----------|-------|---------|
| Artwork | `art` | `object` | `[]` | `ask` | S1 | Single piece of art |
| Portfolio | `art` | `collection` | `["sort"]` | `ask` | S2 | Artist's curated body of work |
| Exhibition | `art` | `feed` | `["vote", "gold", "share"]` | `all` | S5 | Ranked art display with community awards |
| Gallery Platform | `art` | `matrix` | `["vote", "gold", "follow", "share"]` | `ask` | S7 | Multi-artist platform with discovery + curation |

## Ephemeral Network Patterns

| Pattern | contentType | structure | mechanics | boundary | scale | Example |
|---------|------------|-----------|-----------|----------|-------|---------|
| Meeting Place | `social-ephemeral` | `collection` | `["filter"]` | `all` | S5 | Proximity-based module sharing (reading lists in a plaza) |
| Pop-up Exhibition | `art` | `feed` | `["vote"]` | `all` | S5 | Art displayed on screens within wifi range |
| Local Market | `commerce` | `pool` | `["filter", "sort"]` | `all` | S6 | Ephemeral market that exists only while sellers are present |

## Invalid Combinations (Anti-Patterns)

| Invalid | Why |
|---------|-----|
| `structure: "feed", scale: S1` | Feeds require multiple items; S1 is singular |
| `structure: "hierarchy", scale: S2` | Hierarchy is a platform structure (S7) |
| `boundary: "all", contentType: "health"` | Health data should not default to open sharing |
| `mechanics: ["karma"], boundary: "none"` | Karma requires community interaction; `none` prevents it |
| `scale: S8, structure: "object"` | Super-structures cannot be singular objects |
| `mechanics: ["vote"], structure: "form"` | Forms are input patterns; voting is for displayed content |
| S5 module containing S6 module | Larger scale cannot be nested inside smaller |
