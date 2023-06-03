---
source: https://www.w3.org/WAI/ARIA/apg/patterns/listbox/examples/listbox-collapsible/
---
(Deprecated) Collapsible Dropdown Listbox Example
=================================================

Keyboard Support
----------------

The example listbox on this page implements the following keyboard interface. Other variations and options for the keyboard interface are described in the [Keyboard Interaction section of the Listbox Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/listbox/#keyboard_interaction).

| Key | Function |
| --- | --- |
| Enter | 
*   If the focus is on the button, expands the listbox and places focus on the currently selected option in the list.
*   If focus is in the listbox , collapses the listbox and keeps the currently selected option as the button label.

 |
| Escape | If the listbox is displayed, collapses the listbox and moves focus to the button. |
| Down Arrow | 

*   Moves focus to and selects the next option.
*   If the listbox is collapsed, also expands the list.

 |
| Up Arrow | 

*   Moves focus to and selects the previous option.
*   If the listbox is collapsed, also expands the list.

 |
| Home | If the listbox is displayed, moves focus to and selects the first option. |
| End | If the listbox is displayed, moves focus to and selects the last option. |
| Printable Characters | 

*   Type a character: focus moves to the next item with a name that starts with the typed character.
*   Type multiple characters in rapid succession: focus moves to the next item with a name that starts with the string of characters typed.

 |