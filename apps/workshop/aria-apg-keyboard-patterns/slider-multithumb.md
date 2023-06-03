---
source: https://www.w3.org/WAI/ARIA/apg/patterns/slider-multithumb/

---
# Slider (Multi-Thumb) Pattern

## About This Pattern

A multi-thumb slider implements the  [Slider Pattern](slider.md)  but includes two or more thumbs, often on a single rail. Each thumb sets one of the values in a group of related values. For example, in a product search, a two-thumb slider could be used to enable users to set the minimum and maximum price limits for the search. In many two-thumb sliders, the thumbs are not allowed to pass one another, such as when the slider sets the minimum and maximum values for a range. For example, in a price range selector, the maximum value of the thumb that sets the lower end of the range is limited by the current value of the thumb that sets the upper end of the range. Conversely, the minimum value of the upper end thumb is limited by the current value of the lower end thumb. However, in some multi-thumb sliders, each thumb sets a value that does not depend on the other thumb values.

### Warning

Some users of touch-based assistive technologies may experience difficulty utilizing widgets that implement this slider pattern because the gestures their assistive technology provides for operating sliders may not yet generate the necessary output. To change the slider value, touch-based assistive technologies need to respond to user gestures for increasing and decreasing the value by synthesizing key events. This is a new convention that may not be fully implemented by some assistive technologies. Authors should fully test slider widgets using assistive technologies on devices where touch is a primary input mechanism before considering incorporation into production systems.

![](images/slider-multithumb.svg)

## Example

[Horizontal Multi-Thumb Slider Example](slider-multithumb.example.md): Demonstrates a two-thumb slider for picking a price range for a hotel reservation.

## Keyboard Interaction

-   Each thumb is in the page tab sequence and has the keyboard interactions described in the  [Slider Pattern](slider.md#keyboard_interaction).
-   The tab order remains constant regardless of thumb value and visual position within the slider. For example, if the value of a thumb changes such that it moves past one of the other thumbs, the tab order does not change.

## WAI-ARIA Roles, States, and Properties

-   Each element serving as a focusable slider thumb has role  [slider](https://w3c.github.io/aria/#slider).
-   Each slider element has the  [aria-valuenow](https://w3c.github.io/aria/#aria-valuenow)  property set to a decimal value representing the current value of the slider.
-   Each slider element has the  [aria-valuemin](https://w3c.github.io/aria/#aria-valuemin)  property set to a decimal value representing the minimum allowed value of the slider.
-   Each slider element has the  [aria-valuemax](https://w3c.github.io/aria/#aria-valuemax)  property set to a decimal value representing the maximum allowed value of the slider.
-   When the range (e.g. minimum and/or maximum value) of another slider is dependent on the current value of a slider, the values of  [aria-valuemin](https://w3c.github.io/aria/#aria-valuemin)  or  [aria-valuemax](https://w3c.github.io/aria/#aria-valuemax)  of the dependent sliders are updated when the value changes.
-   If a value of  `aria-valuenow`  is not user-friendly, e.g., the day of the week is represented by a number, the  [aria-valuetext](https://w3c.github.io/aria/#aria-valuetext)  property is set to a string that makes the slider value understandable, e.g., "Monday".
-   If a slider has a visible label, it is referenced by  [aria-labelledby](https://w3c.github.io/aria/#aria-labelledby)  on the slider element. Otherwise, the slider element has a label provided by  [aria-label](https://w3c.github.io/aria/#aria-label).
-   If a slider is vertically oriented, it has  [aria-orientation](https://w3c.github.io/aria/#aria-orientation)  set to  `vertical`. The default value of  `aria-orientation`  for a slider is  `horizontal`.

