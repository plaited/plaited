---
source: https://www.w3.org/WAI/ARIA/apg/patterns/combobox/examples/combobox-select-only/
---
Select-Only Combobox Example
============================

Keyboard Support
----------------

The example combobox on this page implements the following keyboard interface. Other variations and options for the keyboard interface are described in the [Keyboard Interaction section of the combobox pattern.](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/#keyboard_interaction)

### Closed Combobox

| Key | Function |
| --- | --- |
| Down Arrow | 
*   Opens the listbox if it is not already displayed without moving focus or changing selection.
*   DOM focus remains on the combobox.

 |
| Alt + Down Arrow | Opens the listbox without moving focus or changing selection. |
| Up Arrow | 

*   First opens the listbox if it is not already displayed and then moves visual focus to the first option.
*   DOM focus remains on the combobox.

 |
| Enter | Opens the listbox without moving focus or changing selection. |
| Space | Opens the listbox without moving focus or changing selection. |
| Home | Opens the listbox and moves visual focus to the first option. |
| End | Opens the listbox and moves visual focus to the last option. |
| Printable Characters | 

*   First opens the listbox if it is not already displayed and then moves visual focus to the first option that matches the typed character.
*   If multiple keys are typed in quick succession, visual focus moves to the first option that matches the full string.
*   If the same character is typed in succession, visual focus cycles among the options starting with that character.

 |

### Listbox Popup

**NOTE:** When visual focus is in the listbox, DOM focus remains on the combobox and the value of `aria-activedescendant` on the combobox is set to a value that refers to the listbox option that is visually indicated as focused. Where the following descriptions of keyboard commands mention focus, they are referring to the visual focus indicator. For more information about this focus management technique, see [Managing Focus in Composites Using aria-activedescendant](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/#kbd_focus_activedescendant).

| Key | Function |
| --- | --- |
| Enter | 
*   Sets the value to the content of the focused option in the listbox.
*   Closes the listbox.
*   Sets visual focus on the combobox.

 |
| Space | 

*   Sets the value to the content of the focused option in the listbox.
*   Closes the listbox.
*   Sets visual focus on the combobox.

 |
| Tab | 

*   Sets the value to the content of the focused option in the listbox.
*   Closes the listbox.
*   Performs the default action, moving focus to the next focusable element. Note: the native `<select>` element closes the listbox but does not move focus on tab. This pattern matches the behavior of the other comboboxes rather than the native element in this case.

 |
| Escape | 

*   Closes the listbox.
*   Sets visual focus on the combobox.

 |
| Down Arrow | 

*   Moves visual focus to the next option.
*   If visual focus is on the last option, visual focus does not move.

 |
| Up Arrow | 

*   Moves visual focus to the previous option.
*   If visual focus is on the first option, visual focus does not move.

 |
| Alt + Up Arrow | 

*   Sets the value to the content of the focused option in the listbox.
*   Closes the listbox.
*   Sets visual focus on the combobox.

 |
| Home | Moves visual focus to the first option. |
| End | Moves visual focus to the last option. |
| PageUp | Jumps visual focus up 10 options (or to first option). |
| PageDown | Jumps visual focus down 10 options (or to last option). |
| Printable Characters | 

*   First opens the listbox if it is not already displayed and then moves visual focus to the first option that matches the typed character.
*   If multiple keys are typed in quick succession, visual focus moves to the first option that matches the full string.
*   If the same character is typed in succession, visual focus cycles among the options starting with that character.

 |