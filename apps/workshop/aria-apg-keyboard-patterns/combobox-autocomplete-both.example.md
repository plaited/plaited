---
source: https://www.w3.org/WAI/ARIA/apg/patterns/combobox/examples/combobox-autocomplete-both/
---
Editable Combobox With Both List and Inline Autocomplete Example
================================================================

Keyboard Support
----------------

The example combobox on this page implements the following keyboard interface. Other variations and options for the keyboard interface are described in the [Keyboard Interaction section of the Combobox Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/#keyboard_interaction).

### Textbox

| Key | Function |
| --- | --- |
| Down Arrow | 
*   If the listbox is displayed and a suggestion is selected, moves visual focus to the next suggested value.
*   If the textbox is empty and the listbox is not displayed, opens the listbox and moves visual focus to the first option.
*   In both cases DOM focus remains on the textbox.

 |
| Alt + Down Arrow | Opens the listbox without moving focus or changing selection. |
| Up Arrow | 

*   If the listbox is displayed and a suggestion is selected, moves visual focus to the last suggested value.
*   If the textbox is empty, first opens the listbox if it is not already displayed and then moves visual focus to the last option.
*   In both cases DOM focus remains on the textbox.

 |
| Enter | 

*   Sets the textbox value to the content of the selected option.
*   Closes the listbox.

 |
| Escape | 

*   If the listbox is displayed, closes it.
*   If the listbox is not displayed, clears the textbox.

 |
| Standard single line text editing keys | 

*   Keys used for cursor movement and text manipulation, such as Delete and Shift + Right Arrow.
*   An HTML `input` with `type="text"` is used for the textbox so the browser will provide platform-specific editing keys.

 |

### Listbox Popup

**NOTE:** When visual focus is in the listbox, DOM focus remains on the textbox and the value of `aria-activedescendant` on the textbox is set to a value that refers to the listbox option that is visually indicated as focused. Where the following descriptions of keyboard commands mention focus, they are referring to the visual focus indicator. For more information about this focus management technique, see [Managing Focus in Composites Using aria-activedescendant](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/#kbd_focus_activedescendant).

| Key | Function |
| --- | --- |
| Enter | 
*   Sets the textbox value to the content of the focused option in the listbox.
*   Closes the listbox.
*   Sets visual focus on the textbox.

 |
| Escape | 

*   Closes the listbox.
*   Sets visual focus on the textbox.

 |
| Down Arrow | 

*   Moves visual focus to the next option.
*   If visual focus is on the last option, moves visual focus to the first option.
*   Note: This wrapping behavior is useful when Home and End move the editing cursor as described below.

 |
| Up Arrow | 

*   Moves visual focus to the previous option.
*   If visual focus is on the first option, moves visual focus to the last option.
*   Note: This wrapping behavior is useful when Home and End move the editing cursor as described below.

 |
| Right Arrow | Moves visual focus to the textbox and moves the editing cursor one character to the right. |
| Left Arrow | Moves visual focus to the textbox and moves the editing cursor one character to the left. |
| Home | Moves visual focus to the textbox and places the editing cursor at the beginning of the field. |
| End | Moves visual focus to the textbox and places the editing cursor at the end of the field. |
| Printable Characters | 

*   Moves visual focus to the textbox.
*   Types the character in the textbox.
*   Options in the listbox are filtered based on characters in the textbox.

 |

### Button

The button has been removed from the tab sequence of the page, but is still important to assistive technologies for mobile devices that use touch events to open the list of options.