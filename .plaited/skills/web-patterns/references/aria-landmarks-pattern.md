# ARIA Landmarks Pattern

## Overview

Landmarks are a set of eight roles that identify the major sections of a page. Each landmark role enables assistive technology users to perceive the high-level page structure that is usually conveyed visually with placement, spacing, color, or borders.

**Key Characteristics:**

- **Structural elements**: Identify major page sections
- **Implicit landmarks**: Many HTML elements automatically create landmarks
- **Navigation aid**: Enable quick navigation between page sections
- **Best practice**: Use 7 or fewer landmarks per page
- **Content coverage**: All content should be within an appropriate landmark

**The Eight Landmark Roles:**

1. **banner** - Site header (usually `<header>`)
2. **navigation** - Navigation links (`<nav>`)
3. **main** - Main content (`<main>`)
4. **complementary** - Sidebar content (`<aside>`)
5. **contentinfo** - Site footer (usually `<footer>`)
6. **search** - Search functionality (`<search>` or `role="search"`)
7. **form** - Form region (`<form>` or `role="form"`)
8. **region** - Generic section (`<section>` with `aria-label` or `role="region"`)

**Native HTML First:** Prefer semantic HTML elements (`<header>`, `<nav>`, `<main>`, `<aside>`, `<footer>`, `<search>`) over ARIA roles. They provide automatic landmark roles.

## Use Cases

- Page structure organization
- Site navigation regions
- Main content areas
- Sidebar/aside content
- Footer information
- Search functionality
- Form sections
- Generic content regions

## Pattern Philosophy

This pattern is **training data** for the Plaited agent. The examples below train the agent's understanding of how to implement this pattern correctly.

- bElements/FunctionalTemplates are defined locally in stories (NOT exported)
- Only stories are exported (required for testing/training)
- Styles are always in separate `*.css.ts` files
- Use spread syntax `{...styles.x}` for applying styles

## Implementation

### Vanilla JavaScript

```html
<!-- Using semantic HTML (implicit landmarks) -->
<header role="banner">
  <h1>Site Title</h1>
</header>

<nav aria-label="Main navigation">
  <ul>
    <li><a href="/">Home</a></li>
    <li><a href="/about">About</a></li>
  </ul>
</nav>

<main>
  <h2>Page Title</h2>
  <p>Main content...</p>
</main>

<aside role="complementary" aria-label="Related articles">
  <h3>Related</h3>
</aside>

<footer role="contentinfo">
  <p>&copy; 2024 Company</p>
</footer>

<!-- Using ARIA roles (when HTML element doesn't exist) -->
<div role="search" aria-label="Site search">
  <form>
    <input type="search" placeholder="Search...">
    <button type="submit">Search</button>
  </form>
</div>
```

### Plaited Adaptation

**File Structure:**

```
layout/
  layout.css.ts        # Styles (createStyles) - ALWAYS separate
  layout.stories.tsx   # FT/bElement + stories (imports from css.ts)
```

#### layout.css.ts

```typescript
// layout.css.ts
import { createStyles, createHostStyles } from 'plaited'

export const hostStyles = createHostStyles({
  display: 'block',
})

export const styles = createStyles({
  page: {
    display: 'grid',
    gridTemplateAreas: '"header" "nav" "main" "aside" "footer"',
    gridTemplateRows: 'auto auto 1fr auto auto',
    minBlockSize: '100vh',
  },
  header: {
    gridArea: 'header',
    padding: '1rem',
    backgroundColor: '#f8f9fa',
    borderBlockEnd: '1px solid #dee2e6',
  },
  nav: {
    gridArea: 'nav',
    padding: '1rem',
    backgroundColor: '#e9ecef',
  },
  main: {
    gridArea: 'main',
    padding: '1rem',
  },
  aside: {
    gridArea: 'aside',
    padding: '1rem',
    backgroundColor: '#f8f9fa',
  },
  footer: {
    gridArea: 'footer',
    padding: '1rem',
    backgroundColor: '#343a40',
    color: 'white',
  },
})

export const navStyles = createStyles({
  nav: {
    display: 'flex',
    gap: '1rem',
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
  link: {
    color: '#007bff',
    textDecoration: 'none',
  },
})

export const searchStyles = createStyles({
  search: {
    display: 'flex',
    gap: '0.5rem',
  },
  input: {
    padding: '0.5rem',
    border: '1px solid #ccc',
    borderRadius: '4px',
  },
  button: {
    padding: '0.5rem 1rem',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
})

export const regionStyles = createStyles({
  region: {
    padding: '1rem',
    border: '1px solid #dee2e6',
    borderRadius: '4px',
    marginBlockEnd: '1rem',
  },
})
```

#### layout.stories.tsx

```typescript
// layout.stories.tsx
import type { FT, Children } from 'plaited/ui'
import { bElement } from 'plaited/ui'
import { story } from 'plaited/testing'
import { styles, navStyles, searchStyles, regionStyles, hostStyles } from './layout.css.ts'

// FunctionalTemplate for page layout - defined locally, NOT exported
const PageLayout: FT<{ children?: Children }> = ({ children }) => (
  <div {...styles.page}>
    <header role="banner" {...styles.header}>
      <slot name="header"></slot>
    </header>

    <nav aria-label="Main navigation" {...styles.nav}>
      <slot name="navigation"></slot>
    </nav>

    <main {...styles.main}>
      {children}
    </main>

    <aside role="complementary" aria-label="Sidebar" {...styles.aside}>
      <slot name="sidebar"></slot>
    </aside>

    <footer role="contentinfo" {...styles.footer}>
      <slot name="footer"></slot>
    </footer>
  </div>
)

// FunctionalTemplate for navigation - defined locally, NOT exported
const Navigation: FT<{
  'aria-label'?: string
  children?: Children
}> = ({ 'aria-label': ariaLabel = 'Main navigation', children }) => (
  <nav aria-label={ariaLabel} {...navStyles.nav}>
    {children}
  </nav>
)

// FunctionalTemplate for search - defined locally, NOT exported
const Search: FT<{
  'aria-label'?: string
  placeholder?: string
}> = ({ 'aria-label': ariaLabel = 'Search', placeholder = 'Search...' }) => (
  <div role="search" aria-label={ariaLabel} {...searchStyles.search}>
    <input
      type="search"
      placeholder={placeholder}
      aria-label="Search query"
      {...searchStyles.input}
    />
    <button type="submit" aria-label="Submit search" {...searchStyles.button}>
      Search
    </button>
  </div>
)

// FunctionalTemplate for region - defined locally, NOT exported
const Region: FT<{
  'aria-label': string
  children?: Children
}> = ({ 'aria-label': ariaLabel, children }) => (
  <section role="region" aria-label={ariaLabel} {...regionStyles.region}>
    {children}
  </section>
)

// bElement for app layout - defined locally, NOT exported
const AppLayout = bElement({
  tag: 'pattern-app-layout',
  hostStyles,
  shadowDom: (
    <div {...styles.page}>
      <header role="banner" {...styles.header}>
        <slot name="header"></slot>
      </header>

      <nav aria-label="Main navigation" {...styles.nav}>
        <slot name="navigation"></slot>
      </nav>

      <main {...styles.main}>
        <slot></slot>
      </main>

      <footer role="contentinfo" {...styles.footer}>
        <slot name="footer"></slot>
      </footer>
    </div>
  ),
  bProgram() {
    return {}
  },
})

// Stories - EXPORTED for testing/training
export const fullPageLayout = story({
  intent: 'Display a complete page layout with all landmark regions',
  template: () => (
    <AppLayout>
      <h1 slot="header">Site Title</h1>
      <ul slot="navigation" style="display: flex; gap: 1rem; list-style: none; margin: 0; padding: 0;">
        <li><a href="/">Home</a></li>
        <li><a href="/about">About</a></li>
        <li><a href="/contact">Contact</a></li>
      </ul>
      <h2>Main Content</h2>
      <p>This is the main content area of the page.</p>
      <p slot="footer">&copy; 2024 Company Name</p>
    </AppLayout>
  ),
  play: async ({ findByRole, assert }) => {
    const main = await findByRole('main')
    const banner = await findByRole('banner')
    const contentinfo = await findByRole('contentinfo')
    const nav = await findByRole('navigation')

    assert({
      given: 'page layout is rendered',
      should: 'have main landmark',
      actual: main !== null,
      expected: true,
    })

    assert({
      given: 'page layout is rendered',
      should: 'have banner landmark',
      actual: banner !== null,
      expected: true,
    })

    assert({
      given: 'page layout is rendered',
      should: 'have contentinfo landmark',
      actual: contentinfo !== null,
      expected: true,
    })

    assert({
      given: 'page layout is rendered',
      should: 'have navigation landmark',
      actual: nav !== null,
      expected: true,
    })
  },
})

export const navigationLandmark = story({
  intent: 'Display a navigation landmark with links',
  template: () => (
    <Navigation aria-label="Main navigation">
      <a href="/" style="color: #007bff; text-decoration: none;">Home</a>
      <a href="/products" style="color: #007bff; text-decoration: none;">Products</a>
      <a href="/about" style="color: #007bff; text-decoration: none;">About</a>
      <a href="/contact" style="color: #007bff; text-decoration: none;">Contact</a>
    </Navigation>
  ),
  play: async ({ findByRole, assert }) => {
    const nav = await findByRole('navigation')

    assert({
      given: 'navigation is rendered',
      should: 'have aria-label',
      actual: nav?.getAttribute('aria-label'),
      expected: 'Main navigation',
    })
  },
})

export const searchLandmark = story({
  intent: 'Display a search landmark for site-wide search',
  template: () => (
    <Search aria-label="Site search" placeholder="Search the site..." />
  ),
  play: async ({ findByRole, assert }) => {
    const search = await findByRole('search')

    assert({
      given: 'search landmark is rendered',
      should: 'have search role',
      actual: search?.getAttribute('role'),
      expected: 'search',
    })

    assert({
      given: 'search landmark is rendered',
      should: 'have aria-label',
      actual: search?.getAttribute('aria-label'),
      expected: 'Site search',
    })
  },
})

export const regionLandmark = story({
  intent: 'Display a generic region landmark with accessible label',
  template: () => (
    <Region aria-label="Featured products">
      <h2>Featured Products</h2>
      <p>Check out our latest featured products...</p>
    </Region>
  ),
  play: async ({ findByRole, assert }) => {
    const region = await findByRole('region')

    assert({
      given: 'region is rendered',
      should: 'have aria-label',
      actual: region?.getAttribute('aria-label'),
      expected: 'Featured products',
    })
  },
})

export const multipleLandmarks = story({
  intent: 'Display multiple navigation landmarks with distinct labels',
  template: () => (
    <div>
      <Navigation aria-label="Main navigation">
        <a href="/">Home</a>
        <a href="/products">Products</a>
      </Navigation>
      <Navigation aria-label="Footer navigation">
        <a href="/privacy">Privacy</a>
        <a href="/terms">Terms</a>
      </Navigation>
    </div>
  ),
  play: async ({ findAllByRole, assert }) => {
    const navs = await findAllByRole('navigation')

    assert({
      given: 'multiple navigations are rendered',
      should: 'have 2 navigation landmarks',
      actual: navs?.length,
      expected: 2,
    })
  },
})
```

## Plaited Integration

- **Works with Shadow DOM**: Yes - landmarks can be used in bElement shadowDom
- **Uses bElement built-ins**: Not typically - landmarks are structural elements
- **Requires external web API**: No - uses standard HTML elements and ARIA
- **Cleanup required**: No

## Keyboard Interaction

**Not applicable** - Landmarks don't have keyboard interaction themselves. However, assistive technologies provide keyboard shortcuts to navigate between landmarks.

## WAI-ARIA Roles, States, and Properties

### Implicit Landmarks (HTML Elements)

| HTML Element | Implicit Role | Notes |
|--------------|---------------|-------|
| `<header>` | `banner` | If not descendant of `<article>`, `<aside>`, `<main>`, `<nav>`, or `<section>` |
| `<nav>` | `navigation` | Always creates navigation landmark |
| `<main>` | `main` | Always creates main landmark |
| `<aside>` | `complementary` | Always creates complementary landmark |
| `<footer>` | `contentinfo` | If not descendant of `<article>` or `<section>` |
| `<form>` | `form` | If has accessible name |
| `<section>` | `region` | If has accessible name |
| `<search>` | `search` | Always creates search landmark |

### Required Properties

- **aria-label** or **aria-labelledby**: Required for `role="region"` and recommended for multiple same-type landmarks

## Best Practices

1. **Prefer semantic HTML** - Use native elements (`<main>`, `<nav>`, etc.)
2. **Use FunctionalTemplates** - For reusable landmark containers in stories
3. **Use spread syntax** - `{...styles.x}` for applying styles
4. **Label appropriately** - Provide `aria-label` or `aria-labelledby` for clarity
5. **Limit landmarks** - Aim for 7 or fewer landmarks per page
6. **Cover all content** - Ensure all content is within an appropriate landmark
7. **Avoid redundancy** - Don't use both HTML element and ARIA role
8. **Multiple navigation** - Label multiple `<nav>` elements with `aria-label`

## Accessibility Considerations

- Screen readers provide landmark navigation shortcuts
- Users can jump between landmarks quickly
- Landmarks help users understand page structure
- Too many landmarks can be overwhelming
- All content should be within landmarks
- Landmarks enable efficient page navigation

## Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome | Full support |
| Firefox | Full support |
| Safari | Full support |
| Edge | Full support |

## References

- Source: [W3C ARIA Authoring Practices Guide - Landmarks Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/landmarks/)
- Related: [Landmark Regions Practice](https://www.w3.org/WAI/ARIA/apg/practices/landmark-regions/)
- MDN: [HTML main element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/main)
- MDN: [HTML nav element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/nav)
- MDN: [HTML header element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/header)
- MDN: [HTML footer element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/footer)
