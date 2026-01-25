# ARIA Feed Pattern

## Overview

A feed is a section of a page that automatically loads new sections of content as the user scrolls. The sections of content in a feed are presented in article elements. A feed can be thought of as a dynamic list of articles that often appears to scroll infinitely.

**Key Characteristics:**

- **Structure, not widget**: Feed is a structure that works with assistive technology reading mode
- **Dynamic loading**: Articles are loaded as user scrolls or navigates
- **Interoperability contract**: Establishes agreement between web page and assistive technologies
- **Reading mode**: Screen readers default to reading mode when interacting with feeds
- **Article-based**: Content organized as article elements

**Interoperability Contract:**

1. **Web page responsibilities**:
   - Appropriate visual scrolling based on which article has DOM focus
   - Loading/removing articles based on which article has DOM focus
2. **Assistive technology responsibilities**:
   - Indicate which article has reading cursor via DOM focus
   - Provide reading mode keys to move focus between articles
   - Provide keys to move past start/end of feed

## Use Cases

- Social media feeds
- News/article feeds
- Product listings with infinite scroll
- Activity timelines
- Comment threads
- Search results
- Related content sections

## Pattern Philosophy

This pattern is **training data** for the Plaited agent. The examples below train the agent's understanding of how to implement this pattern correctly.

- bElements/FunctionalTemplates are defined locally in stories (NOT exported)
- Only stories are exported (required for testing/training)
- Styles are always in separate `*.css.ts` files
- Use spread syntax `{...styles.x}` for applying styles

## Implementation

### Vanilla JavaScript

```html
<div role="feed" aria-label="News feed" aria-busy="false">
  <article role="article" aria-posinset="1" aria-setsize="10" aria-labelledby="article-1-title">
    <h3 id="article-1-title">Article Title 1</h3>
    <p>Article content...</p>
  </article>
  <article role="article" aria-posinset="2" aria-setsize="10" aria-labelledby="article-2-title">
    <h3 id="article-2-title">Article Title 2</h3>
    <p>Article content...</p>
  </article>
</div>
```

```javascript
// Intersection Observer for scroll-based loading
const feed = document.querySelector('[role="feed"]')
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      const article = entry.target
      const position = parseInt(article.getAttribute('aria-posinset'))
      // Load more articles when near the end
      if (position > articles.length - 3) {
        loadMoreArticles()
      }
    }
  })
}, { rootMargin: '200px' })

// Keyboard navigation
feed.addEventListener('keydown', (e) => {
  if (e.key === 'PageDown') {
    e.preventDefault()
    moveToNextArticle()
  } else if (e.key === 'PageUp') {
    e.preventDefault()
    moveToPreviousArticle()
  }
})
```

### Plaited Adaptation

**File Structure:**

```
feed/
  feed.css.ts        # Styles (createStyles) - ALWAYS separate
  feed.stories.tsx   # bElement + stories (imports from css.ts)
```

#### feed.css.ts

```typescript
// feed.css.ts
import { createStyles, createHostStyles } from 'plaited'

export const hostStyles = createHostStyles({
  display: 'block',
})

export const styles = createStyles({
  feed: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  article: {
    padding: '1rem',
    border: '1px solid #ccc',
    borderRadius: '4px',
    outline: 'none',
  },
  articleFocused: {
    borderColor: '#007bff',
    boxShadow: '0 0 0 2px rgba(0, 123, 255, 0.25)',
  },
  title: {
    margin: '0 0 0.5rem 0',
    fontSize: '1.25rem',
  },
  description: {
    margin: '0 0 0.5rem 0',
    fontSize: '0.875rem',
    color: '#666',
  },
  content: {
    margin: 0,
  },
  loading: {
    padding: '1rem',
    textAlign: 'center',
    color: '#666',
  },
})
```

#### feed.stories.tsx

```typescript
// feed.stories.tsx
import type { FT, Children } from 'plaited/ui'
import { bElement } from 'plaited/ui'
import { story } from 'plaited/testing'
import { styles, hostStyles } from './feed.css.ts'

// Type for article data
type ArticleData = {
  id: string
  title: string
  description?: string
  content: string
}

// FunctionalTemplate for static article - defined locally, NOT exported
const StaticArticle: FT<{
  title: string
  description?: string
  position: number
  setSize: number
  children?: Children
}> = ({ title, description, position, setSize, children }) => {
  const articleId = `article-${position}`
  const titleId = `${articleId}-title`
  const descriptionId = `${articleId}-desc`

  return (
    <article
      role="article"
      aria-posinset={position}
      aria-setsize={setSize}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      tabIndex={-1}
      {...styles.article}
    >
      <h3 id={titleId} {...styles.title}>{title}</h3>
      {description && <p id={descriptionId} {...styles.description}>{description}</p>}
      <div {...styles.content}>{children}</div>
    </article>
  )
}

// FunctionalTemplate for static feed - defined locally, NOT exported
const StaticFeed: FT<{
  label?: string
  busy?: boolean
  children?: Children
}> = ({ label = 'Feed', busy = false, children }) => (
  <div
    role="feed"
    aria-label={label}
    aria-busy={busy ? 'true' : 'false'}
    {...styles.feed}
  >
    {children}
  </div>
)

// bElement for interactive feed - defined locally, NOT exported
const Feed = bElement({
  tag: 'pattern-feed',
  observedAttributes: ['aria-label'],
  hostStyles,
  shadowDom: (
    <div
      p-target="feed"
      role="feed"
      aria-label="Feed"
      aria-busy="false"
      p-trigger={{ keydown: 'handleKeydown' }}
      {...styles.feed}
    >
      <slot></slot>
      <div p-target="loading" hidden {...styles.loading}>
        Loading more articles...
      </div>
    </div>
  ),
  bProgram({ $, host, emit }) {
    const feed = $('feed')[0]
    const loading = $('loading')[0]
    let isLoading = false
    let intersectionObserver: IntersectionObserver | undefined

    const getArticles = (): HTMLElement[] => {
      const slot = feed?.querySelector('slot') as HTMLSlotElement
      if (!slot) return []
      return slot.assignedElements().filter(
        (el) => el.getAttribute('role') === 'article'
      ) as HTMLElement[]
    }

    const moveToArticle = (index: number) => {
      const articles = getArticles()
      if (index >= 0 && index < articles.length) {
        articles[index].focus()
        articles[index].scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }

    const getCurrentIndex = (): number => {
      const articles = getArticles()
      const activeElement = document.activeElement as HTMLElement
      return articles.indexOf(activeElement)
    }

    const setBusy = (busy: boolean) => {
      isLoading = busy
      feed?.attr('aria-busy', busy ? 'true' : 'false')
      loading?.attr('hidden', busy ? null : '')
    }

    const observeArticles = () => {
      if (!intersectionObserver) return
      const articles = getArticles()
      articles.forEach((article) => intersectionObserver?.observe(article))
    }

    return {
      handleKeydown(event: KeyboardEvent) {
        const articles = getArticles()
        const currentIndex = getCurrentIndex()

        switch (event.key) {
          case 'PageDown':
            event.preventDefault()
            if (currentIndex < articles.length - 1) {
              moveToArticle(currentIndex + 1)
            } else if (currentIndex === articles.length - 1 && !isLoading) {
              emit({ type: 'loadMore', detail: { position: currentIndex + 1 } })
            }
            break
          case 'PageUp':
            event.preventDefault()
            if (currentIndex > 0) {
              moveToArticle(currentIndex - 1)
            }
            break
          case 'Home':
            if (event.ctrlKey) {
              event.preventDefault()
              moveToArticle(0)
            }
            break
          case 'End':
            if (event.ctrlKey) {
              event.preventDefault()
              moveToArticle(articles.length - 1)
            }
            break
        }
      },
      setLoading(busy: boolean) {
        setBusy(busy)
      },
      onConnected() {
        // Set up Intersection Observer for scroll-based loading
        intersectionObserver = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting && !isLoading) {
                const article = entry.target as HTMLElement
                const position = parseInt(article.getAttribute('aria-posinset') ?? '0', 10)
                const articles = getArticles()

                if (position >= articles.length - 2) {
                  emit({ type: 'loadMore', detail: { position } })
                }
              }
            })
          },
          { rootMargin: '200px' }
        )

        // Observe slotted articles
        const slot = feed?.querySelector('slot') as HTMLSlotElement
        if (slot) {
          slot.addEventListener('slotchange', observeArticles)
          observeArticles()
        }
      },
      onDisconnected() {
        if (intersectionObserver) {
          intersectionObserver.disconnect()
          intersectionObserver = undefined
        }
      },
    }
  },
})

// Stories - EXPORTED for testing/training
export const basicFeed = story({
  intent: 'Display a feed with multiple articles and keyboard navigation',
  template: () => (
    <Feed aria-label="News feed">
      <article
        role="article"
        aria-posinset={1}
        aria-setsize={3}
        aria-labelledby="article-1-title"
        tabIndex={-1}
        style="padding: 1rem; border: 1px solid #ccc; border-radius: 4px; margin-bottom: 1rem;"
      >
        <h3 id="article-1-title">First Article</h3>
        <p>Content of the first article...</p>
      </article>
      <article
        role="article"
        aria-posinset={2}
        aria-setsize={3}
        aria-labelledby="article-2-title"
        tabIndex={-1}
        style="padding: 1rem; border: 1px solid #ccc; border-radius: 4px; margin-bottom: 1rem;"
      >
        <h3 id="article-2-title">Second Article</h3>
        <p>Content of the second article...</p>
      </article>
      <article
        role="article"
        aria-posinset={3}
        aria-setsize={3}
        aria-labelledby="article-3-title"
        tabIndex={-1}
        style="padding: 1rem; border: 1px solid #ccc; border-radius: 4px;"
      >
        <h3 id="article-3-title">Third Article</h3>
        <p>Content of the third article...</p>
      </article>
    </Feed>
  ),
  play: async ({ findByAttribute, assert }) => {
    const feed = await findByAttribute('p-target', 'feed')

    assert({
      given: 'feed is rendered',
      should: 'have feed role',
      actual: feed?.getAttribute('role'),
      expected: 'feed',
    })

    assert({
      given: 'feed is rendered',
      should: 'not be busy initially',
      actual: feed?.getAttribute('aria-busy'),
      expected: 'false',
    })
  },
})

export const loadingFeed = story({
  intent: 'Display a feed in loading state with aria-busy',
  template: () => {
    // Create ref to access feed after render
    let feedRef: HTMLElement | null = null

    return (
      <Feed
        aria-label="Loading feed"
        ref={(el: HTMLElement) => {
          feedRef = el
          // Set loading state after mount
          setTimeout(() => {
            (feedRef as any)?.trigger?.({ type: 'setLoading', detail: true })
          }, 0)
        }}
      >
        <article
          role="article"
          aria-posinset={1}
          aria-setsize={-1}
          aria-labelledby="loading-article-title"
          tabIndex={-1}
          style="padding: 1rem; border: 1px solid #ccc; border-radius: 4px;"
        >
          <h3 id="loading-article-title">Existing Article</h3>
          <p>More articles are loading...</p>
        </article>
      </Feed>
    )
  },
  play: async ({ findByAttribute, assert }) => {
    const feed = await findByAttribute('p-target', 'feed')

    assert({
      given: 'feed with unknown total',
      should: 'have article with aria-setsize -1',
      actual: feed?.querySelector('[role="article"]')?.getAttribute('aria-setsize'),
      expected: '-1',
    })
  },
})

export const staticFeedDisplay = story({
  intent: 'Static FunctionalTemplate feed for non-interactive display',
  template: () => (
    <StaticFeed label="Static news feed">
      <StaticArticle
        title="Breaking News"
        description="Latest updates from around the world"
        position={1}
        setSize={2}
      >
        Full article content goes here...
      </StaticArticle>
      <StaticArticle
        title="Tech Update"
        description="New developments in technology"
        position={2}
        setSize={2}
      >
        Technology news content...
      </StaticArticle>
    </StaticFeed>
  ),
  play: async ({ accessibilityCheck }) => {
    await accessibilityCheck({})
  },
})

export const keyboardNavigation = story({
  intent: 'Demonstrate feed keyboard navigation with Page Up/Down',
  template: () => (
    <Feed aria-label="Keyboard navigation demo">
      <article
        role="article"
        aria-posinset={1}
        aria-setsize={3}
        aria-labelledby="kb-article-1"
        tabIndex={-1}
        style="padding: 1rem; border: 1px solid #ccc; border-radius: 4px; margin-bottom: 1rem;"
      >
        <h3 id="kb-article-1">Article 1</h3>
        <p>Press Page Down to move to next article</p>
      </article>
      <article
        role="article"
        aria-posinset={2}
        aria-setsize={3}
        aria-labelledby="kb-article-2"
        tabIndex={-1}
        style="padding: 1rem; border: 1px solid #ccc; border-radius: 4px; margin-bottom: 1rem;"
      >
        <h3 id="kb-article-2">Article 2</h3>
        <p>Press Page Up to move to previous article</p>
      </article>
      <article
        role="article"
        aria-posinset={3}
        aria-setsize={3}
        aria-labelledby="kb-article-3"
        tabIndex={-1}
        style="padding: 1rem; border: 1px solid #ccc; border-radius: 4px;"
      >
        <h3 id="kb-article-3">Article 3</h3>
        <p>Press Ctrl+Home/End to jump to first/last</p>
      </article>
    </Feed>
  ),
  play: async ({ findByAttribute, fireEvent, assert }) => {
    const feed = await findByAttribute('p-target', 'feed')
    const articles = feed?.querySelectorAll('[role="article"]')

    assert({
      given: 'feed with articles',
      should: 'have 3 articles',
      actual: articles?.length,
      expected: 3,
    })

    // Focus first article
    const firstArticle = articles?.[0] as HTMLElement
    firstArticle?.focus()

    assert({
      given: 'first article is focused',
      should: 'be the active element',
      actual: document.activeElement === firstArticle,
      expected: true,
    })
  },
})
```

## Plaited Integration

- **Works with Shadow DOM**: Yes - feeds are bElements with Shadow DOM
- **Uses bElement built-ins**: `$`, `p-trigger`, `p-target`, `emit`, `attr`
- **Requires external web API**: Intersection Observer API, Focus management
- **Cleanup required**: Yes - Intersection Observer must be disconnected in `onDisconnected`

## Keyboard Interaction

When focus is inside the feed:

- **Page Down**: Moves focus to the next article
- **Page Up**: Moves focus to the previous article
- **Control + End**: Moves focus to the last article
- **Control + Home**: Moves focus to the first article

**Note**: Due to lack of established keyboard conventions, provide easily discoverable keyboard interface documentation.

## WAI-ARIA Roles, States, and Properties

### Required

- **role="feed"**: Container element for the feed
- **role="article"**: Each content unit in the feed
- **aria-posinset**: Position of the article in the feed (1-based)
- **aria-setsize**: Total number of articles (or -1 if unknown)
- **aria-labelledby**: On article, references the article title element

### Optional

- **aria-label** or **aria-labelledby**: Accessible label for the feed
- **aria-describedby**: On article, references primary content elements
- **aria-busy**: Set to `"true"` during loading operations, `"false"` when complete
- **tabindex="-1"**: On article elements to make them focusable for keyboard navigation

## Best Practices

1. **Use bElement** - Feeds require complex state management and scroll detection
2. **Use Intersection Observer** - Efficient scroll detection for lazy loading
3. **Use spread syntax** - `{...styles.x}` for applying styles
4. **Set aria-busy appropriately** - Mark feed as busy during loading operations
5. **Update aria-setsize** - Reflect total articles or use -1 for unknown/infinite
6. **Manage article focus** - Ensure articles are focusable (tabindex="-1")
7. **Scroll on focus** - Scroll focused article into view for visibility
8. **Clean up observers** - Disconnect Intersection Observer in `onDisconnected`
9. **Use `$()` with `p-target`** - never use `querySelector` directly

## Accessibility Considerations

- Screen readers use reading mode with feeds
- Articles should be focusable for keyboard navigation
- Focus movement triggers visual scrolling
- Loading state is announced via `aria-busy`
- Article position and total count help users understand context
- Feed pattern enables reliable reading mode interaction
- Articles can be skim-read using titles and descriptions

## Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome | Full support (Intersection Observer since v51) |
| Firefox | Full support (Intersection Observer since v55) |
| Safari | Full support (Intersection Observer since v12.1) |
| Edge | Full support (Intersection Observer since v15) |

## References

- Source: [W3C ARIA Authoring Practices Guide - Feed Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/feed/)
- MDN: [ARIA feed role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/feed_role)
- MDN: [ARIA article role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/article_role)
- MDN: [Intersection Observer API](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API)
