# ARIA Link Pattern

## Overview

A link provides an interactive reference to a resource. The target resource can be either external or local, i.e., either outside or within the current page or application.

**Key Characteristics:**

- Interactive reference to a resource (internal or external)
- Native HTML `<a>` element is strongly preferred
- Keyboard accessible (Enter key activates)
- Optional context menu support (Shift+F10)
- Can contain text or graphics
- Supports various link types (navigation, download, external, etc.)

**Native HTML First:** Authors are strongly encouraged to use a native `<a>` element with an `href` attribute. Applying the `link` role to an element will not cause browsers to enhance the element with standard link behaviors. When using the `link` role, providing these features is the author's responsibility.

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

## Pattern Philosophy

This pattern is **training data** for the Plaited agent. The examples below train the agent's understanding of how to implement this pattern correctly.

- bElements/FunctionalTemplates are defined locally in stories (NOT exported)
- Only stories are exported (required for testing/training)
- Styles are always in separate `*.css.ts` files
- Use spread syntax `{...styles.x}` for applying styles

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

**File Structure:**

```
link/
  link.css.ts        # Styles (createStyles) - ALWAYS separate
  link.stories.tsx   # FT + stories (imports from css.ts)
```

#### link.css.ts

```typescript
// link.css.ts
import { createStyles } from 'plaited'

export const styles = createStyles({
  link: {
    color: '#007bff',
    textDecoration: 'none',
    cursor: 'pointer',
  },
  linkHover: {
    textDecoration: 'underline',
  },
  linkVisited: {
    color: '#6c757d',
  },
  external: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25em',
  },
  externalIndicator: {
    fontSize: '0.75em',
    color: '#6c757d',
  },
  download: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25em',
  },
  skipLink: {
    position: 'absolute',
    insetBlockStart: '-40px',
    insetInlineStart: '0',
    backgroundColor: '#007bff',
    color: 'white',
    padding: '8px 16px',
    textDecoration: 'none',
    zIndex: 100,
    borderRadius: '0 0 4px 0',
  },
  skipLinkFocused: {
    insetBlockStart: '0',
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

#### link.stories.tsx

```typescript
// link.stories.tsx
import type { FT, Children } from 'plaited/ui'
import { story } from 'plaited/testing'
import { styles } from './link.css.ts'

// FunctionalTemplate for basic link - defined locally, NOT exported
const Link: FT<{
  href: string
  children?: Children
}> = ({ href, children, ...attrs }) => (
  <a href={href} {...attrs} {...styles.link}>
    {children}
  </a>
)

// FunctionalTemplate for external link - defined locally, NOT exported
const ExternalLink: FT<{
  href: string
  children?: Children
  'aria-label'?: string
}> = ({ href, children, 'aria-label': ariaLabel, ...attrs }) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    aria-label={ariaLabel}
    {...attrs}
    {...styles.link}
    {...styles.external}
  >
    {children}
    <span aria-hidden="true" {...styles.externalIndicator}>
      (opens in new tab)
    </span>
  </a>
)

// FunctionalTemplate for download link - defined locally, NOT exported
const DownloadLink: FT<{
  href: string
  download?: string | boolean
  children?: Children
}> = ({ href, download = true, children, ...attrs }) => (
  <a href={href} download={download} {...attrs} {...styles.link} {...styles.download}>
    <span aria-hidden="true">⬇</span>
    {children}
  </a>
)

// FunctionalTemplate for email link - defined locally, NOT exported
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
    <a href={href} {...attrs} {...styles.link}>
      {children ?? email}
    </a>
  )
}

// FunctionalTemplate for skip link - defined locally, NOT exported
const SkipLink: FT<{
  href: string
  children?: Children
}> = ({ href, children = 'Skip to main content', ...attrs }) => (
  <a href={href} {...attrs} {...styles.skipLink}>
    {children}
  </a>
)

// FunctionalTemplate for link with icon - defined locally, NOT exported
const LinkWithIcon: FT<{
  href: string
  icon?: Children
  children?: Children
  'aria-label'?: string
}> = ({ href, icon, children, 'aria-label': ariaLabel, ...attrs }) => (
  <a href={href} aria-label={ariaLabel} {...attrs} {...styles.link} {...styles.withIcon}>
    {icon && <span aria-hidden="true" {...styles.icon}>{icon}</span>}
    {children}
  </a>
)

// Stories - EXPORTED for testing/training
export const basicLink = story({
  intent: 'Display a basic navigation link',
  template: () => <Link href="/about">About Us</Link>,
  play: async ({ findByRole, assert }) => {
    const link = await findByRole('link')

    assert({
      given: 'basic link is rendered',
      should: 'have href attribute',
      actual: link?.getAttribute('href'),
      expected: '/about',
    })

    assert({
      given: 'basic link is rendered',
      should: 'have link text',
      actual: link?.textContent?.trim(),
      expected: 'About Us',
    })
  },
})

export const externalLink = story({
  intent: 'Display an external link with new tab indicator',
  template: () => (
    <ExternalLink
      href="https://example.com"
      aria-label="Example website (opens in new tab)"
    >
      Visit Example
    </ExternalLink>
  ),
  play: async ({ findByRole, assert }) => {
    const link = await findByRole('link')

    assert({
      given: 'external link is rendered',
      should: 'have target _blank',
      actual: link?.getAttribute('target'),
      expected: '_blank',
    })

    assert({
      given: 'external link is rendered',
      should: 'have rel noopener noreferrer',
      actual: link?.getAttribute('rel'),
      expected: 'noopener noreferrer',
    })
  },
})

export const downloadLink = story({
  intent: 'Display a download link for file downloads',
  template: () => (
    <DownloadLink href="/document.pdf" download="report.pdf">
      Download Report
    </DownloadLink>
  ),
  play: async ({ findByRole, assert }) => {
    const link = await findByRole('link')

    assert({
      given: 'download link is rendered',
      should: 'have download attribute',
      actual: link?.hasAttribute('download'),
      expected: true,
    })
  },
})

export const emailLink = story({
  intent: 'Display an email link with subject',
  template: () => (
    <EmailLink email="contact@example.com" subject="Inquiry">
      Contact Us
    </EmailLink>
  ),
  play: async ({ findByRole, assert }) => {
    const link = await findByRole('link')

    assert({
      given: 'email link is rendered',
      should: 'have mailto href',
      actual: link?.getAttribute('href')?.startsWith('mailto:'),
      expected: true,
    })
  },
})

export const skipNavigationLink = story({
  intent: 'Display a skip navigation link for accessibility',
  template: () => (
    <div>
      <SkipLink href="#main-content" />
      <nav style="padding: 1rem; background: #f0f0f0;">
        <a href="/">Home</a> | <a href="/about">About</a>
      </nav>
      <main id="main-content" style="padding: 1rem;">
        <h1>Main Content</h1>
        <p>Focus the skip link by pressing Tab from the top of the page.</p>
      </main>
    </div>
  ),
  play: async ({ findByRole, assert }) => {
    const link = await findByRole('link', { name: 'Skip to main content' })

    assert({
      given: 'skip link is rendered',
      should: 'have fragment href',
      actual: link?.getAttribute('href'),
      expected: '#main-content',
    })
  },
})

export const linkWithIcon = story({
  intent: 'Display a link with an icon',
  template: () => (
    <LinkWithIcon href="/settings" icon="⚙️" aria-label="Settings">
      Settings
    </LinkWithIcon>
  ),
  play: async ({ findByRole, assert }) => {
    const link = await findByRole('link')

    assert({
      given: 'link with icon is rendered',
      should: 'have accessible label',
      actual: link?.getAttribute('aria-label'),
      expected: 'Settings',
    })
  },
})

export const linkVariants = story({
  intent: 'Display various link types for reference',
  template: () => (
    <div style="display: flex; flex-direction: column; gap: 1rem;">
      <Link href="/page">Internal Link</Link>
      <ExternalLink href="https://example.com">External Link</ExternalLink>
      <DownloadLink href="/file.pdf">Download Link</DownloadLink>
      <EmailLink email="test@example.com">Email Link</EmailLink>
      <a href="tel:+1234567890" {...styles.link}>Phone Link: +1 (234) 567-890</a>
      <a href="#section" {...styles.link}>Fragment Link (#section)</a>
    </div>
  ),
  play: async ({ accessibilityCheck }) => {
    await accessibilityCheck({})
  },
})
```

## Plaited Integration

- **Works with Shadow DOM**: Yes - links can be used in bElement shadowDom
- **Uses bElement built-ins**: Not typically - links are simple presentational elements
- **Requires external web API**: No - uses native HTML `<a>` element
- **Cleanup required**: No

## Keyboard Interaction

- **Enter**: Executes the link and moves focus to the link target
- **Shift + F10** (Optional): Opens a context menu for the link
- **Tab**: Moves focus to the next focusable element
- **Shift + Tab**: Moves focus to the previous focusable element

**Note**: Native `<a>` elements handle keyboard interaction automatically.

## WAI-ARIA Roles, States, and Properties

### Required

- **role="link"**: Only when using a non-`<a>` element. Native `<a>` elements have implicit link role.

### Optional

- **aria-label**: Provides accessible name when link text is not descriptive
- **aria-describedby**: References element that provides additional description
- **aria-current**: Indicates current page/location (e.g., `aria-current="page"`)
- **aria-disabled**: Indicates link is disabled (use with caution)

### HTML Attributes

- **href**: Required for navigation
- **target**: Where to display the linked URL (`_blank`, `_self`, etc.)
- **rel**: Link relationship (`noopener`, `noreferrer`, `nofollow`, etc.)
- **download**: Indicates link should download resource
- **hreflang**: Language of linked resource
- **type**: MIME type of linked resource

## Best Practices

1. **Use native `<a>` elements** - Strongly preferred over `role="link"`
2. **Use FunctionalTemplates** - Implement links as FTs in stories
3. **Use spread syntax** - `{...styles.x}` for applying styles
4. **Descriptive link text** - Avoid "click here" or "read more"
5. **External link indicators** - Clearly indicate when links open in new tabs
6. **Security** - Use `rel="noopener noreferrer"` for external links with `target="_blank"`
7. **Skip links** - Provide skip navigation links for keyboard users
8. **Focus styles** - Ensure visible focus indicators for keyboard navigation
9. **Current page indication** - Use `aria-current="page"` in navigation
10. **Download links** - Use `download` attribute for file downloads

## Accessibility Considerations

- Screen readers announce links and their destinations
- Keyboard users can navigate between links with Tab
- Focus indicators must be visible for keyboard navigation
- Link text should be descriptive out of context
- External links should be clearly indicated
- Skip navigation links improve keyboard accessibility
- Links in navigation should indicate current page

## Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome | Full support |
| Firefox | Full support |
| Safari | Full support |
| Edge | Full support |

## References

- Source: [W3C ARIA Authoring Practices Guide - Link Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/link/)
- MDN: [HTML a element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/a)
- MDN: [ARIA link role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/link_role)
- WCAG: [Link Purpose (In Context)](https://www.w3.org/WAI/WCAG21/Understanding/link-purpose-in-context.html)
