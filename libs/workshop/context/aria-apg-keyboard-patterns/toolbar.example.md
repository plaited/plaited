---
source: https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/examples/toolbar/
---
Toolbar Example
===============

Keyboard Support
----------------

### Toolbar

The toolbar provides the following keyboard support described in the [toolbar pattern](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/#keyboard_interaction).

| Key | Function |
| --- | --- |
| Tab | 
*   Moves focus into and out of the toolbar.
*   The first control is focused if the toolbar is receiving focus for the first time after page load.
*   Otherwise, the most recently focused control receives focus.

 |
| Right Arrow | 

*   Moves focus to the next control.
*   If the last control has focus, focus moves to the first control.
*   If an item in the popup menu has focus, does nothing.

 |
| Left Arrow | 

*   Moves focus to the previous control.
*   If the first control has focus, focus moves to the last control.
*   If an item in the popup menu has focus, does nothing.

 |
| Home | Moves focus to the first control. |
| End | Moves focus to the last control. |
| ESC | If a button popup label is visible, hides it. |

### Toggle Buttons (Bold, Italic, Underline)

The toggle buttons for choosing to apply **Bold**, _Italic_, and Underline styling provide the following keyboard support described in the [Button Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/#keyboard_interaction).

| Key | Function |
| --- | --- |
| Enter  
Space | Toggle the pressed state of the button. |

### Radio Group (Text Alignment)

The buttons for choosing left, center, or right text alignment are styled like toggle buttons. However, since pressing one toggles off another so that only one button in the group is in the pressed state, the toggles behave like radio buttons. Because ARIA is designed to inform assistive technologies about UI semantics and behaviors, not styling, the alignment toggles provide the following keyboard support described in the [Radio Group Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/radio/#keyboard_interaction). As described in the pattern, nesting a radio group in a toolbar calls for an important behavioral difference compared to radios outside a toolbar: moving focus inside the group does not automatically change which button is checked. In addition, because Left Arrow and Right Arrow are needed by the parent toolbar, they are not captured by the radio group. The toolbar thus provides navigation into, inside, and out of the nested radio group.

| Key | Function |
| --- | --- |
| Enter  
Space | 
*   If the focused radio button is checked, do nothing.
*   Otherwise, uncheck the currently checked radio button and check the radio button that has focus.

 |
| Down Arrow | 

*   Moves focus to the next radio button.
*   If the last radio button has focus, focus moves to the first radio button.

 |
| Up Arrow | 

*   Moves focus to the previous radio button.
*   If the radio button has focus, focus moves to the last radio button.

 |

### Button (Cut, Copy, Paste)

The buttons for cut, copy, and paste provide the following keyboard support described in the [Button Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/#keyboard_interaction). While they are HTML button elements, as described in the accessibility features section above, in order to remain focusable when disabled, they have `aria-disabled` instead of the HTML `disabled` attribute.

| Key | Function |
| --- | --- |
| Enter  
Space | If the button is enabled, execute the action associated with the button. Otherwise, do nothing. |

### Menu Button (Font Family)

The menu button for opening the font family menu provides the following keyboard support described in the [Menu Button Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/#keyboard_interaction).

| Key | Function |
| --- | --- |
| Enter  
Space  
Down Arrow  
Up Arrow | Open the menu and place focus on a menu item. In this implementation, the focus is set on the currently selected font family when the menu opens. |

### Menu (Font Family)

The menu for choosing a font family provides the following keyboard support described in the [Menu and Menubar Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/menubar/#keyboard_interaction).

| Key | Function |
| --- | --- |
| Enter  
Space | Activate the menu item, close the menu, and place focus on the menu button. |
| Down Arrow | 
*   Moves focus to the next menu item.
*   If the last menu item has focus, focus moves to the first menu item.

 |
| Up Arrow | 

*   Moves focus to the previous menu item.
*   If the first menu item has focus, focus moves to the last menu item.

 |
| ESC | Closes the menu and moves focus to the menu button. |

### Spin Button (Font Size)

The spin button for changing font size provides the following keyboard support described in the [Spin Button Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/spinbutton/#keyboard_interaction).

| Key | Function |
| --- | --- |
| Down Arrow | Decreases the font size of the text in the `textarea` by 1 point. |
| Up Arrow | Increases the font size of the text in the `textarea` by 1 point. |
| Page Down | Decreases the font size of the text in the `textarea` by 5 points. |
| Page Up | Increases the font size of the text in the `textarea` by 5 points. |

### Checkbox (Night Mode)

The checkbox for toggling night mode provides the following keyboard support defined in the [Checkbox Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/#keyboard_interaction). As an HTML input element, the browser provides the keyboard support.

| Key | Function |
| --- | --- |
| Space | Toggles the state of the checkbox. |

### Link (Help)

The link for opening a help page provides the following keyboard support described in the [Link Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/link/#keyboard_interaction). As an HTML link, the keyboard support is provided by the browser.

| Key | Function |
| --- | --- |
| Enter  
Space | Activate the link. |