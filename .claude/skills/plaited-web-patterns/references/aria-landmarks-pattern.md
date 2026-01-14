# ARIA Landmarks Pattern

## Overview

Landmarks are a set of eight roles that identify the major sections of a page. Each landmark role enables assistive technology users to perceive the start and end of a feature of the high-level page structure that is usually conveyed visually with placement, spacing, color, or borders. In addition to conveying structure, landmarks enable browsers and assistive technologies to facilitate efficient keyboard navigation among sections of a page.

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

## Use Cases

- Page structure organization
- Site navigation regions
- Main content areas
- Sidebar/aside content
- Footer information
- Search functionality
- Form sections
- Generic content regions

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
  <ul>
    <li><a href="/article1">Article 1</a></li>
  </ul>
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

<div role="region" aria-label="Featured products">
  <h2>Featured Products</h2>
  <!-- Product content -->
</div>
```

### Plaited Adaptation

**Important**: In Plaited, landmarks are typically implemented as:
1. **Semantic HTML elements** directly in templates (preferred)
2. **Functional Templates (FT)** for reusable landmark containers
3. **Within bElements** as structural elements in shadowDom

Landmarks don't require complex state management, so they're usually simple structural elements rather than bElements themselves.

#### Page Layout with Landmarks (Functional Template)

```typescript
// layout.stories.tsx
import type { FT, Children } from 'plaited/ui'
import { joinStyles } from 'plaited/ui'
import { layoutStyles } from './layout.css.ts'

const PageLayout: FT<{ children?: Children }> = ({ children, ...attrs }) => (
  <div {...joinStyles(layoutStyles.page)} {...attrs}>
    <header role='banner' {...layoutStyles.header}>
      <slot name='header'></slot>
    </header>
    
    <nav aria-label='Main navigation' {...layoutStyles.nav}>
      <slot name='navigation'></slot>
    </nav>
    
    <main {...layoutStyles.main}>
      {children}
    </main>
    
    <aside role='complementary' aria-label='Sidebar' {...layoutStyles.aside}>
      <slot name='sidebar'></slot>
    </aside>
    
    <footer role='contentinfo' {...layoutStyles.footer}>
      <slot name='footer'></slot>
    </footer>
  </div>
)

export const pageLayoutStory = story({
  intent: 'Display a page layout with all landmark regions',
  template: () => (
    <PageLayout>
      <h1 slot='header'>Site Title</h1>
      <nav slot='navigation'>
        <a href='/'>Home</a>
        <a href='/about'>About</a>
      </nav>
      <h2>Page Content</h2>
      <p>Main content goes here...</p>
      <div slot='sidebar'>
        <h3>Related</h3>
        <p>Sidebar content</p>
      </div>
      <p slot='footer'>&copy; 2024</p>
    </PageLayout>
  ),
})
```

#### Navigation Landmark (Functional Template)

```typescript
// navigation.stories.tsx
import type { FT, Children } from 'plaited/ui'
import { joinStyles } from 'plaited/ui'
import { navStyles } from './navigation.css.ts'

const Navigation: FT<{
  'aria-label'?: string
  children?: Children
}> = ({ 'aria-label': ariaLabel = 'Main navigation', children, ...attrs }) => (
  <nav
    aria-label={ariaLabel}
    {...attrs}
    {...joinStyles(navStyles.nav)}
  >
    {children}
  </nav>
)

export const mainNavigation = story({
  intent: 'Display main site navigation',
  template: () => (
    <Navigation aria-label='Main navigation'>
      <ul>
        <li><a href='/'>Home</a></li>
        <li><a href='/products'>Products</a></li>
        <li><a href='/about'>About</a></li>
      </ul>
    </Navigation>
  ),
})
```

#### Search Landmark (Functional Template)

```typescript
// search.stories.tsx
import type { FT } from 'plaited/ui'
import { joinStyles } from 'plaited/ui'
import { searchStyles } from './search.css.ts'

const Search: FT<{
  'aria-label'?: string
  placeholder?: string
}> = ({ 'aria-label': ariaLabel = 'Search', placeholder = 'Search...', ...attrs }) => (
  <div
    role='search'
    aria-label={ariaLabel}
    {...attrs}
    {...joinStyles(searchStyles.search)}
  >
    <form {...searchStyles.form}>
      <input
        type='search'
        placeholder={placeholder}
        aria-label='Search query'
        {...searchStyles.input}
      />
      <button type='submit' aria-label='Submit search' {...searchStyles.button}>
        Search
      </button>
    </form>
  </div>
)

export const searchLandmark = story({
  intent: 'Display search landmark',
  template: () => <Search aria-label='Site search' />,
})
```

#### Region Landmark (Functional Template)

```typescript
// region.stories.tsx
import type { FT, Children } from 'plaited/ui'
import { joinStyles } from 'plaited/ui'
import { regionStyles } from './region.css.ts'

const Region: FT<{
  'aria-label': string
  children?: Children
}> = ({ 'aria-label': ariaLabel, children, ...attrs }) => (
  <section
    role='region'
    aria-label={ariaLabel}
    {...attrs}
    {...joinStyles(regionStyles.region)}
  >
    {children}
  </section>
)

export const featuredRegion = story({
  intent: 'Display a region landmark',
  template: () => (
    <Region aria-label='Featured products'>
      <h2>Featured Products</h2>
      <p>Product content...</p>
    </Region>
  ),
})
```

#### Landmarks in bElement shadowDom

```typescript
import { bElement } from 'plaited/ui'
import { createStyles } from 'plaited/ui'

const appStyles = createStyles({
  container: {
    display: 'grid',
    gridTemplateAreas: '"header" "nav" "main" "footer"',
    gridTemplateRows: 'auto auto 1fr auto',
    minHeight: '100vh',
  },
  header: {
    gridArea: 'header',
    padding: '1rem',
  },
  nav: {
    gridArea: 'nav',
    padding: '1rem',
  },
  main: {
    gridArea: 'main',
    padding: '1rem',
  },
  footer: {
    gridArea: 'footer',
    padding: '1rem',
  },
})

export const AppLayout = bElement({
  tag: 'app-layout',
  shadowDom: (
    <div {...appStyles.container}>
      <header role='banner' {...appStyles.header}>
        <slot name='header'></slot>
      </header>
      
      <nav aria-label='Main navigation' {...appStyles.nav}>
        <slot name='navigation'></slot>
      </nav>
      
      <main {...appStyles.main}>
        <slot></slot>
      </main>
      
      <footer role='contentinfo' {...appStyles.footer}>
        <slot name='footer'></slot>
      </footer>
    </div>
  ),
  bProgram() {
    return {}
  },
})
```

## Plaited Integration

- **Works with Shadow DOM**: Yes - landmarks can be used in bElement shadowDom
- **Uses bElement built-ins**: Not typically - landmarks are structural elements
- **Requires external web API**: No - uses standard HTML elements and ARIA
- **Cleanup required**: No - standard DOM elements handle their own lifecycle

## Keyboard Interaction

**Not applicable** - Landmarks don't have keyboard interaction themselves. However, assistive technologies provide keyboard shortcuts to navigate between landmarks (e.g., screen reader landmark navigation).

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
| `<section>` | `region` | If has accessible name (`aria-label` or `aria-labelledby`) |
| `<search>` | `search` | Always creates search landmark |

### Explicit ARIA Roles

When HTML elements don't exist or don't create the desired landmark:

- **role="banner"**: Site header
- **role="navigation"**: Navigation region
- **role="main"**: Main content
- **role="complementary"**: Sidebar/aside
- **role="contentinfo"**: Footer
- **role="search"**: Search functionality
- **role="form"**: Form region
- **role="region"**: Generic section

### Required Properties

- **aria-label** or **aria-labelledby**: Required for `role="region"` and recommended for other landmarks when label isn't obvious

## Best Practices

1. **Prefer semantic HTML** - Use native elements (`<main>`, `<nav>`, etc.) when possible
2. **Use Functional Templates** - For reusable landmark containers in stories
3. **Label appropriately** - Provide `aria-label` or `aria-labelledby` for clarity
4. **Limit landmarks** - Aim for 7 or fewer landmarks per page
5. **Cover all content** - Ensure all content is within an appropriate landmark
6. **Avoid redundancy** - Don't use both HTML element and ARIA role
7. **Use region sparingly** - Only use `role="region"` when semantic HTML isn't appropriate
8. **Multiple navigation** - Label multiple `<nav>` elements with `aria-label`

## Accessibility Considerations

- Screen readers provide landmark navigation shortcuts
- Users can jump between landmarks quickly
- Landmarks help users understand page structure
- Too many landmarks can be overwhelming
- All content should be within landmarks
- Landmarks enable efficient page navigation

## Landmark Types and Usage

### Banner (role="banner" or `<header>`)
- Site header, typically at top of page
- Usually contains site title/logo
- Only one per page (unless nested in article/section)

### Navigation (role="navigation" or `<nav>`)
- Navigation links
- Can have multiple if labeled differently
- Use `aria-label` to distinguish multiple nav regions

### Main (role="main" or `<main>`)
- Primary content of the page
- Only one per page
- Should contain the main topic/content

### Complementary (role="complementary" or `<aside>`)
- Sidebar content, related but not essential
- Can have multiple if labeled differently
- Use `aria-label` to distinguish

### Contentinfo (role="contentinfo" or `<footer>`)
- Footer information (copyright, links, etc.)
- Usually at bottom of page
- Only one per page (unless nested)

### Search (role="search" or `<search>`)
- Search functionality
- Can have multiple if labeled differently
- Contains search form

### Form (role="form" or `<form>`)
- Form region (only if has accessible name)
- Use when form is a major page section
- Not needed for every form

### Region (role="region" or `<section>` with label)
- Generic content section
- Must have accessible name
- Use when no other landmark is appropriate

## Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome | Full support |
| Firefox | Full support |
| Safari | Full support |
| Edge | Full support |

**Note**: Semantic HTML elements and ARIA landmark roles have universal support in modern browsers with assistive technology.

## References

- Source: [W3C ARIA Authoring Practices Guide - Landmarks Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/landmarks/)
- Related: [Landmark Regions Practice](https://www.w3.org/WAI/ARIA/apg/practices/landmark-regions/)
- MDN: [HTML main element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/main)
- MDN: [HTML nav element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/nav)
- MDN: [HTML header element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/header)
- MDN: [HTML footer element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/footer)
- MDN: [HTML aside element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/aside)
- MDN: [HTML search element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/search)
