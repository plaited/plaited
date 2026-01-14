# ARIA Link Pattern

## Overview

A link widget provides an interactive reference to a resource. The target resource can be either external or local, i.e., either outside or within the current page or application.

**Key Characteristics:**
- Interactive reference to a resource (internal or external)
- Native HTML `<a>` element is strongly preferred
- Keyboard accessible (Enter key activates)
- Optional context menu support (Shift+F10)
- Can contain text or graphics
- Supports various link types (navigation, download, external, etc.)

**Important Note**: Authors are strongly encouraged to use a native host language link element, such as an HTML `<a>` element with an `href` attribute. Applying the `link` role to an element will not cause browsers to enhance the element with standard link behaviors, such as navigation to the link target or context menu actions. When using the `link` role, providing these features is the author's responsibility.

## Use Cases

- Navigation between pages
- External links to other websites
- Internal page anchors (fragment links)
- Download links
- Email links (`mailto:`)
- Telephone links (`tel:`)
- Opening links in new tabs/windows
- Skip navigation links
- Breadcrumb navigation
- Related content links

## Implementation

### Vanilla JavaScript

```html
<!-- Standard link -->
<a href="/about">About Us</a>

<!-- External link with indicator -->
<a href="https://example.com" target="_blank" rel="noopener noreferrer">
  External Site
  <span aria-label="Opens in new tab">(opens in new tab)</span>
</a>

<!-- Download link -->
<a href="/document.pdf" download>Download PDF</a>

<!-- Email link -->
<a href="mailto:contact@example.com">Contact Us</a>

<!-- Link with ARIA role (only when native <a> cannot be used) -->
<span role="link" tabindex="0" onclick="window.location.href='/page'">
  Custom Link
</span>
```

```javascript
// Custom link implementation (not recommended - use native <a>)
const customLink = document.querySelector('[role="link"]')
customLink.addEventListener('click', () => {
  window.location.href = customLink.getAttribute('data-href')
})
customLink.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault()
    customLink.click()
  }
})
```

### Plaited Adaptation

**Important**: In Plaited, links are implemented as **Functional Templates (FT)** in stories files, not as bElements. They use native `<a>` elements without Shadow DOM. Links can be used inside bElements' shadowDom, but the link templates themselves are simple functional components.

#### Basic Link

```typescript
// link.stories.tsx
import type { FT, Children } from 'plaited/ui'
import { joinStyles } from 'plaited/ui'
import { linkStyles } from './link.css.ts'

const Link: FT<{
  href: string
  children?: Children
}> = ({ href, children, ...attrs }) => (
  <a
    href={href}
    {...attrs}
    {...joinStyles(linkStyles.link)}
  >
    {children}
  </a>
)

export const basicLink = story({
  intent: 'Basic navigation link',
  template: () => <Link href='/about'>About Us</Link>,
})
```

#### External Link

```typescript
import type { FT, Children } from 'plaited/ui'
import { joinStyles } from 'plaited/ui'
import { linkStyles } from './link.css.ts'

const ExternalLink: FT<{
  href: string
  children?: Children
  'aria-label'?: string
}> = ({ href, children, 'aria-label': ariaLabel, ...attrs }) => (
  <a
    href={href}
    target='_blank'
    rel='noopener noreferrer'
    aria-label={ariaLabel}
    {...attrs}
    {...joinStyles(linkStyles.link, linkStyles.external)}
  >
    {children}
    <span aria-hidden='true' {...linkStyles.externalIndicator}>
      {' '}(opens in new tab)
    </span>
  </a>
)

export const externalLink = story({
  intent: 'External link with new tab indicator',
  template: () => (
    <ExternalLink href='https://example.com' aria-label='Example website (opens in new tab)'>
      Visit Example
    </ExternalLink>
  ),
})
```

#### Download Link

```typescript
import type { FT, Children } from 'plaited/ui'
import { joinStyles } from 'plaited/ui'
import { linkStyles } from './link.css.ts'

const DownloadLink: FT<{
  href: string
  download?: string | boolean
  children?: Children
}> = ({ href, download, children, ...attrs }) => (
  <a
    href={href}
    download={download}
    {...attrs}
    {...joinStyles(linkStyles.link, linkStyles.download)}
  >
    {children}
  </a>
)

export const downloadLink = story({
  intent: 'Download link',
  template: () => (
    <DownloadLink href='/document.pdf' download>
      Download PDF
    </DownloadLink>
  ),
})
```

#### Email Link

```typescript
import type { FT, Children } from 'plaited/ui'
import { joinStyles } from 'plaited/ui'
import { linkStyles } from './link.css.ts'

const EmailLink: FT<{
  email: string
  subject?: string
  body?: string
  children?: Children
}> = ({ email, subject, body, children, ...attrs }) => {
  const params = new URLSearchParams()
  if (subject) params.set('subject', subject)
  if (body) params.set('body', body)
  const href = `mailto:${email}${params.toString() ? `?${params.toString()}` : ''}`
  
  return (
    <a
      href={href}
      {...attrs}
      {...joinStyles(linkStyles.link)}
    >
      {children || email}
    </a>
  )
}

export const emailLink = story({
  intent: 'Email link with subject',
  template: () => (
    <EmailLink email='contact@example.com' subject='Inquiry'>
      Contact Us
    </EmailLink>
  ),
})
```

#### Skip Navigation Link

```typescript
import type { FT, Children } from 'plaited/ui'
import { joinStyles } from 'plaited/ui'
import { linkStyles } from './link.css.ts'

const SkipLink: FT<{
  href: string
  children?: Children
}> = ({ href, children = 'Skip to main content', ...attrs }) => (
  <a
    href={href}
    {...attrs}
    {...joinStyles(linkStyles.skipLink)}
  >
    {children}
  </a>
)

export const skipLink = story({
  intent: 'Skip navigation link for accessibility',
  template: () => <SkipLink href='#main-content' />,
})
```

#### Link with Icon

```typescript
import type { FT, Children } from 'plaited/ui'
import { joinStyles } from 'plaited/ui'
import { linkStyles } from './link.css.ts'

const LinkWithIcon: FT<{
  href: string
  icon?: Children
  children?: Children
  'aria-label'?: string
}> = ({ href, icon, children, 'aria-label': ariaLabel, ...attrs }) => (
  <a
    href={href}
    aria-label={ariaLabel}
    {...attrs}
    {...joinStyles(linkStyles.link, linkStyles.withIcon)}
  >
    {icon && <span aria-hidden='true' {...linkStyles.icon}>{icon}</span>}
    {children}
  </a>
)

export const linkWithIcon = story({
  intent: 'Link with icon',
  template: () => (
    <LinkWithIcon href='/settings' icon='⚙️' aria-label='Settings'>
      Settings
    </LinkWithIcon>
  ),
})
```

#### Link Styling Example

```typescript
// link.css.ts
import { createStyles } from 'plaited/ui'

export const linkStyles = createStyles({
  link: {
    color: {
      $default: 'blue',
      ':hover': 'darkblue',
      ':visited': 'purple',
      ':focus': 'darkblue',
      ':active': 'red',
    },
    textDecoration: {
      $default: 'none',
      ':hover': 'underline',
      ':focus': 'underline',
    },
    outline: {
      $default: 'none',
      ':focus': '2px solid blue',
      ':focus-visible': '2px solid blue',
    },
  },
  external: {
    '&::after': {
      content: '↗',
      marginLeft: '0.25em',
    },
  },
  externalIndicator: {
    fontSize: '0.875em',
    color: 'gray',
  },
  download: {
    '&::before': {
      content: '⬇ ',
    },
  },
  skipLink: {
    position: 'absolute',
    top: '-40px',
    left: '0',
    backgroundColor: 'blue',
    color: 'white',
    padding: '8px',
    textDecoration: 'none',
    zIndex: 100,
    ':focus': {
      top: '0',
    },
  },
  withIcon: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5em',
  },
  icon: {
    display: 'inline-block',
  },
})
```

#### Links in bElement shadowDom

Links can be used within bElements' shadowDom templates:

```typescript
import { bElement } from 'plaited/ui'
import { createStyles } from 'plaited/ui'
import { Link } from './link.stories.tsx'

const navStyles = createStyles({
  nav: {
    display: 'flex',
    gap: '1rem',
    padding: '1rem',
  },
})

export const Navigation = bElement({
  tag: 'site-navigation',
  shadowDom: (
    <nav aria-label='Main navigation' {...navStyles.nav}>
      <Link href='/'>Home</Link>
      <Link href='/about'>About</Link>
      <Link href='/contact'>Contact</Link>
    </nav>
  ),
  bProgram() {
    return {}
  },
})
```

#### Custom Link with Role (Not Recommended)

**Note**: Only use `role="link"` when a native `<a>` element cannot be used. This requires manual keyboard handling and navigation logic.

```typescript
import type { FT, Children } from 'plaited/ui'
import { joinStyles } from 'plaited/ui'
import { linkStyles } from './link.css.ts'

const CustomLink: FT<{
  href: string
  children?: Children
  'aria-label'?: string
}> = ({ href, children, 'aria-label': ariaLabel, ...attrs }) => (
  <span
    role='link'
    tabIndex={0}
    data-href={href}
    aria-label={ariaLabel}
    {...attrs}
    {...joinStyles(linkStyles.link, linkStyles.custom)}
    p-trigger={{ click: 'navigate', keydown: 'handleKeydown' }}
  >
    {children}
  </span>
)

// Usage in bElement
bElement({
  tag: 'custom-link-wrapper',
  shadowDom: (
    <CustomLink
      p-target='link'
      href='/page'
      p-trigger={{ click: 'navigate', keydown: 'handleKeydown' }}
    >
      Custom Link
    </CustomLink>
  ),
  bProgram({ $, host }) {
    const link = $('link')[0]
    
    return {
      navigate() {
        const href = link?.getAttribute('data-href')
        if (href) {
          window.location.href = href
        }
      },
      handleKeydown(event: KeyboardEvent) {
        if (event.key === 'Enter') {
          event.preventDefault()
          this.navigate()
        }
      },
    }
  },
})
```

## Plaited Integration

- **Works with Shadow DOM**: Yes - links can be used in bElement shadowDom
- **Uses bElement built-ins**: Not typically - links are simple presentational elements
- **Requires external web API**: No - uses native HTML `<a>` element
- **Cleanup required**: No - standard DOM elements handle their own lifecycle

## Keyboard Interaction

- **Enter**: Executes the link and moves focus to the link target
- **Shift + F10** (Optional): Opens a context menu for the link
- **Tab**: Moves focus to the next focusable element
- **Shift + Tab**: Moves focus to the previous focusable element

**Note**: Native `<a>` elements handle keyboard interaction automatically. Custom links with `role="link"` require manual keyboard handling.

## WAI-ARIA Roles, States, and Properties

### Required

- **role="link"**: Only when using a non-`<a>` element. Native `<a>` elements have implicit link role.

### Optional

- **aria-label**: Provides accessible name when link text is not descriptive
- **aria-describedby**: References element that provides additional description
- **aria-current**: Indicates current page/location (e.g., `aria-current="page"` in breadcrumbs)
- **aria-disabled**: Indicates link is disabled (use with caution - disabled links are generally not recommended)

### HTML Attributes

- **href**: Required for navigation (or `href="#"` for JavaScript-only links)
- **target**: Opens link in new window/tab (`target="_blank"`)
- **rel**: Link relationship (`noopener`, `noreferrer`, `nofollow`, etc.)
- **download**: Indicates link should download resource
- **hreflang**: Language of linked resource
- **type**: MIME type of linked resource

## Best Practices

1. **Use native `<a>` elements** - Strongly preferred over `role="link"`
2. **Functional Templates** - Implement links as FTs in stories
3. **Descriptive link text** - Avoid "click here" or "read more"
4. **External link indicators** - Clearly indicate when links open in new tabs
5. **Security** - Use `rel="noopener noreferrer"` for external links with `target="_blank"`
6. **Skip links** - Provide skip navigation links for keyboard users
7. **Focus styles** - Ensure visible focus indicators for keyboard navigation
8. **Current page indication** - Use `aria-current="page"` in navigation
9. **Download links** - Use `download` attribute for file downloads
10. **Email/Phone links** - Use appropriate protocols (`mailto:`, `tel:`)

## Accessibility Considerations

- Screen readers announce links and their destinations
- Keyboard users can navigate between links with Tab
- Focus indicators must be visible for keyboard navigation
- Link text should be descriptive out of context
- External links should be clearly indicated
- Disabled links are generally not recommended (use buttons or remove links)
- Skip navigation links improve keyboard accessibility
- Links in navigation should indicate current page

## Link Types and Usage

### Navigation Links
- Standard page navigation
- Use in main navigation, breadcrumbs, pagination
- Can use `aria-current="page"` for current page

### External Links
- Links to other websites
- Should include `rel="noopener noreferrer"`
- Should indicate "opens in new tab" visually and in aria-label

### Download Links
- Links that download files
- Use `download` attribute
- Can specify filename: `download="filename.pdf"`

### Fragment Links
- Links to sections within same page
- Use `href="#section-id"`
- Smooth scrolling can be added with CSS

### Email Links
- Use `mailto:` protocol
- Can include subject and body: `mailto:email?subject=Hello&body=Message`

### Telephone Links
- Use `tel:` protocol
- Format: `tel:+1234567890`

### JavaScript Links
- Links that trigger JavaScript actions
- Use `href="#"` or `href="javascript:void(0)"`
- Consider using buttons instead for actions

## Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome | Full support |
| Firefox | Full support |
| Safari | Full support |
| Edge | Full support |

**Note**: Native HTML `<a>` elements have universal support. Custom links with `role="link"` require JavaScript for functionality.

## References

- Source: [W3C ARIA Authoring Practices Guide - Link Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/link/)
- MDN: [HTML a element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/a)
- MDN: [ARIA link role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/link_role)
- WCAG: [Link Purpose (In Context)](https://www.w3.org/WAI/WCAG21/Understanding/link-purpose-in-context.html)
- WCAG: [Link Purpose (Link Only)](https://www.w3.org/WAI/WCAG21/Understanding/link-purpose-link-only.html)
