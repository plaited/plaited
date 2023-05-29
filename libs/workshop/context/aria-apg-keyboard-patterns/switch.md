---
source: https://www.w3.org/WAI/ARIA/apg/patterns/switch/

---
# Switch Pattern

## About This Pattern

A  [switch](https://w3c.github.io/aria/#switch)  is an input widget that allows users to choose one of two values:  on  or  off. Switches are similar to  [checkboxes](checkbox.md)  and  [toggle buttons](button.md), which can also serve as binary inputs. One difference, however, is that switches can only be used for binary input while checkboxes and toggle buttons allow implementations the option of supporting a third middle state. Checkboxes can be  checked  or  not checked  and can optionally also allow for a  partially checked  state. Toggle buttons can be  pressed  or  not pressed  and can optionally allow for a  partially pressed  state.

Since switch, checkbox, and toggle button all offer binary input, they are often functionally interchangeable. Choose the role that best matches both the visual design and semantics of the user interface. For instance, there are some circumstances where the semantics of  on or off  would be easier for assistive technology users to understand than the semantics of  checked or unchecked, and vice versa. Consider a widget for turning lights on or off. In this case, screen reader output of  Lights switch on  is more user friendly than  Lights checkbox checked. However, if the same input were in a group of inputs labeled  Which of the following must be included in your pre-takeoff procedures?,  Lights checkbox checked  would make more sense.

**Important:**  it is critical the label on a switch does not change when its state changes.

![](images/switch.svg)

## Examples

-   [Switch Example](switch.example.md): A switch based on a  `div`  element that turns a notification preference on and off.
-   [Switch Example Using HTML Button](switch-button.example.md): A group of 2 switches based on HTML  `button`  elements that turn lights on and off.
-   [Switch Example Using HTML Checkbox Input](switch-checkbox.example.md): A group of 2 switches based on HTML  `input[type="checkbox"]`  elements that turn accessibility preferences on and off.

## Keyboard Interaction

-   Space: When focus is on the switch, changes the state of the switch.
-   Enter  (Optional): When focus is on the switch, changes the state of the switch.

## WAI-ARIA Roles, States, and Properties

-   The switch has role  [switch](https://w3c.github.io/aria/#switch).
-   The switch has an accessible label provided by one of the following:
    -   Visible text content contained within the element with role  `switch`.
    -   A visible label referenced by the value of  [aria-labelledby](https://w3c.github.io/aria/#aria-labelledby)  set on the element with role  `switch`.
    -   [aria-label](https://w3c.github.io/aria/#aria-label)  set on the element with role  `switch`.
-   When  `on`, the switch element has state  [aria-checked](https://w3c.github.io/aria/#aria-checked)  set to  `true`.
-   When  `off`, the switch element has state  [aria-checked](https://w3c.github.io/aria/#aria-checked)  set to  `false`.
-   If the switch element is an HTML  `input[type="checkbox"]`, it uses the HTML  `checked`  attribute instead of the  `aria-checked`  property.
-   If a set of switches is presented as a logical group with a visible label, either:
    -   The switches are included in an element with role  [group](https://w3c.github.io/aria/#group)  that has the property  [aria-labelledby](https://w3c.github.io/aria/#aria-labelledby)  set to the ID of the element containing the group label.
    -   The set is contained in an HTML  `fieldset`  and the label for the set is contained in an HTML  `legend`  element.
-   If the presentation includes additional descriptive static text relevant to a switch or switch group, the switch or switch group has the property  [aria-describedby](https://w3c.github.io/aria/#aria-describedby)  set to the ID of the element containing the description.

