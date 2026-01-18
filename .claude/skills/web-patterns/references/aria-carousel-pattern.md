# ARIA Carousel Pattern

## Overview

A carousel presents a set of three or more related items, usually images or movies, in sequential order. Typically one slide is displayed at a time and users can activate a next or previous slide control to hide the current slide and "rotates" the next or previous slide into view. In some implementations, rotation automatically starts when the page loads and it may also automatically stop once all the slides have been displayed.

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
    <div role="group" aria-roledescription="slide" aria-label="Product 3 of 3" hidden>
      <img src="product3.jpg" alt="Product 3">
    </div>
  </div>
</div>
```

```javascript
let currentSlide = 0
let autoRotateInterval = null
const slides = document.querySelectorAll('[role="group"]')
const rotationButton = document.querySelector('button[aria-label*="rotation"]')

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
// Restart on mouse leave (if user wants)
carousel.addEventListener('mouseleave', () => {
  if (rotationButton.getAttribute('aria-label').includes('Start')) {
    startRotation()
  }
})
```

### Plaited Adaptation

**Important**: In Plaited, carousels are implemented as **bElements** because they require:
- Complex state management (current slide, rotation state)
- Timer management (auto-rotation)
- Focus management
- Keyboard event handling
- ARIA live region updates

#### Basic Carousel (bElement)

```typescript
import { bElement } from 'plaited/ui'
import { createStyles } from 'plaited/ui'

const carouselStyles = createStyles({
  carousel: {
    position: 'relative',
    inlineSize: '100%',
    maxInlineSize: '800px',
    margin: '0 auto',
  },
  controls: {
    display: 'flex',
    gap: '0.5rem',
    marginBottom: '1rem',
  },
  button: {
    padding: '0.5rem 1rem',
    border: '1px solid #ccc',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  slidesContainer: {
    position: 'relative',
    overflow: 'hidden',
  },
  slide: {
    display: {
      $default: 'none',
      '[data-active="true"]': 'block',
    },
  },
})

type CarouselEvents = {
  slideChange: { index: number; total: number }
  rotationToggle: { isRotating: boolean }
}

export const Carousel = bElement<CarouselEvents>({
  tag: 'accessible-carousel',
  observedAttributes: ['auto-rotate', 'rotation-interval'],
  shadowDom: (
    <div
      p-target='carousel'
      role='region'
      aria-roledescription='carousel'
      aria-label='Image carousel'
      {...carouselStyles.carousel}
      p-trigger={{ focusin: 'handleFocusIn', mouseenter: 'handleMouseEnter', mouseleave: 'handleMouseLeave' }}
    >
      <div {...carouselStyles.controls}>
        <button
          type='button'
          p-target='rotation-button'
          p-trigger={{ click: 'toggleRotation' }}
          {...carouselStyles.button}
        >
          <slot name='rotation-label'>Stop rotation</slot>
        </button>
        <button
          type='button'
          p-target='prev-button'
          p-trigger={{ click: 'previousSlide' }}
          aria-label='Previous slide'
          {...carouselStyles.button}
        >
          <slot name='prev-label'>Previous</slot>
        </button>
        <button
          type='button'
          p-target='next-button'
          p-trigger={{ click: 'nextSlide' }}
          aria-label='Next slide'
          {...carouselStyles.button}
        >
          <slot name='next-label'>Next</slot>
        </button>
      </div>
      <div
        p-target='slides-container'
        aria-live='off'
        aria-atomic='false'
        {...carouselStyles.slidesContainer}
      >
        <slot name='slides'></slot>
      </div>
    </div>
  ),
  bProgram({ $, host, emit, root }) {
    const carousel = $('carousel')[0]
    const rotationButton = $<HTMLButtonElement>('rotation-button')[0]
    const slidesContainer = $('slides-container')[0]
    
    let currentSlideIndex = 0
    let isRotating = false
    let rotationInterval: ReturnType<typeof setInterval> | undefined
    let slides: HTMLElement[] = []
    
    const rotationIntervalMs = parseInt(host.getAttribute('rotation-interval') || '5000', 10)

    const getSlides = () => {
      const slot = slidesContainer?.querySelector('slot[name="slides"]') as HTMLSlotElement
      if (!slot) return []
      
      const assignedNodes = slot.assignedElements()
      return assignedNodes.filter((node) => 
        node.hasAttribute('role') && node.getAttribute('role') === 'group'
      ) as HTMLElement[]
    }

    const showSlide = (index: number) => {
      slides.forEach((slide, i) => {
        slide.attr('data-active', i === index ? 'true' : 'false')
        slide.attr('hidden', i === index ? null : '')
      })
      currentSlideIndex = index
      emit({ type: 'slideChange', detail: { index, total: slides.length } })
    }

    const startRotation = () => {
      if (isRotating || slides.length === 0) return
      
      isRotating = true
      rotationButton?.attr('aria-label', 'Stop slide rotation')
      rotationButton?.render('Stop rotation')
      
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
      rotationButton?.render('Start rotation')
    }

    const toggleRotation = () => {
      if (isRotating) {
        stopRotation()
      } else {
        startRotation()
      }
      emit({ type: 'rotationToggle', detail: { isRotating: !isRotating } })
    }

    return {
      toggleRotation,
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
      handleFocusIn() {
        // Stop rotation when any element in carousel receives focus
        stopRotation()
      },
      handleMouseEnter() {
        // Stop rotation when mouse enters carousel
        stopRotation()
      },
      handleMouseLeave() {
        // Don't auto-restart - user must explicitly start rotation
      },
      onConnected() {
        slides = getSlides()
        if (slides.length > 0) {
          showSlide(0)
          
          // Start auto-rotation if attribute is set
          if (host.hasAttribute('auto-rotate')) {
            startRotation()
          }
        }
      },
      onDisconnected() {
        // Cleanup timer
        if (rotationInterval) {
          clearInterval(rotationInterval)
          rotationInterval = undefined
        }
      },
      onAttributeChanged({ name, newValue }) {
        if (name === 'auto-rotate') {
          if (newValue !== null) {
            startRotation()
          } else {
            stopRotation()
          }
        }
        if (name === 'rotation-interval' && isRotating) {
          stopRotation()
          startRotation()
        }
      },
    }
  },
})
```

#### Slide Component (Functional Template)

```typescript
// slide.stories.tsx
import type { FT, Children } from 'plaited/ui'
import { joinStyles } from 'plaited/ui'
import { slideStyles } from './slide.css.ts'

const Slide: FT<{
  'aria-label': string
  children?: Children
}> = ({ 'aria-label': ariaLabel, children, ...attrs }) => (
  <div
    role='group'
    aria-roledescription='slide'
    aria-label={ariaLabel}
    data-active='false'
    hidden
    {...attrs}
    {...joinStyles(slideStyles.slide)}
  >
    {children}
  </div>
)

export const slideStory = story({
  intent: 'Display a carousel slide',
  template: () => (
    <Slide aria-label='Product 1 of 3'>
      <img src='product1.jpg' alt='Product 1' />
    </Slide>
  ),
})
```

#### Tabbed Carousel (with Tabs Pattern)

```typescript
import { bElement } from 'plaited/ui'
import { createStyles } from 'plaited/ui'

const tabbedCarouselStyles = createStyles({
  carousel: {
    position: 'relative',
    inlineSize: '100%',
  },
  tablist: {
    display: 'flex',
    gap: '0.5rem',
    marginBottom: '1rem',
    listStyle: 'none',
    padding: 0,
  },
  tab: {
    padding: '0.5rem 1rem',
    border: '1px solid #ccc',
    background: 'transparent',
    cursor: 'pointer',
  },
  tabpanel: {
    display: {
      $default: 'none',
      '[aria-hidden="false"]': 'block',
    },
  },
})

type TabbedCarouselEvents = {
  slideChange: { index: number }
}

export const TabbedCarousel = bElement<TabbedCarouselEvents>({
  tag: 'tabbed-carousel',
  shadowDom: (
    <div
      p-target='carousel'
      role='region'
      aria-roledescription='carousel'
      aria-label='Image carousel'
      {...tabbedCarouselStyles.carousel}
    >
      <div
        p-target='tablist'
        role='tablist'
        aria-label='Choose slide to display'
        {...tabbedCarouselStyles.tablist}
      >
        {/* Tabs will be dynamically rendered */}
      </div>
      <slot name='panels'></slot>
    </div>
  ),
  bProgram({ $, emit }) {
    const tablist = $('tablist')[0]
    let tabs: HTMLElement[] = []
    let panels: HTMLElement[] = []
    let currentIndex = 0

    const showSlide = (index: number) => {
      // Update tabs
      tabs.forEach((tab, i) => {
        tab.attr('aria-selected', i === index ? 'true' : 'false')
        tab.attr('tabindex', i === index ? '0' : '-1')
      })
      
      // Update panels
      panels.forEach((panel, i) => {
        panel.attr('aria-hidden', i === index ? 'false' : 'true')
      })
      
      currentIndex = index
      emit({ type: 'slideChange', detail: { index } })
    }

    return {
      selectTab(event: { target: HTMLElement }) {
        const tabIndex = tabs.indexOf(event.target)
        if (tabIndex !== -1) {
          showSlide(tabIndex)
        }
      },
      handleTabKeydown(event: KeyboardEvent) {
        const currentTab = event.target as HTMLElement
        const currentTabIndex = tabs.indexOf(currentTab)
        
        let nextIndex = currentTabIndex
        
        switch (event.key) {
          case 'ArrowRight':
            event.preventDefault()
            nextIndex = (currentTabIndex + 1) % tabs.length
            break
          case 'ArrowLeft':
            event.preventDefault()
            nextIndex = currentTabIndex === 0 ? tabs.length - 1 : currentTabIndex - 1
            break
          case 'Home':
            event.preventDefault()
            nextIndex = 0
            break
          case 'End':
            event.preventDefault()
            nextIndex = tabs.length - 1
            break
        }
        
        if (nextIndex !== currentTabIndex) {
          tabs[nextIndex]?.focus()
          showSlide(nextIndex)
        }
      },
      onConnected() {
        // Initialize tabs and panels from slots
        const slot = $('carousel')[0]?.querySelector('slot[name="panels"]') as HTMLSlotElement
        if (!slot) return
        
        const assignedNodes = slot.assignedElements()
        panels = assignedNodes.filter((node) => 
          node.hasAttribute('role') && node.getAttribute('role') === 'tabpanel'
        ) as HTMLElement[]
        
        // Create tabs
        if (tablist && panels.length > 0) {
          tablist.render(
            ...panels.map((panel, index) => {
              const label = panel.getAttribute('aria-labelledby') 
                ? document.getElementById(panel.getAttribute('aria-labelledby') || '')?.textContent 
                : `Slide ${index + 1}`
              
              return (
                <button
                  type='button'
                  role='tab'
                  aria-selected={index === 0 ? 'true' : 'false'}
                  aria-controls={panel.id}
                  tabIndex={index === 0 ? 0 : -1}
                  p-trigger={{ click: 'selectTab', keydown: 'handleTabKeydown' }}
                  {...tabbedCarouselStyles.tab}
                >
                  {label}
                </button>
              )
            })
          )
          
          tabs = Array.from(tablist.querySelectorAll('[role="tab"]')) as HTMLElement[]
          showSlide(0)
        }
      },
    }
  },
})
```

#### Grouped Carousel (with Button Pickers)

```typescript
import { bElement } from 'plaited/ui'
import { createStyles } from 'plaited/ui'

const groupedCarouselStyles = createStyles({
  pickerGroup: {
    display: 'flex',
    gap: '0.5rem',
    marginBottom: '1rem',
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
  },
})

export const GroupedCarousel = bElement({
  tag: 'grouped-carousel',
  shadowDom: (
    <div
      p-target='carousel'
      role='region'
      aria-roledescription='carousel'
      aria-label='Image carousel'
    >
      <div
        p-target='picker-group'
        role='group'
        aria-label='Choose slide to display'
        {...groupedCarouselStyles.pickerGroup}
      >
        {/* Picker buttons will be dynamically rendered */}
      </div>
      <slot name='slides'></slot>
    </div>
  ),
  bProgram({ $ }) {
    const pickerGroup = $('picker-group')[0]
    let pickerButtons: HTMLButtonElement[] = []
    let slides: HTMLElement[] = []
    let currentIndex = 0

    const showSlide = (index: number) => {
      // Update slides
      slides.forEach((slide, i) => {
        slide.attr('hidden', i === index ? null : '')
      })
      
      // Update picker buttons
      pickerButtons.forEach((button, i) => {
        const isActive = i === index
        button.attr('aria-disabled', isActive ? 'true' : 'false')
        button.attr('class', isActive ? 'active' : '')
      })
      
      currentIndex = index
    }

    return {
      selectSlide(event: { target: HTMLButtonElement }) {
        const buttonIndex = pickerButtons.indexOf(event.target)
        if (buttonIndex !== -1) {
          showSlide(buttonIndex)
        }
      },
      onConnected() {
        const slot = $('carousel')[0]?.querySelector('slot[name="slides"]') as HTMLSlotElement
        if (!slot) return
        
        const assignedNodes = slot.assignedElements()
        slides = assignedNodes.filter((node) => 
          node.hasAttribute('role') && node.getAttribute('role') === 'group'
        ) as HTMLElement[]
        
        if (pickerGroup && slides.length > 0) {
          pickerGroup.render(
            ...slides.map((slide, index) => {
              const label = slide.getAttribute('aria-label') || `Slide ${index + 1}`
              
              return (
                <button
                  type='button'
                  aria-label={label}
                  aria-disabled={index === 0 ? 'true' : 'false'}
                  p-trigger={{ click: 'selectSlide' }}
                  {...groupedCarouselStyles.pickerButton}
                  {...(index === 0 ? groupedCarouselStyles.pickerButtonActive : {})}
                />
              )
            })
          )
          
          pickerButtons = Array.from(pickerGroup.querySelectorAll('button')) as HTMLButtonElement[]
          showSlide(0)
        }
      },
    }
  },
})
```

## Plaited Integration

- **Works with Shadow DOM**: Yes - carousels are bElements with Shadow DOM
- **Uses bElement built-ins**: 
  - `p-trigger` for button clicks, focus events, mouse events
  - `p-target` for element selection with `$()`
  - `render()` helper for dynamic content (tabs, picker buttons)
  - `attr()` helper for managing slide visibility and ARIA attributes
  - `observedAttributes` for reactive updates (auto-rotate, rotation-interval)
  - Slots for flexible content distribution
- **Requires external web API**: 
  - `setInterval` / `clearInterval` for auto-rotation (requires cleanup)
  - Focus management APIs
  - Keyboard event handling
- **Cleanup required**: Yes - timers must be cleared in `onDisconnected`

## Keyboard Interaction

- **Tab / Shift + Tab**: Moves focus through interactive elements (standard tab sequence)
- **Rotation control button**: Enter/Space to toggle rotation
- **Previous/Next buttons**: Enter/Space to change slides
- **Tabbed carousel tabs**: 
  - Arrow keys to navigate between tabs
  - Home/End to jump to first/last tab
  - Enter/Space to select tab
- **Auto-rotation stops** when any element in carousel receives keyboard focus
- **Auto-rotation stops** when mouse hovers over carousel

## WAI-ARIA Roles, States, and Properties

### Required

- **role="region"** or **role="group"**: Carousel container
- **aria-roledescription="carousel"**: Identifies the widget as a carousel
- **aria-label** or **aria-labelledby**: Accessible label for carousel
- **role="group"** with **aria-roledescription="slide"**: Each slide container
- **aria-label** or **aria-labelledby**: Accessible label for each slide

### Optional

- **aria-live**: Set to `"off"` for auto-rotating, `"polite"` for manual rotation
- **aria-atomic="false"**: On live region container
- **aria-disabled="true"**: On active picker button (grouped carousel)
- **aria-selected**: On active tab (tabbed carousel)
- **aria-hidden**: On hidden slides/panels

## Best Practices

1. **Use bElement** - Carousels require complex state management and timers
2. **Always cleanup timers** - Clear intervals in `onDisconnected`
3. **Stop rotation on focus** - Essential for keyboard users
4. **Stop rotation on hover** - Improves mouse user experience
5. **Provide rotation control** - Users must be able to stop/start auto-rotation
6. **Use ARIA live regions** - Announce slide changes to screen readers
7. **Label slides meaningfully** - Use descriptive names, not just numbers
8. **Consider tabbed pattern** - Better for keyboard navigation than grouped buttons
9. **Don't auto-restart** - Once stopped, require explicit user action to restart

## Accessibility Considerations

- Screen readers announce slide changes via ARIA live regions
- Auto-rotation must stop when keyboard focus enters carousel
- Auto-rotation must stop when mouse hovers over carousel
- Rotation control button label changes to reflect current state
- Slide labels should be descriptive (e.g., "Product 1" not just "1 of 3")
- Tabbed carousel provides better keyboard navigation than grouped buttons
- Focus management ensures users can navigate all controls

## Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome | Full support |
| Firefox | Full support |
| Safari | Full support |
| Edge | Full support |

**Note**: Native HTML elements, ARIA attributes, and JavaScript timers have universal support in modern browsers with assistive technology.

## References

- Source: [W3C ARIA Authoring Practices Guide - Carousel Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/carousel/)
- Related: [Tabs Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/)
- MDN: [ARIA live regions](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/ARIA_Live_Regions)
- MDN: [setInterval](https://developer.mozilla.org/en-US/docs/Web/API/setInterval)
