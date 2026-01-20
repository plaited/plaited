# CSS Logical Properties and Values Pattern

## ⚠️ REQUIRED FOR ALL PLAITED STYLES

**This is not optional.** All CSS properties in Plaited templates MUST use logical properties. Physical properties (`width`, `height`, `margin-top`, `padding-left`, etc.) are forbidden except for properties without logical equivalents.

**Enforcement**: This pattern is enforced across all Plaited code generation. When creating styles with `createStyles` or `createHostStyles`, always prefer logical properties.

**See Also**:
- [code-conventions.md](../../standards/references/code-conventions.md#css-logical-properties) - Required convention in standards
- [ui-patterns/SKILL.md](../../ui-patterns/SKILL.md#css-logical-properties-requirement) - Quick reference

## Overview

CSS logical properties define layout properties relative to the content's writing direction rather than physical direction (left, right, top, bottom). This ensures templates adapt correctly when localized to work with content and languages using different writing modes (LTR, RTL, vertical).

Logical properties use abstract terms **block** and **inline** to describe flow direction:

- **Block**: Perpendicular to text flow (vertical in horizontal writing, horizontal in vertical writing)
- **Inline**: Parallel to text flow (horizontal in horizontal writing, vertical in vertical writing)

## Use Cases

- Building internationalized components that work in LTR and RTL languages
- Creating layouts that adapt to vertical writing modes (Japanese, Chinese, Korean)
- Ensuring consistent spacing, borders, and positioning regardless of writing direction
- Maintaining layout integrity when `direction` or `writing-mode` changes
- Building bElement components that respect user's language preferences

## Implementation

### Vanilla CSS

**Physical Properties (writing-mode dependent):**

```css
.element {
  margin-left: 1rem;
  margin-right: 1rem;
  padding-top: 1rem;
  padding-bottom: 1rem;
  border-left: 2px solid black;
  width: 100px;
  height: 200px;
}
```

**Logical Properties (writing-mode independent):**

```css
.element {
  margin-inline-start: 1rem;
  margin-inline-end: 1rem;
  padding-block-start: 1rem;
  padding-block-end: 1rem;
  border-inline-start: 2px solid black;
  inline-size: 100px;
  block-size: 200px;
}
```

**Shorthand Properties:**

```css
.element {
  /* Instead of margin: 1rem 2rem */
  margin-block: 1rem;      /* block-start and block-end */
  margin-inline: 2rem;     /* inline-start and inline-end */
  
  /* Instead of padding: 0.5rem 1rem */
  padding-block: 0.5rem;
  padding-inline: 1rem;
  
  /* Instead of border: 1px solid black */
  border-block: 1px solid black;
  border-inline: 1px solid black;
}
```

**Positioning:**

```css
/* Physical positioning */
.positioned {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
}

/* Logical positioning */
.positioned {
  position: absolute;
  inset-block-start: 0;
  inset-inline-end: 0;
  inset-block-end: 0;
  inset-inline-start: 0;
  
  /* Or use shorthand */
  inset: 0; /* All sides */
  inset-block: 0; /* block-start and block-end */
  inset-inline: 1rem; /* inline-start and inline-end */
}
```

**Border Radius (Logical):**

```css
/* Physical */
.element {
  border-top-left-radius: 4px;
  border-top-right-radius: 4px;
}

/* Logical */
.element {
  border-start-start-radius: 4px;  /* Top-left in LTR, top-right in RTL */
  border-start-end-radius: 4px;    /* Top-right in LTR, top-left in RTL */
  border-end-start-radius: 4px;    /* Bottom-left in LTR, bottom-right in RTL */
  border-end-end-radius: 4px;      /* Bottom-right in LTR, bottom-left in RTL */
}
```

### Plaited Adaptation

When creating bElement components with styles, use logical properties in your CSS to ensure proper internationalization:

```typescript
import { bElement, createStyles } from 'plaited/ui'

const styles = createStyles(`
  :host {
    display: block;
    /* Use logical properties for writing-mode independence */
    padding-block: 1rem;
    padding-inline: 1.5rem;
    margin-block: 0.5rem;
    margin-inline: auto;
    max-inline-size: 600px;
  }
  
  .button {
    /* Logical borders adapt to writing direction */
    border-inline-start: 2px solid var(--border-color);
    border-block: 1px solid var(--border-color);
    border-inline-end: none;
    
    /* Logical padding */
    padding-inline: 1rem;
    padding-block: 0.5rem;
    
    /* Logical border radius */
    border-start-start-radius: 4px;
    border-start-end-radius: 4px;
  }
  
  .navigation {
    display: flex;
    flex-direction: row;
    gap: 1rem;
    /* Logical margins for spacing between items */
    margin-inline-start: auto;
  }
  
  .card {
    /* Logical sizing */
    inline-size: 100%;
    min-block-size: 200px;
    max-inline-size: 400px;
    
    /* Logical positioning for absolute children */
    position: relative;
  }
  
  .badge {
    position: absolute;
    inset-block-start: 0.5rem;
    inset-inline-end: 0.5rem;
  }
`)

export const InternationalizedCard = bElement({
  tag: 'internationalized-card',
  styles,
  shadowDom: `
    <div class="card">
      <span class="badge">New</span>
      <slot></slot>
      <nav class="navigation">
        <button class="button">Action</button>
      </nav>
    </div>
  `,
  bProgram() {
    return {}
  }
})
```

**With Writing Mode Support:**

```typescript
const styles = createStyles(`
  :host {
    writing-mode: horizontal-tb; /* Default */
  }
  
  :host([dir="rtl"]) {
    /* No changes needed! Logical properties handle it */
  }
  
  :host([vertical]) {
    writing-mode: vertical-rl;
    /* Logical properties automatically adapt */
  }
  
  .content {
    padding-inline: 2rem;
    padding-block: 1rem;
    /* Works correctly in both horizontal and vertical modes */
  }
`)
```

## Property Mappings

### Sizing

| Physical | Logical |
|----------|---------|
| `width` | `inline-size` |
| `height` | `block-size` |
| `min-width` | `min-inline-size` |
| `min-height` | `min-block-size` |
| `max-width` | `max-inline-size` |
| `max-height` | `max-block-size` |

### Margins

| Physical | Logical |
|----------|---------|
| `margin-top` | `margin-block-start` |
| `margin-bottom` | `margin-block-end` |
| `margin-left` | `margin-inline-start` |
| `margin-right` | `margin-inline-end` |
| `margin: vertical horizontal` | `margin-block`, `margin-inline` |

### Padding

| Physical | Logical |
|----------|---------|
| `padding-top` | `padding-block-start` |
| `padding-bottom` | `padding-block-end` |
| `padding-left` | `padding-inline-start` |
| `padding-right` | `padding-inline-end` |
| `padding: vertical horizontal` | `padding-block`, `padding-inline` |

### Borders

| Physical | Logical |
|----------|---------|
| `border-top` | `border-block-start` |
| `border-bottom` | `border-block-end` |
| `border-left` | `border-inline-start` |
| `border-right` | `border-inline-end` |
| `border-top-width` | `border-block-start-width` |
| `border-left-color` | `border-inline-start-color` |
| etc. | etc. |

### Positioning

| Physical | Logical |
|----------|---------|
| `top` | `inset-block-start` |
| `bottom` | `inset-block-end` |
| `left` | `inset-inline-start` |
| `right` | `inset-inline-end` |
| `top`, `right`, `bottom`, `left` | `inset` (shorthand) |

### Border Radius

| Physical | Logical |
| ---------- | --------- |
| `border-top-left-radius` | `border-start-start-radius` |
| `border-top-right-radius` | `border-start-end-radius` |
| `border-bottom-left-radius` | `border-end-start-radius` |
| `border-bottom-right-radius` | `border-end-end-radius` |

## Plaited Integration

- **Works with Shadow DOM**: ✅ Yes - Logical properties work seamlessly in Shadow DOM
- **Uses bElement built-ins**: Uses `createStyles` for CSS-in-JS styling
- **Requires external web API**: ❌ No - Pure CSS feature
- **Cleanup required**: ❌ No - CSS properties don't require cleanup

**Best Practices for bElement:**

1. **Always use logical properties** when creating reusable components
2. **Use `createStyles`** to define styles with logical properties
3. **Test with `dir="rtl"`** attribute on host element
4. **Consider vertical writing modes** for Japanese/Chinese/Korean content
5. **Mix physical and logical carefully** - prefer one approach consistently

**Example: Form Component with Logical Properties**

```typescript
const formStyles = createStyles(`
  :host {
    display: block;
    padding-inline: 1rem;
    padding-block: 1.5rem;
  }
  
  fieldset {
    border: none;
    padding: 0;
    margin: 0;
    margin-block-end: 1.5rem;
  }
  
  label {
    display: block;
    margin-block-end: 0.5rem;
    padding-inline-start: 0.25rem;
  }
  
  input {
    width: 100%; /* Can use physical width for form inputs */
    padding-inline: 0.75rem;
    padding-block: 0.5rem;
    border: 1px solid var(--border-color);
    border-start-start-radius: 4px;
    border-start-end-radius: 4px;
    border-end-start-radius: 4px;
    border-end-end-radius: 4px;
  }
  
  button {
    margin-inline-start: auto;
    padding-inline: 1.5rem;
    padding-block: 0.75rem;
  }
`)
```

## Browser Compatibility

| Browser | Support |
| --------- | --------- |
| Chrome | 69+ |
| Firefox | 66+ |
| Safari | 12.1+ |
| Edge | 79+ |

**Note**: Logical properties have excellent modern browser support. For older browsers, provide physical property fallbacks if needed.

## Accessibility

- **Writing Direction**: Logical properties ensure content respects user's language direction preferences
- **Screen Readers**: Proper use of logical properties helps maintain consistent reading order
- **RTL Languages**: Essential for Arabic, Hebrew, and other RTL language support
- **Vertical Text**: Critical for Japanese, Chinese, Korean vertical writing modes
- **User Preferences**: Respects system-level writing direction settings

## Common Patterns

### Center Content

```css
/* Physical */
.center {
  margin-left: auto;
  margin-right: auto;
}

/* Logical */
.center {
  margin-inline: auto;
}
```

### Spacing Between Items

```css
/* Physical */
.item:not(:last-child) {
  margin-right: 1rem;
}

/* Logical */
.item:not(:last-child) {
  margin-inline-end: 1rem;
}
```

### Absolute Positioning

```css
/* Physical */
.overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}

/* Logical */
.overlay {
  position: absolute;
  inset: 0;
}
```

### Sticky Positioning

```css
/* Physical */
.sticky-header {
  position: sticky;
  top: 0;
}

/* Logical */
.sticky-header {
  position: sticky;
  inset-block-start: 0;
}
```

## Migration Strategy

1. **Start with new components** - Use logical properties in new bElement components
2. **Gradually migrate existing** - Update existing components during refactoring
3. **Use both when needed** - Mix physical and logical during transition
4. **Test with RTL** - Always test with `dir="rtl"` attribute
5. **Document decisions** - Note why physical properties are used if needed

## References

- **Source**: [CSS Logical Properties and Values - MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Logical_properties_and_values)
- **MDN**: [CSS Logical Properties Module](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Logical_Properties)
- **Specification**: [CSS Logical Properties and Values Level 1](https://drafts.csswg.org/css-logical/)
- **Writing Modes**: [MDN - CSS Writing Modes](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Writing_Modes)

## Related Patterns

- **ARIA Patterns** - Use with logical properties for full internationalization
- **CSS Custom Properties** - Combine with logical properties for theming
- **Responsive Design** - Logical properties work with media queries
- **CSS Grid/Flexbox** - Use logical properties for gaps and alignment