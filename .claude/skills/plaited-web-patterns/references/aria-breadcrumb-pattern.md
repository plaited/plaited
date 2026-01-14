# ARIA Breadcrumb Pattern

## Overview

A breadcrumb trail consists of a list of links to the parent pages of the current page in hierarchical order. It helps users find their place within a website or web application. Breadcrumbs are often placed horizontally before a page's main content.

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

**Important**: In Plaited, breadcrumbs can be implemented as:
1. **Functional Templates (FT)** for static breadcrumbs in stories
2. **bElements** for dynamic breadcrumbs that need route-based state management

#### Static Breadcrumb (Functional Template)

```typescript
// breadcrumb.stories.tsx
import type { FT, Children } from 'plaited/ui'
import { joinStyles } from 'plaited/ui'
import { breadcrumbStyles } from './breadcrumb.css.ts'

type BreadcrumbItem = {
  label: string
  href: string
  current?: boolean
}

type BreadcrumbProps = {
  items: BreadcrumbItem[]
  'aria-label'?: string
}

const Breadcrumb: FT<BreadcrumbProps> = ({ items, 'aria-label': ariaLabel = 'Breadcrumb', ...attrs }) => (
  <nav
    aria-label={ariaLabel}
    {...attrs}
    {...joinStyles(breadcrumbStyles.nav)}
  >
    <ol {...breadcrumbStyles.list}>
      {items.map((item, index) => (
        <li key={index} {...breadcrumbStyles.item}>
          {item.current ? (
            <span
              aria-current='page'
              {...breadcrumbStyles.current}
            >
              {item.label}
            </span>
          ) : (
            <a
              href={item.href}
              {...breadcrumbStyles.link}
            >
              {item.label}
            </a>
          )}
          {index < items.length - 1 && (
            <span
              aria-hidden='true'
              {...breadcrumbStyles.separator}
            >
              /
            </span>
          )}
        </li>
      ))}
    </ol>
  </nav>
)

export const breadcrumbStory = story({
  intent: 'Display a breadcrumb navigation trail',
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
  play: async ({ accessibilityCheck }) => {
    await accessibilityCheck({})
  },
})
```

#### Dynamic Breadcrumb (bElement)

```typescript
import { bElement } from 'plaited/ui'
import { createStyles } from 'plaited/ui'

type BreadcrumbItem = {
  label: string
  href: string
  current?: boolean
}

const breadcrumbStyles = createStyles({
  nav: {
    marginBottom: '1rem',
  },
  list: {
    display: 'flex',
    listStyle: 'none',
    padding: 0,
    margin: 0,
    gap: '0.5rem',
    alignItems: 'center',
  },
  item: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  link: {
    color: 'blue',
    textDecoration: {
      $default: 'none',
      ':hover': 'underline',
    },
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

type BreadcrumbEvents = {
  navigate: { href: string }
}

export const Breadcrumb = bElement<BreadcrumbEvents>({
  tag: 'breadcrumb-nav',
  observedAttributes: ['items'],
  shadowDom: (
    <nav
      p-target='nav'
      aria-label='Breadcrumb'
      {...breadcrumbStyles.nav}
    >
      <ol
        p-target='list'
        {...breadcrumbStyles.list}
      >
        {/* Items will be dynamically rendered */}
      </ol>
    </nav>
  ),
  bProgram({ $, host, emit, root }) {
    const list = $('list')[0]

    const renderItems = (items: BreadcrumbItem[]) => {
      if (!list) return

      list.render(
        ...items.map((item, index) => (
          <li key={index} {...breadcrumbStyles.item}>
            {item.current ? (
              <span
                aria-current='page'
                {...breadcrumbStyles.current}
              >
                {item.label}
              </span>
            ) : (
              <a
                href={item.href}
                p-trigger={{ click: 'handleNavigate' }}
                data-href={item.href}
                {...breadcrumbStyles.link}
              >
                {item.label}
              </a>
            )}
            {index < items.length - 1 && (
              <span
                aria-hidden='true'
                {...breadcrumbStyles.separator}
              >
                /
              </span>
            )}
          </li>
        ))
      )
    }

    return {
      handleNavigate(event: { target: HTMLAnchorElement }) {
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
```

#### Breadcrumb with Slot Content

```typescript
import type { FT, Children } from 'plaited/ui'
import { joinStyles } from 'plaited/ui'
import { breadcrumbStyles } from './breadcrumb.css.ts'

const Breadcrumb: FT<{ 'aria-label'?: string; children?: Children }> = ({
  'aria-label': ariaLabel = 'Breadcrumb',
  children,
  ...attrs
}) => (
  <nav
    aria-label={ariaLabel}
    {...attrs}
    {...joinStyles(breadcrumbStyles.nav)}
  >
    <ol {...breadcrumbStyles.list}>
      {children}
    </ol>
  </nav>
)

const BreadcrumbItem: FT<{
  href?: string
  current?: boolean
  children?: Children
}> = ({ href, current, children, ...attrs }) => (
  <li {...breadcrumbStyles.item}>
    {current ? (
      <span
        aria-current='page'
        {...breadcrumbStyles.current}
        {...attrs}
      >
        {children}
      </span>
    ) : (
      <a
        href={href}
        {...breadcrumbStyles.link}
        {...attrs}
      >
        {children}
      </a>
    )}
  </li>
)

const BreadcrumbSeparator: FT = () => (
  <span
    aria-hidden='true'
    {...breadcrumbStyles.separator}
  >
    /
  </span>
)

// Usage
<Breadcrumb>
  <BreadcrumbItem href='/'>Home</BreadcrumbItem>
  <BreadcrumbSeparator />
  <BreadcrumbItem href='/products'>Products</BreadcrumbItem>
  <BreadcrumbSeparator />
  <BreadcrumbItem href='/products/electronics'>Electronics</BreadcrumbItem>
  <BreadcrumbSeparator />
  <BreadcrumbItem current>Smartphones</BreadcrumbItem>
</Breadcrumb>
```

## Plaited Integration

- **Works with Shadow DOM**: Optional - breadcrumbs can be FT (no Shadow DOM) or bElements (with Shadow DOM)
- **Uses bElement built-ins** (if using bElement):
  - `p-trigger` for link click handling
  - `p-target` for element selection with `$()`
  - `render()` helper for dynamic item rendering
  - `attr()` helper for managing attributes
  - `observedAttributes` for reactive updates
- **Requires external web API**: No - uses standard HTML elements and ARIA
- **Cleanup required**: No - standard DOM elements handle their own lifecycle

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

1. **Use Functional Templates** for static breadcrumbs in stories
2. **Use bElements** for dynamic breadcrumbs that need route-based state
3. **Use semantic HTML** - `<nav>`, `<ol>`, `<li>`, and `<a>` elements
4. **Label the navigation** - Always provide `aria-label` or `aria-labelledby`
5. **Indicate current page** - Use `aria-current="page"` on current page element
6. **Hide visual separators from screen readers** - Use `aria-hidden="true"` on separators
7. **Keep hierarchy clear** - List items in order from top-level to current page
8. **Provide meaningful link text** - Use descriptive labels for each level
9. **Support both link and span** - Current page can be link or non-link element

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

**Note**: Native HTML elements and ARIA attributes have universal support in modern browsers with assistive technology.

## References

- Source: [W3C ARIA Authoring Practices Guide - Breadcrumb Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/breadcrumb/)
- MDN: [HTML nav element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/nav)
- MDN: [ARIA current attribute](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-current)
