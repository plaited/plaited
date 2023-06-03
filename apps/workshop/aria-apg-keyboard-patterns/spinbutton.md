﻿---
source: https://www.w3.org/WAI/ARIA/apg/patterns/spinbutton/

---
# Spinbutton Pattern

## About This Pattern

A spinbutton is an input widget that restricts its value to a set or range of discrete values. For example, in a widget that enables users to set an alarm, a spinbutton could allow users to select a number from 0 to 59 for the minute of an hour.

Spinbuttons often have three components, including a text field that displays the current value, an increase button, and a decrease button. The text field is usually the only focusable component because the increase and decrease functions are keyboard accessible via arrow keys. Typically, the text field also allows users to directly edit the value.

If the range is large, a spinbutton may support changing the value in both small and large steps. For instance, in the alarm example, the user may be able to move by 1 minute with  Up Arrow  and  Down Arrow  and by 10 minutes with  Page Up  and  Page Down.

![](images/spinbutton.svg)

## Example

[Date Picker Spin Button Example:](datepicker-spinbuttons.example.md)  Illustrates a date picker made from three spin buttons for day, month, and year.

## Keyboard Interaction

-   Up Arrow: Increases the value.
-   Down Arrow: Decreases the value.
-   Home: If the spinbutton has a minimum value, sets the value to its minimum.
-   End: If the spinbutton has a maximum value, sets the value to its maximum.
-   Page Up  (Optional): Increases the value by a larger step than  Up Arrow.
-   Page Down  (Optional): Decreases the value by a larger step than  Down Arrow.
-   If the spinbutton text field allows directly editing the value, the following keys are supported:
    -   Standard single line text editing keys appropriate for the device platform (see note below).
    -   Printable Characters: Type characters in the textbox. Note that many implementations allow only certain characters as part of the value and prevent input of any other characters. For example, an hour-and-minute spinner would allow only integer values from 0 to 59, the colon ':', and the letters 'AM' and 'PM'. Any other character input does not change the contents of the text field nor the value of the spinbutton.

### Note

1.  Focus remains on the text field during operation.
2.  Standard single line text editing keys appropriate for the device platform:
    1.  include keys for input, cursor movement, selection, and text manipulation.
    2.  Standard key assignments for editing functions depend on the device operating system.
    3.  The most robust approach for providing text editing functions is to rely on browsers, which supply them for HTML inputs with type text and for elements with the  `contenteditable`  HTML attribute.
    4.  **IMPORTANT:**  Be sure that JavaScript does not interfere with browser-provided text editing functions by capturing key events for the keys used to perform them.

## WAI-ARIA Roles, States, and Properties

-   The focusable element serving as the spinbutton has role  [spinbutton](https://w3c.github.io/aria/#spinbutton). This is typically an element that supports text input.
-   The spinbutton element has the  [aria-valuenow](https://w3c.github.io/aria/#aria-valuenow)  property set to a decimal value representing the current value of the spinbutton.
-   The spinbutton element has the  [aria-valuemin](https://w3c.github.io/aria/#aria-valuemin)  property set to a decimal value representing the minimum allowed value of the spinbutton if it has a known minimum value.
-   The spinbutton element has the  [aria-valuemax](https://w3c.github.io/aria/#aria-valuemax)  property set to a decimal value representing the maximum allowed value of the spinbutton if it has a known maximum value.
-   If the value of  `aria-valuenow`  is not user-friendly, e.g., the day of the week is represented by a number, the  [aria-valuetext](https://w3c.github.io/aria/#aria-valuetext)  property is set on the spinbutton element to a string that makes the spinbutton value understandable, e.g., "Monday".
-   If the spinbutton has a visible label, it is referenced by  [aria-labelledby](https://w3c.github.io/aria/#aria-labelledby)  on the spinbutton element. Otherwise, the spinbutton element has a label provided by  [aria-label](https://w3c.github.io/aria/#aria-label).
-   The spinbutton element has  [aria-invalid](https://w3c.github.io/aria/#aria-invalid)  set to  `true`  if the value is outside the allowed range. Note that most implementations prevent input of invalid values, but in some scenarios, blocking all invalid input may not be practical.

