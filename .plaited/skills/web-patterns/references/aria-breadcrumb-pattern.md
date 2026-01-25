# ARIA Breadcrumb Pattern

## Overview

A breadcrumb consists of a list of links to the parent pages of the current page in hierarchical order. It helps users find their place within a website or web application. Breadcrumbs are often placed horizontally before a page's main content.

**Key Characteristics:**

- Navigation landmark region (`<nav>`)
- Ordered list structure (`<ol>`)
- Links to parent pages in hierarchical order
- Current page indicated with `aria-current="page"`
- Labeled via `aria-label` or `aria-labelledby`

## Use Cases

- Site navigation showing page hierarchy
- Application navigation showing section paths
- Document structure navigation
- Category/product navigation in e-commerce
- Multi-level navigation context

## Pattern Philosophy

This pattern is **training data** for the Plaited agent. The examples below train the agent's understanding of how to implement this pattern correctly.

- bElements/FunctionalTemplates are defined locally in stories (NOT exported)
- Only stories are exported (required for testing/training)
- Styles are always in separate `*.css.ts` files
- Use spread syntax `{...styles.x}` for applying styles

## Implementation

### Vanilla JavaScript

```html
<nav aria-label="Breadcrumb">
  <ol>
    <li>
      <a href="/">Home</a>
    </li>
    <li>
      <a href="/products">Products</a>
    </li>
    <li>
      <a href="/products/electronics">Electronics</a>
    </li>
    <li>
      <span aria-current="page">Smartphones</span>
    </li>
  </ol>
</nav>
```

```html
<!-- Alternative: Current page as link -->
<nav aria-label="Breadcrumb">
  <ol>
    <li>
      <a href="/">Home</a>
    </li>
    <li>
      <a href="/products">Products</a>
    </li>
    <li>
      <a href="/products/electronics">Electronics</a>
    </li>
    <li>
      <a href="/products/electronics/smartphones" aria-current="page">Smartphones</a>
    </li>
  </ol>
</nav>
```

### Plaited Adaptation

**File Structure:**

```
breadcrumb/
  breadcrumb.css.ts        # Styles (createStyles) - ALWAYS separate
  breadcrumb.stories.tsx   # FT/bElement + stories (imports from css.ts)
```

#### breadcrumb.css.ts

```typescript
// breadcrumb.css.ts
import { createStyles } from 'plaited'

export const styles = createStyles({
  nav: {
    marginBlockEnd: '1rem',
  },
  list: {
    display: 'flex',
    listStyle: 'none',
    padding: 0,
    margin: 0,
    gap: '0.5rem',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  item: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  link: {
    color: '#0066cc',
    textDecoration: 'none',
  },
  linkHover: {
    textDecoration: 'underline',
  },
  current: {
    color: 'inherit',
    fontWeight: 'bold',
  },
  separator: {
    color: '#666',
    userSelect: 'none',
  },
})
```

#### breadcrumb.stories.tsx

```typescript
// breadcrumb.stories.tsx
import type { FT, Children } from 'plaited/ui'
import { bElement } from 'plaited/ui'
import { story } from 'plaited/testing'
import { styles } from './breadcrumb.css.ts'

type BreadcrumbItem = {
  label: string
  href: string
  current?: boolean
}

// FunctionalTemplate - defined locally, NOT exported
const Breadcrumb: FT<{
  items: BreadcrumbItem[]
  'aria-label'?: string
}> = ({ items, 'aria-label': ariaLabel = 'Breadcrumb', ...attrs }) => (
  <nav aria-label={ariaLabel} {...attrs} {...styles.nav}>
    <ol {...styles.list}>
      {items.map((item, index) => (
        <li key={index} {...styles.item}>
          {item.current ? (
            <span aria-current="page" {...styles.current}>
              {item.label}
            </span>
          ) : (
            <a href={item.href} {...styles.link}>
              {item.label}
            </a>
          )}
          {index < items.length - 1 && (
            <span aria-hidden="true" {...styles.separator}>
              /
            </span>
          )}
        </li>
      ))}
    </ol>
  </nav>
)

// Composable breadcrumb components - defined locally, NOT exported
const BreadcrumbNav: FT<{ 'aria-label'?: string; children?: Children }> = ({
  'aria-label': ariaLabel = 'Breadcrumb',
  children,
  ...attrs
}) => (
  <nav aria-label={ariaLabel} {...attrs} {...styles.nav}>
    <ol {...styles.list}>{children}</ol>
  </nav>
)

const BreadcrumbItem: FT<{
  href?: string
  current?: boolean
  children?: Children
}> = ({ href, current, children, ...attrs }) => (
  <li {...styles.item}>
    {current ? (
      <span aria-current="page" {...styles.current} {...attrs}>
        {children}
      </span>
    ) : (
      <a href={href} {...styles.link} {...attrs}>
        {children}
      </a>
    )}
  </li>
)

const BreadcrumbSeparator: FT = () => (
  <span aria-hidden="true" {...styles.separator}>
    /
  </span>
)

// bElement for dynamic breadcrumbs - defined locally, NOT exported
const DynamicBreadcrumb = bElement({
  tag: 'pattern-breadcrumb',
  observedAttributes: ['items'],
  shadowDom: (
    <nav p-target="nav" aria-label="Breadcrumb" {...styles.nav}>
      <ol p-target="list" {...styles.list}>
        {/* Items rendered dynamically */}
      </ol>
    </nav>
  ),
  bProgram({ $, host, emit }) {
    const list = $('list')[0]

    const renderItems = (items: BreadcrumbItem[]) => {
      if (!list) return

      list.render(
        ...items.flatMap((item, index) => {
          const elements = [
            <li key={`item-${index}`} {...styles.item}>
              {item.current ? (
                <span aria-current="page" {...styles.current}>
                  {item.label}
                </span>
              ) : (
                <a
                  href={item.href}
                  p-trigger={{ click: 'handleNavigate' }}
                  data-href={item.href}
                  {...styles.link}
                >
                  {item.label}
                </a>
              )}
            </li>,
          ]

          if (index < items.length - 1) {
            elements.push(
              <li key={`sep-${index}`} {...styles.item}>
                <span aria-hidden="true" {...styles.separator}>
                  /
                </span>
              </li>
            )
          }

          return elements
        })
      )
    }

    return {
      handleNavigate(event: { target: HTMLAnchorElement }) {
        event.target.closest('a')?.getAttribute('data-href')
        const href = event.target.getAttribute('data-href')
        if (href) {
          emit({ type: 'navigate', detail: { href } })
        }
      },
      onAttributeChanged({ name, newValue }) {
        if (name === 'items' && newValue) {
          try {
            const items: BreadcrumbItem[] = JSON.parse(newValue)
            renderItems(items)
          } catch {
            // Invalid JSON, ignore
          }
        }
      },
      onConnected() {
        const itemsAttr = host.getAttribute('items')
        if (itemsAttr) {
          try {
            const items: BreadcrumbItem[] = JSON.parse(itemsAttr)
            renderItems(items)
          } catch {
            // Invalid JSON, ignore
          }
        }
      },
    }
  },
})

// Stories - EXPORTED for testing/training
export const staticBreadcrumb = story({
  intent: 'Display a static breadcrumb navigation trail using FunctionalTemplate',
  template: () => (
    <Breadcrumb
      items={[
        { label: 'Home', href: '/' },
        { label: 'Products', href: '/products' },
        { label: 'Electronics', href: '/products/electronics' },
        { label: 'Smartphones', href: '/products/electronics/smartphones', current: true },
      ]}
    />
  ),
  play: async ({ findByAttribute, assert, accessibilityCheck }) => {
    const currentPage = await findByAttribute('aria-current', 'page')

    assert({
      given: 'breadcrumb is rendered',
      should: 'have current page marked with aria-current',
      actual: currentPage?.textContent,
      expected: 'Smartphones',
    })

    await accessibilityCheck({})
  },
})

export const composableBreadcrumb = story({
  intent: 'Composable breadcrumb using individual FunctionalTemplate elements',
  template: () => (
    <BreadcrumbNav>
      <BreadcrumbItem href="/">Home</BreadcrumbItem>
      <BreadcrumbSeparator />
      <BreadcrumbItem href="/docs">Documentation</BreadcrumbItem>
      <BreadcrumbSeparator />
      <BreadcrumbItem href="/docs/components">Components</BreadcrumbItem>
      <BreadcrumbSeparator />
      <BreadcrumbItem current>Breadcrumb</BreadcrumbItem>
    </BreadcrumbNav>
  ),
  play: async ({ findByAttribute, assert }) => {
    const nav = await findByAttribute('aria-label', 'Breadcrumb')

    assert({
      given: 'composable breadcrumb is rendered',
      should: 'have nav with aria-label',
      actual: nav?.tagName.toLowerCase(),
      expected: 'nav',
    })
  },
})

export const dynamicBreadcrumb = story({
  intent: 'Dynamic breadcrumb bElement that updates from JSON attribute',
  template: () => (
    <DynamicBreadcrumb
      items={JSON.stringify([
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Settings', href: '/dashboard/settings' },
        { label: 'Profile', href: '/dashboard/settings/profile', current: true },
      ])}
    />
  ),
  play: async ({ findByAttribute, assert }) => {
    const nav = await findByAttribute('p-target', 'nav')

    assert({
      given: 'dynamic breadcrumb is rendered',
      should: 'have nav element with aria-label',
      actual: nav?.getAttribute('aria-label'),
      expected: 'Breadcrumb',
    })
  },
})

export const customSeparatorBreadcrumb = story({
  intent: 'Breadcrumb with chevron separators instead of slashes',
  template: () => (
    <BreadcrumbNav>
      <BreadcrumbItem href="/">Home</BreadcrumbItem>
      <span aria-hidden="true" {...styles.separator}>›</span>
      <BreadcrumbItem href="/category">Category</BreadcrumbItem>
      <span aria-hidden="true" {...styles.separator}>›</span>
      <BreadcrumbItem current>Current Page</BreadcrumbItem>
    </BreadcrumbNav>
  ),
  play: async ({ accessibilityCheck }) => {
    await accessibilityCheck({})
  },
})
```

## Plaited Integration

- **Works with Shadow DOM**: Optional - breadcrumbs can be FT (no Shadow DOM) or bElements (with Shadow DOM)
- **Uses bElement built-ins**: `$`, `p-trigger`, `p-target`, `emit`, `render`, `attr`
- **Requires external web API**: No
- **Cleanup required**: No

## Keyboard Interaction

**Not applicable** - Breadcrumbs use standard link navigation. Users navigate with:

- **Tab**: Moves focus to next focusable element (links)
- **Enter/Space**: Activates the link
- Standard link keyboard interaction

## WAI-ARIA Roles, States, and Properties

### Required

- **Navigation landmark**: Container element must be `<nav>` (implicit landmark role)
- **Label**: Navigation region labeled via `aria-label` or `aria-labelledby`
- **aria-current="page"**: On the current page link/element

### Optional

- **Ordered list**: Use `<ol>` to indicate ordered sequence (recommended)
- **Separator styling**: Visual separators should have `aria-hidden="true"`

## Best Practices

1. **Use FunctionalTemplates** for static breadcrumbs
2. **Use bElements** for dynamic breadcrumbs with route-based state
3. **Use semantic HTML** - `<nav>`, `<ol>`, `<li>`, and `<a>` elements
4. **Label the navigation** - always provide `aria-label` or `aria-labelledby`
5. **Indicate current page** - use `aria-current="page"` on current page element
6. **Hide visual separators** - use `aria-hidden="true"` on separators
7. **Use spread syntax** - `{...styles.x}` for applying styles
8. **Use `$()` with `p-target`** - never use `querySelector` directly

## Accessibility Considerations

- Screen readers announce the breadcrumb navigation landmark
- Screen readers announce "current page" for items with `aria-current="page"`
- Visual separators are hidden from screen readers
- Keyboard users can navigate through links using Tab
- Links should have clear, descriptive text
- Breadcrumb structure helps users understand page hierarchy

## Visual Separators

Common separator styles include:

- Forward slash: `/`
- Greater-than: `>`
- Right arrow: `→`
- Vertical bar: `|`
- Chevron: `›`

All visual separators should have `aria-hidden="true"` to prevent screen reader announcement.

## Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome | Full support |
| Firefox | Full support |
| Safari | Full support |
| Edge | Full support |

## References

- Source: [W3C ARIA Authoring Practices Guide - Breadcrumb Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/breadcrumb/)
- MDN: [HTML nav element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/nav)
- MDN: [ARIA current attribute](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-current)
