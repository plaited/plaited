---
source: https://www.w3.org/WAI/ARIA/apg/patterns/carousel/examples/carousel-2-tablist/
---
Auto-Rotating Image Carousel with Tabs for Slide Control Example
================================================================

Keyboard Support
----------------

### Rotation Control Button

| Key | Function |
| --- | --- |
| Tab | 
*   Moves focus through interactive elements in the carousel.
*   Rotation control button and tab list precede the slide content in the Tab sequence.

 |
| Enter or Space | Toggle automatic rotation of slides in the carousel. |

### Tabs

| Key | Function |
| --- | --- |
| Tab | 
*   When focus moves into the `tablist`, places focus on the active `tab` element. Each slide in the carousel is controlled by a `tab`.
*   When the tab list contains the focus, moves focus to the next element in the tab sequence, which is a link in the currently shown slide.

 |
| Right Arrow | 

*   Moves focus to the next tab.
*   If focus is on the last tab, moves focus to the first tab.
*   Shows the slide associated with the newly focused tab.

 |
| Left Arrow | 

*   Moves focus to the previous tab.
*   If focus is on the first tab, moves focus to the last tab.
*   Shows the slide associated with the newly focused tab.

 |
| Home | Moves focus to the first tab and shows the first slide. |
| End | Moves focus to the last tab and shows the last slide. |