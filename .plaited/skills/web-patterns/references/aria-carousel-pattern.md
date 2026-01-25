# ARIA Carousel Pattern

## Overview

A carousel presents a set of three or more related items, usually images or movies, in sequential order. Typically one slide is displayed at a time and users can activate a next or previous slide control to hide the current slide and "rotate" the next or previous slide into view.

**Key Terms:**

- **Slide**: A single content container within a set of content containers
- **Rotation Control**: An interactive element that stops and starts automatic slide rotation
- **Next Slide Control**: An interactive element that displays the next slide
- **Previous Slide Control**: An interactive element that displays the previous slide
- **Slide Picker Controls**: A group of elements that enable the user to pick a specific slide

**Critical Accessibility Requirements:**

- Auto-rotation stops when keyboard focus enters the carousel
- Auto-rotation stops when mouse hovers over the carousel
- Rotation control button for stopping/starting auto-rotation
- Proper ARIA live regions for slide announcements
- Focus management for keyboard users

## Use Cases

- Image galleries with rotation
- Product showcases
- Testimonial rotators
- Feature highlights
- News/article carousels
- Banner/slider presentations

## Pattern Philosophy

This pattern is **training data** for the Plaited agent. The examples below train the agent's understanding of how to implement this pattern correctly.

- bElements/FunctionalTemplates are defined locally in stories (NOT exported)
- Only stories are exported (required for testing/training)
- Styles are always in separate `*.css.ts` files
- Use spread syntax `{...styles.x}` for applying styles

## Implementation

### Vanilla JavaScript

```html
<div role="region" aria-roledescription="carousel" aria-label="Featured products">
  <button type="button" aria-label="Stop slide rotation">Stop</button>
  <button type="button" aria-label="Previous slide">Previous</button>
  <button type="button" aria-label="Next slide">Next</button>

  <div aria-live="off" aria-atomic="false">
    <div role="group" aria-roledescription="slide" aria-label="Product 1 of 3">
      <img src="product1.jpg" alt="Product 1">
    </div>
    <div role="group" aria-roledescription="slide" aria-label="Product 2 of 3" hidden>
      <img src="product2.jpg" alt="Product 2">
    </div>
  </div>
</div>
```

```javascript
let currentSlide = 0
let autoRotateInterval = null

function showSlide(index) {
  slides.forEach((slide, i) => {
    slide.hidden = i !== index
  })
  currentSlide = index
}

function startRotation() {
  autoRotateInterval = setInterval(() => {
    currentSlide = (currentSlide + 1) % slides.length
    showSlide(currentSlide)
  }, 5000)
}

function stopRotation() {
  if (autoRotateInterval) {
    clearInterval(autoRotateInterval)
    autoRotateInterval = null
  }
}

// Stop rotation on focus
carousel.addEventListener('focusin', stopRotation)
// Stop rotation on mouse hover
carousel.addEventListener('mouseenter', stopRotation)
```

### Plaited Adaptation

**File Structure:**

```
carousel/
  carousel.css.ts        # Styles (createStyles) - ALWAYS separate
  carousel.stories.tsx   # bElement + stories (imports from css.ts)
```

#### carousel.css.ts

```typescript
// carousel.css.ts
import { createStyles } from 'plaited'

export const styles = createStyles({
  carousel: {
    position: 'relative',
    inlineSize: '100%',
    maxInlineSize: '800px',
    margin: '0 auto',
  },
  controls: {
    display: 'flex',
    gap: '0.5rem',
    marginBlockEnd: '1rem',
  },
  button: {
    padding: '0.5rem 1rem',
    border: '1px solid #ccc',
    borderRadius: '4px',
    cursor: 'pointer',
    background: 'white',
  },
  slidesContainer: {
    position: 'relative',
    overflow: 'hidden',
  },
  slide: {
    display: 'none',
  },
  slideActive: {
    display: 'block',
  },
  pickerGroup: {
    display: 'flex',
    gap: '0.5rem',
    justifyContent: 'center',
    marginBlockStart: '1rem',
  },
  pickerButton: {
    inlineSize: '12px',
    blockSize: '12px',
    borderRadius: '50%',
    border: '1px solid #ccc',
    background: 'transparent',
    cursor: 'pointer',
    padding: 0,
  },
  pickerButtonActive: {
    background: '#007bff',
    borderColor: '#007bff',
  },
})
```

#### carousel.stories.tsx

```typescript
// carousel.stories.tsx
import type { FT, Children } from 'plaited/ui'
import { bElement } from 'plaited/ui'
import { story } from 'plaited/testing'
import { styles } from './carousel.css.ts'

// FunctionalTemplate for slides - defined locally, NOT exported
const Slide: FT<{
  'aria-label': string
  active?: boolean
  children?: Children
}> = ({ 'aria-label': ariaLabel, active, children, ...attrs }) => (
  <div
    role="group"
    aria-roledescription="slide"
    aria-label={ariaLabel}
    hidden={!active}
    {...attrs}
    {...styles.slide}
    {...(active ? styles.slideActive : {})}
  >
    {children}
  </div>
)

// bElement for carousel - defined locally, NOT exported
const Carousel = bElement({
  tag: 'pattern-carousel',
  observedAttributes: ['auto-rotate', 'rotation-interval'],
  shadowDom: (
    <div
      p-target="carousel"
      role="region"
      aria-roledescription="carousel"
      aria-label="Image carousel"
      {...styles.carousel}
      p-trigger={{ focusin: 'handleFocusIn', mouseenter: 'handleMouseEnter' }}
    >
      <div {...styles.controls}>
        <button
          type="button"
          p-target="rotation-button"
          p-trigger={{ click: 'toggleRotation' }}
          aria-label="Stop slide rotation"
          {...styles.button}
        >
          Stop
        </button>
        <button
          type="button"
          p-target="prev-button"
          p-trigger={{ click: 'previousSlide' }}
          aria-label="Previous slide"
          {...styles.button}
        >
          Previous
        </button>
        <button
          type="button"
          p-target="next-button"
          p-trigger={{ click: 'nextSlide' }}
          aria-label="Next slide"
          {...styles.button}
        >
          Next
        </button>
      </div>
      <div
        p-target="slides-container"
        aria-live="off"
        aria-atomic="false"
        {...styles.slidesContainer}
      >
        <slot p-target="slot"></slot>
      </div>
      <div p-target="picker-group" role="group" aria-label="Choose slide" {...styles.pickerGroup}>
        {/* Picker buttons rendered dynamically */}
      </div>
    </div>
  ),
  bProgram({ $, host, emit }) {
    const rotationButton = $<HTMLButtonElement>('rotation-button')[0]
    const slidesContainer = $('slides-container')[0]
    const pickerGroup = $('picker-group')[0]

    let currentSlideIndex = 0
    let isRotating = false
    let rotationInterval: ReturnType<typeof setInterval> | undefined
    let slides: Element[] = []

    const rotationIntervalMs = parseInt(host.getAttribute('rotation-interval') || '5000', 10)

    const getSlides = () => {
      const slot = slidesContainer?.root.querySelector('slot') as HTMLSlotElement
      if (!slot) return []
      return slot.assignedElements().filter((node) =>
        node.getAttribute('role') === 'group'
      )
    }

    const showSlide = (index: number) => {
      slides.forEach((slide, i) => {
        const el = slide as HTMLElement
        el.hidden = i !== index
        el.setAttribute('aria-label', `Slide ${i + 1} of ${slides.length}`)
      })

      // Update picker buttons
      const pickers = pickerGroup?.root.querySelectorAll('button')
      pickers?.forEach((picker, i) => {
        const isActive = i === index
        picker.setAttribute('aria-disabled', isActive ? 'true' : 'false')
        if (isActive) {
          picker.classList.add(...styles.pickerButtonActive.classNames)
        } else {
          picker.classList.remove(...styles.pickerButtonActive.classNames)
        }
      })

      currentSlideIndex = index
      emit({ type: 'slideChange', detail: { index, total: slides.length } })
    }

    const startRotation = () => {
      if (isRotating || slides.length === 0) return

      isRotating = true
      rotationButton?.attr('aria-label', 'Stop slide rotation')
      rotationButton?.render('Stop')

      rotationInterval = setInterval(() => {
        const nextIndex = (currentSlideIndex + 1) % slides.length
        showSlide(nextIndex)
      }, rotationIntervalMs)
    }

    const stopRotation = () => {
      if (!isRotating) return

      isRotating = false
      if (rotationInterval) {
        clearInterval(rotationInterval)
        rotationInterval = undefined
      }
      rotationButton?.attr('aria-label', 'Start slide rotation')
      rotationButton?.render('Start')
    }

    const renderPickers = () => {
      if (!pickerGroup || slides.length === 0) return

      pickerGroup.render(
        ...slides.map((_, index) => (
          <button
            type="button"
            aria-label={`Slide ${index + 1}`}
            aria-disabled={index === 0 ? 'true' : 'false'}
            p-trigger={{ click: 'selectSlide' }}
            data-index={String(index)}
            {...styles.pickerButton}
            {...(index === 0 ? styles.pickerButtonActive : {})}
          />
        ))
      )
    }

    return {
      toggleRotation() {
        if (isRotating) {
          stopRotation()
        } else {
          startRotation()
        }
      },
      previousSlide() {
        stopRotation()
        const prevIndex = currentSlideIndex === 0 ? slides.length - 1 : currentSlideIndex - 1
        showSlide(prevIndex)
      },
      nextSlide() {
        stopRotation()
        const nextIndex = (currentSlideIndex + 1) % slides.length
        showSlide(nextIndex)
      },
      selectSlide(event: { target: HTMLButtonElement }) {
        const index = parseInt(event.target.getAttribute('data-index') || '0', 10)
        stopRotation()
        showSlide(index)
      },
      handleFocusIn() {
        stopRotation()
      },
      handleMouseEnter() {
        stopRotation()
      },
      onConnected() {
        slides = getSlides()
        if (slides.length > 0) {
          showSlide(0)
          renderPickers()

          if (host.hasAttribute('auto-rotate')) {
            startRotation()
          }
        }
      },
      onDisconnected() {
        if (rotationInterval) {
          clearInterval(rotationInterval)
          rotationInterval = undefined
        }
      },
    }
  },
})

// Stories - EXPORTED for testing/training
export const basicCarousel = story({
  intent: 'Carousel with manual navigation controls and slide picker buttons',
  template: () => (
    <Carousel>
      <Slide aria-label="Slide 1 of 3" active>
        <img src="https://via.placeholder.com/800x400?text=Slide+1" alt="Slide 1" />
      </Slide>
      <Slide aria-label="Slide 2 of 3">
        <img src="https://via.placeholder.com/800x400?text=Slide+2" alt="Slide 2" />
      </Slide>
      <Slide aria-label="Slide 3 of 3">
        <img src="https://via.placeholder.com/800x400?text=Slide+3" alt="Slide 3" />
      </Slide>
    </Carousel>
  ),
  play: async ({ findByAttribute, assert, fireEvent }) => {
    const nextButton = await findByAttribute('p-target', 'next-button')
    const prevButton = await findByAttribute('p-target', 'prev-button')

    assert({
      given: 'carousel is rendered',
      should: 'have next and previous buttons',
      actual: nextButton !== null && prevButton !== null,
      expected: true,
    })
  },
})

export const autoRotateCarousel = story({
  intent: 'Carousel with auto-rotation that stops on focus or hover',
  template: () => (
    <Carousel auto-rotate rotation-interval="3000">
      <Slide aria-label="Slide 1 of 3" active>
        <div style="padding: 2rem; background: #e3f2fd; text-align: center;">
          <h2>Feature 1</h2>
          <p>Auto-rotating carousel - stops on focus or hover</p>
        </div>
      </Slide>
      <Slide aria-label="Slide 2 of 3">
        <div style="padding: 2rem; background: #e8f5e9; text-align: center;">
          <h2>Feature 2</h2>
          <p>Press Stop button to pause rotation</p>
        </div>
      </Slide>
      <Slide aria-label="Slide 3 of 3">
        <div style="padding: 2rem; background: #fff3e0; text-align: center;">
          <h2>Feature 3</h2>
          <p>Use keyboard to navigate between slides</p>
        </div>
      </Slide>
    </Carousel>
  ),
  play: async ({ findByAttribute, assert }) => {
    const rotationButton = await findByAttribute('p-target', 'rotation-button')

    assert({
      given: 'auto-rotate carousel is rendered',
      should: 'have rotation control button',
      actual: rotationButton?.getAttribute('aria-label'),
      expected: 'Stop slide rotation',
    })
  },
})

export const productCarousel = story({
  intent: 'Product showcase carousel for e-commerce use case',
  template: () => (
    <Carousel>
      <Slide aria-label="Product 1 of 3" active>
        <div style="padding: 2rem; border: 1px solid #ccc; text-align: center;">
          <img src="https://via.placeholder.com/200x200" alt="Product 1" />
          <h3>Product Name</h3>
          <p>$99.99</p>
        </div>
      </Slide>
      <Slide aria-label="Product 2 of 3">
        <div style="padding: 2rem; border: 1px solid #ccc; text-align: center;">
          <img src="https://via.placeholder.com/200x200" alt="Product 2" />
          <h3>Another Product</h3>
          <p>$149.99</p>
        </div>
      </Slide>
      <Slide aria-label="Product 3 of 3">
        <div style="padding: 2rem; border: 1px solid #ccc; text-align: center;">
          <img src="https://via.placeholder.com/200x200" alt="Product 3" />
          <h3>Featured Item</h3>
          <p>$199.99</p>
        </div>
      </Slide>
    </Carousel>
  ),
  play: async ({ accessibilityCheck }) => {
    await accessibilityCheck({})
  },
})
```

## Plaited Integration

- **Works with Shadow DOM**: Yes - carousels are bElements with Shadow DOM
- **Uses bElement built-ins**: `$`, `p-trigger`, `p-target`, `emit`, `render`, `attr`
- **Requires external web API**: `setInterval`/`clearInterval` for auto-rotation
- **Cleanup required**: Yes - timers must be cleared in `onDisconnected`

## Keyboard Interaction

- **Tab / Shift + Tab**: Moves focus through interactive elements
- **Enter/Space on rotation button**: Toggle auto-rotation
- **Enter/Space on prev/next**: Change slides
- **Auto-rotation stops** when any element receives keyboard focus
- **Auto-rotation stops** when mouse hovers over carousel

## WAI-ARIA Roles, States, and Properties

### Required

- **role="region"**: Carousel container
- **aria-roledescription="carousel"**: Identifies the widget
- **aria-label**: Accessible label for carousel
- **role="group"** with **aria-roledescription="slide"**: Each slide
- **aria-label**: Accessible label for each slide

### Optional

- **aria-live**: Set to `"off"` for auto-rotating, `"polite"` for manual
- **aria-atomic="false"**: On live region container
- **aria-disabled="true"**: On active picker button

## Best Practices

1. **Use bElements** - Carousels require complex state and timer management
2. **Always cleanup timers** - Clear intervals in `onDisconnected`
3. **Stop rotation on focus** - Essential for keyboard users
4. **Stop rotation on hover** - Improves mouse user experience
5. **Provide rotation control** - Users must be able to stop/start
6. **Use static `p-trigger`** - Never add event handlers dynamically
7. **Use `$()` with `p-target`** - Never use `querySelector` directly
8. **Label slides meaningfully** - Use descriptive names

## Accessibility Considerations

- Screen readers announce slide changes via ARIA live regions
- Auto-rotation stops when keyboard focus enters carousel
- Auto-rotation stops when mouse hovers over carousel
- Rotation control button label changes to reflect current state
- Slide labels should be descriptive

## Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome | Full support |
| Firefox | Full support |
| Safari | Full support |
| Edge | Full support |

## References

- Source: [W3C ARIA Authoring Practices Guide - Carousel Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/carousel/)
- MDN: [ARIA live regions](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/ARIA_Live_Regions)
