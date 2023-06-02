---
source: https://www.w3.org/WAI/ARIA/apg/patterns/slider/

---
# Slider Pattern

## About This Pattern

A slider is an input where the user selects a value from within a given range. Sliders typically have a slider thumb that can be moved along a bar, rail, or track to change the value of the slider.

### Warning

Some users of touch-based assistive technologies may experience difficulty utilizing widgets that implement this slider pattern because the gestures their assistive technology provides for operating sliders may not yet generate the necessary output. To change the slider value, touch-based assistive technologies need to respond to user gestures for increasing and decreasing the value by synthesizing key events. This is a new convention that may not be fully implemented by some assistive technologies. Authors should fully test slider widgets using assistive technologies on devices where touch is a primary input mechanism before considering incorporation into production systems.

![](images/slider.svg)

## Examples

-   [Color Viewer Slider Example](slider-color-viewer.example.md): Basic horizontal sliders that illustrate setting numeric values for a color picker.
-   [Vertical Temperature Slider Example](slider-temperature.example.md): Demonstrates using  `aria-orientation`  to specify vertical orientation and  `aria-valuetext`  to communicate unit of measure for a temperature input.
-   [Rating Slider Example](slider-rating.example.md): Horizontal slider that demonstrates using  `aria-valuetext`  to communicate current and maximum value of a rating input for a five star rating scale.
-   [Media Seek Slider Example](slider-seek.example.md): Horizontal slider that demonstrates using  `aria-valuetext`  to communicate current and maximum values of time in media to make the values easy to understand for assistive technology users by converting the total number of seconds to minutes and seconds.

## Keyboard Interaction

-   Right Arrow: Increase the value of the slider by one step.
-   Up Arrow: Increase the value of the slider by one step.
-   Left Arrow: Decrease the value of the slider by one step.
-   Down Arrow: Decrease the value of the slider by one step.
-   Home: Set the slider to the first allowed value in its range.
-   End: Set the slider to the last allowed value in its range.
-   Page Up  (Optional): Increase the slider value by an amount larger than the step change made by  Up Arrow.
-   Page Down  (Optional): Decrease the slider value by an amount larger than the step change made by  Down Arrow.

### Note

1.  Focus is placed on the slider (the visual object that the mouse user would move, also known as the thumb.
2.  In some circumstances, reversing the direction of the value change for the keys specified above, e.g., having  Up Arrow  decrease the value, could create a more intuitive experience.

## WAI-ARIA Roles, States, and Properties

-   The element serving as the focusable slider control has role  [slider](https://w3c.github.io/aria/#slider).
-   The slider element has the  [aria-valuenow](https://w3c.github.io/aria/#aria-valuenow)  property set to a decimal value representing the current value of the slider.
-   The slider element has the  [aria-valuemin](https://w3c.github.io/aria/#aria-valuemin)  property set to a decimal value representing the minimum allowed value of the slider.
-   The slider element has the  [aria-valuemax](https://w3c.github.io/aria/#aria-valuemax)  property set to a decimal value representing the maximum allowed value of the slider.
-   If the value of  `aria-valuenow`  is not user-friendly, e.g., the day of the week is represented by a number, the  [aria-valuetext](https://w3c.github.io/aria/#aria-valuetext)  property is set to a string that makes the slider value understandable, e.g., "Monday".
-   If the slider has a visible label, it is referenced by  [aria-labelledby](https://w3c.github.io/aria/#aria-labelledby)  on the slider element. Otherwise, the slider element has a label provided by  [aria-label](https://w3c.github.io/aria/#aria-label).
-   If the slider is vertically oriented, it has  [aria-orientation](https://w3c.github.io/aria/#aria-orientation)  set to  `vertical`. The default value of  `aria-orientation`  for a slider is  `horizontal`.

