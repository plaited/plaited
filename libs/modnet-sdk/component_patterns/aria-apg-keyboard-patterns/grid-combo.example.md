---
source: https://www.w3.org/WAI/ARIA/apg/patterns/combobox/examples/grid-combo/
---
Editable Combobox with Grid Popup Example
=========================================

Keyboard Support
----------------

The example combobox on this page implements the following keyboard interface. Other variations and options for the keyboard interface are described in the [Keyboard Interaction section of the combobox pattern.](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/#keyboard_interaction)

### Textbox

| Key | Function |
| --- | --- |
| Down Arrow | If the grid is displayed, moves focus to the first suggested value. |
| Up Arrow | If the grid is displayed, moves focus to the last suggested value. |
| Escape | 
*   If the grid is displayed, closes it.
*   If the grid is not displayed, clears the textbox.

 |
| Standard single line text editing keys | 

*   Keys used for cursor movement and text manipulation, such as Delete and Shift + Right Arrow.
*   An HTML `input` with `type=text` is used for the textbox so the browser will provide platform-specific editing keys.

 |

### Grid Popup

**NOTE:** When visual focus is in the grid, DOM focus remains on the textbox and the value of `aria-activedescendant` on the textbox is set to a value that refers to an element in the grid that is visually indicated as focused. Where the following descriptions of keyboard commands mention focus, they are referring to the visual focus indicator. For more information about this focus management technique, see [Managing Focus in Composites Using aria-activedescendant](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/#kbd_focus_activedescendant).

| Key | Function |
| --- | --- |
| Enter | 
*   Sets the textbox value to the content of the first cell in the row containing focus.
*   Closes the grid popup.
*   Sets focus on the textbox.

 |
| Escape | 

*   Closes the grid.
*   Sets visual focus on the textbox.

 |
| Down Arrow | 

*   Moves focus to the next row.
*   If focus is in the last row, moves focus to the first row.
*   Note: This wrapping behavior is useful when Home and End move the editing cursor as described below.

 |
| Up Arrow | 

*   Moves focus to the previous row.
*   If focus is in the first row, moves focus to the last row.
*   Note: This wrapping behavior is useful when Home and End move the editing cursor as described below.

 |
| Right Arrow | 

*   Moves focus to the next cell.
*   If focus is in the last cell in a row, moves focus to the first cell in the next row.
*   If focus is in the last cell in the last row, moves focus to the first cell in the first row.

 |
| Left Arrow | 

*   Moves focus to the previous cell.
*   If focus is in the first cell in a row, moves focus to the last cell in the previous row.
*   If focus is in the first cell in the first row, moves focus to the last cell in the last row.

 |
| Home | Moves focus to the textbox and places the editing cursor at the beginning of the field. |
| End | Moves focus to the textbox and places the editing cursor at the end of the field. |
| Printable Characters | 

*   Moves focus to the textbox.
*   Types the character in the textbox.

 |