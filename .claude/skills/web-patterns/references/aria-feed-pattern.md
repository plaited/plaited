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
// Scroll-based loading
const feed = document.querySelector('[role="feed"]')
const articles = feed.querySelectorAll('[role="article"]')
let loading = false

// Intersection Observer for scroll detection
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      const article = entry.target
      const position = parseInt(article.getAttribute('aria-posinset'))
      
      // Load more articles when near the end
      if (position > articles.length - 3 && !loading) {
        loadMoreArticles()
      }
    }
  })
}, { rootMargin: '200px' })

articles.forEach(article => observer.observe(article))

// Keyboard navigation
feed.addEventListener('keydown', (e) => {
  if (e.key === 'PageDown') {
    e.preventDefault()
    moveToNextArticle()
  } else if (e.key === 'PageUp') {
    e.preventDefault()
    moveToPreviousArticle()
  } else if (e.key === 'Home' && e.ctrlKey) {
    e.preventDefault()
    moveToFirstArticle()
  } else if (e.key === 'End' && e.ctrlKey) {
    e.preventDefault()
    moveToLastArticle()
  }
})
```

### Plaited Adaptation

**Important**: In Plaited, feeds are implemented as **bElements** because they require:

- Complex state management (articles, loading state, position tracking)
- Scroll detection (Intersection Observer)
- Keyboard navigation (Page Down/Up, Ctrl+Home/End)
- Focus management
- Dynamic content loading and rendering

#### Feed bElement

```typescript
import { bElement } from 'plaited/ui'
import { createStyles } from 'plaited/ui'

type Article = {
  id: string
  title: string
  content: string
  description?: string
}

const feedStyles = createStyles({
  feed: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  article: {
    padding: '1rem',
    border: '1px solid #ccc',
    borderRadius: '4px',
  },
  title: {
    margin: '0 0 0.5rem 0',
    fontSize: '1.25rem',
  },
  content: {
    margin: 0,
  },
})

type FeedEvents = {
  loadMore: { position: number }
  articleFocus: { articleId: string; position: number }
}

export const Feed = bElement<FeedEvents>({
  tag: 'feed-widget',
  shadowDom: (
    <div
      p-target='feed'
      role='feed'
      aria-label='Feed'
      aria-busy='false'
      {...feedStyles.feed}
      p-trigger={{ keydown: 'handleKeydown' }}
    >
      {/* Articles will be dynamically rendered */}
    </div>
  ),
  bProgram({ $, host, emit, root }) {
    const feed = $('feed')[0]
    let articles: Article[] = []
    let articlesByElement = new Map<HTMLElement, Article>()
    let isLoading = false
    let totalSize: number | null = null // null for unknown, -1 for infinite
    let intersectionObserver: IntersectionObserver | undefined

    const renderArticles = () => {
      if (!feed) return
      
      feed.render(
        ...articles.map((article, index) => {
          const articleId = `article-${article.id}`
          const titleId = `${articleId}-title`
          const descriptionId = `${articleId}-description`
          
          return (
            <article
              key={article.id}
              role='article'
              aria-posinset={index + 1}
              aria-setsize={totalSize !== null ? totalSize : articles.length}
              aria-labelledby={titleId}
              aria-describedby={article.description ? descriptionId : undefined}
              id={articleId}
              tabIndex={-1}
              p-trigger={{ focus: 'handleArticleFocus' }}
              {...feedStyles.article}
            >
              <h3
                id={titleId}
                {...feedStyles.title}
              >
                {article.title}
              </h3>
              {article.description && (
                <p
                  id={descriptionId}
                  style={{ fontSize: '0.875rem', color: '#666' }}
                >
                  {article.description}
                </p>
              )}
              <div {...feedStyles.content}>
                {article.content}
              </div>
            </article>
          )
        })
      )
      
      // Re-observe articles for intersection
      observeArticles()
    }

    const observeArticles = () => {
      if (!feed || !intersectionObserver) return
      
      const articleElements = feed.querySelectorAll('[role="article"]')
      articleElements.forEach((article) => {
        intersectionObserver?.observe(article as HTMLElement)
      })
    }

    const getArticleElements = () => {
      if (!feed) return []
      return Array.from(feed.querySelectorAll('[role="article"]')) as HTMLElement[]
    }

    const moveToNextArticle = () => {
      const articleElements = getArticleElements()
      const activeElement = document.activeElement as HTMLElement
      const currentIndex = articleElements.indexOf(activeElement)
      
      if (currentIndex >= 0 && currentIndex < articleElements.length - 1) {
        const nextArticle = articleElements[currentIndex + 1]
        nextArticle.focus()
        scrollArticleIntoView(nextArticle)
      } else if (currentIndex === articleElements.length - 1) {
        // Last article - trigger load more
        emit({ type: 'loadMore', detail: { position: currentIndex + 1 } })
      }
    }

    const moveToPreviousArticle = () => {
      const articleElements = getArticleElements()
      const activeElement = document.activeElement as HTMLElement
      const currentIndex = articleElements.indexOf(activeElement)
      
      if (currentIndex > 0) {
        const previousArticle = articleElements[currentIndex - 1]
        previousArticle.focus()
        scrollArticleIntoView(previousArticle)
      }
    }

    const moveToFirstArticle = () => {
      const articleElements = getArticleElements()
      if (articleElements.length > 0) {
        articleElements[0].focus()
        scrollArticleIntoView(articleElements[0])
      }
    }

    const moveToLastArticle = () => {
      const articleElements = getArticleElements()
      if (articleElements.length > 0) {
        const lastArticle = articleElements[articleElements.length - 1]
        lastArticle.focus()
        scrollArticleIntoView(lastArticle)
      }
    }

    const scrollArticleIntoView = (article: HTMLElement) => {
      article.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }

    const setBusy = (busy: boolean) => {
      isLoading = busy
      feed?.attr('aria-busy', busy ? 'true' : 'false')
    }

    return {
      handleKeydown(event: KeyboardEvent) {
        // Only handle keys when focus is within feed
        if (!feed?.contains(document.activeElement)) return
        
        switch (event.key) {
          case 'PageDown':
            event.preventDefault()
            moveToNextArticle()
            break
          case 'PageUp':
            event.preventDefault()
            moveToPreviousArticle()
            break
          case 'Home':
            if (event.ctrlKey) {
              event.preventDefault()
              moveToFirstArticle()
            }
            break
          case 'End':
            if (event.ctrlKey) {
              event.preventDefault()
              moveToLastArticle()
            }
            break
        }
      },
      handleArticleFocus(event: { target: HTMLElement }) {
        const article = event.target
        const articleId = article.id
        const position = parseInt(article.getAttribute('aria-posinset') || '0', 10)
        
        emit({ type: 'articleFocus', detail: { articleId, position } })
        
        // Load more if near the end
        const articleElements = getArticleElements()
        const currentIndex = articleElements.indexOf(article)
        if (currentIndex >= articleElements.length - 3 && !isLoading) {
          emit({ type: 'loadMore', detail: { position: currentIndex + 1 } })
        }
      },
      addArticles(newArticles: Article[]) {
        setBusy(true)
        
        // Update articles list
        articles = [...articles, ...newArticles]
        
        // Re-render
        renderArticles()
        
        setBusy(false)
      },
      setTotalSize(size: number | null) {
        totalSize = size
        renderArticles()
      },
      onConnected() {
        // Set up Intersection Observer for scroll-based loading
        intersectionObserver = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting && !isLoading) {
                const article = entry.target as HTMLElement
                const position = parseInt(article.getAttribute('aria-posinset') || '0', 10)
                
                // Load more when last few articles are visible
                if (position >= articles.length - 2) {
                  emit({ type: 'loadMore', detail: { position } })
                }
              }
            })
          },
          { rootMargin: '200px' }
        )
        
        observeArticles()
      },
      onDisconnected() {
        // Cleanup Intersection Observer
        if (intersectionObserver) {
          intersectionObserver.disconnect()
          intersectionObserver = undefined
        }
      },
    }
  },
})
```

#### Feed with External Data Loading

```typescript
import { bElement } from 'plaited/ui'
import { createStyles } from 'plaited/ui'

type FeedEvents = {
  loadMore: { position: number }
}

export const DataFeed = bElement<FeedEvents>({
  tag: 'data-feed',
  shadowDom: (
    <div
      p-target='feed'
      role='feed'
      aria-label='Feed'
      aria-busy='false'
      p-trigger={{ keydown: 'handleKeydown' }}
    >
      <slot name='articles'></slot>
    </div>
  ),
  bProgram({ $, host, emit, trigger }) {
    const feed = $('feed')[0]
    let isLoading = false
    let intersectionObserver: IntersectionObserver | undefined

    const setBusy = (busy: boolean) => {
      isLoading = busy
      feed?.attr('aria-busy', busy ? 'true' : 'false')
    }

    return {
      handleKeydown(event: KeyboardEvent) {
        const articleElements = Array.from(
          feed?.querySelectorAll('[role="article"]') || []
        ) as HTMLElement[]
        
        const activeElement = document.activeElement as HTMLElement
        const currentIndex = articleElements.indexOf(activeElement)
        
        switch (event.key) {
          case 'PageDown':
            event.preventDefault()
            if (currentIndex >= 0 && currentIndex < articleElements.length - 1) {
              articleElements[currentIndex + 1].focus()
            } else if (currentIndex === articleElements.length - 1) {
              emit({ type: 'loadMore', detail: { position: currentIndex + 1 } })
            }
            break
          case 'PageUp':
            event.preventDefault()
            if (currentIndex > 0) {
              articleElements[currentIndex - 1].focus()
            }
            break
        }
      },
      loadMoreArticles(position: number) {
        setBusy(true)
        emit({ type: 'loadMore', detail: { position } })
      },
      articlesLoaded() {
        setBusy(false)
      },
      onConnected() {
        // Set up observer for scroll-based loading
        intersectionObserver = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting && !isLoading) {
                const article = entry.target as HTMLElement
                const position = parseInt(article.getAttribute('aria-posinset') || '0', 10)
                const totalElements = feed?.querySelectorAll('[role="article"]').length || 0
                
                if (position >= totalElements - 2) {
                  trigger({ type: 'loadMoreArticles', detail: position })
                }
              }
            })
          },
          { rootMargin: '200px' }
        )
        
        // Observe articles from slot
        const slot = feed?.querySelector('slot[name="articles"]') as HTMLSlotElement
        if (slot) {
          slot.addEventListener('slotchange', () => {
            const assignedNodes = slot.assignedElements()
            assignedNodes.forEach((node) => {
              if (node.hasAttribute('role') && node.getAttribute('role') === 'article') {
                intersectionObserver?.observe(node as HTMLElement)
              }
            })
          })
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
```

## Plaited Integration

- **Works with Shadow DOM**: Yes - feeds are bElements with Shadow DOM
- **Uses bElement built-ins**: 
  - `p-trigger` for keyboard events and focus events
  - `p-target` for element selection with `$()`
  - `render()` helper for dynamic article rendering
  - `attr()` helper for managing ARIA attributes
- **Requires external web API**: 
  - Intersection Observer API (for scroll detection)
  - Focus management APIs (`focus()`, `scrollIntoView()`)
  - Keyboard event handling
- **Cleanup required**: Yes - Intersection Observer must be disconnected in `onDisconnected`

## Keyboard Interaction

When focus is inside the feed:

- **Page Down**: Moves focus to the next article
- **Page Up**: Moves focus to the previous article
- **Control + End**: Moves focus to the first focusable element after the feed
- **Control + Home**: Moves focus to the first focusable element before the feed

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
3. **Set aria-busy appropriately** - Mark feed as busy during loading operations
4. **Update aria-setsize** - Reflect total articles or use -1 for unknown/infinite
5. **Manage article focus** - Ensure articles are focusable (tabindex="-1")
6. **Scroll on focus** - Scroll focused article into view for visibility
7. **Provide article labels** - Use `aria-labelledby` to reference title
8. **Provide article descriptions** - Use `aria-describedby` for primary content
9. **Clean up observers** - Disconnect Intersection Observer in `onDisconnected`
10. **Document keyboard shortcuts** - Feed pattern has less established conventions

## Accessibility Considerations

- Screen readers use reading mode with feeds
- Articles should be focusable for keyboard navigation
- Focus movement triggers visual scrolling
- Loading state is announced via `aria-busy`
- Article position and total count help users understand context
- Feed pattern enables reliable reading mode interaction
- Articles can be skim-read using titles and descriptions

## Interoperability Contract

The feed pattern establishes an agreement between web pages and assistive technologies:

**Web Page Responsibilities:**

- Scroll content based on which article has DOM focus
- Load/remove articles based on focus position
- Update ARIA attributes (aria-busy, aria-setsize, aria-posinset)

**Assistive Technology Responsibilities:**

- Ensure article or descendant has DOM focus to indicate reading cursor
- Provide reading mode keys to navigate articles
- Provide keys to move past start/end of feed

## Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome | Full support (Intersection Observer since v51) |
| Firefox | Full support (Intersection Observer since v55) |
| Safari | Full support (Intersection Observer since v12.1) |
| Edge | Full support (Intersection Observer since v15) |

**Note**: Intersection Observer API and ARIA attributes have universal support in modern browsers with assistive technology.

## References

- Source: [W3C ARIA Authoring Practices Guide - Feed Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/feed/)
- MDN: [ARIA feed role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/feed_role)
- MDN: [ARIA article role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/article_role)
- MDN: [Intersection Observer API](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API)
