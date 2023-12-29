---
source: https://www.w3.org/WAI/ARIA/apg/patterns/listbox/examples/listbox-rearrangeable/
---
Example Listboxes with Rearrangeable Options
============================================

Keyboard Support
----------------

The example listboxes on this page implement the following keyboard interface. Other variations and options for the keyboard interface are described in the [Keyboard Interaction section of the Listbox Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/listbox/#keyboard_interaction).

| Key | Function |
| --- | --- |
| Down Arrow | 
*   Moves focus to the next option.
*   In the example 1 single-select listboxes, also selects the focused option.

 |
| Up Arrow | 

*   Moves focus to the previous option.
*   In the example 1 single-select listboxes, also selects the focused option.

 |
| Home | 

*   Moves focus to the first option.
*   In the example 1 single-select listboxes, also selects the focused option.

 |
| End | 

*   Moves focus to the last option.
*   In the example 1 single-select listboxes, also selects the focused option.

 |

### Multiple selection keys supported in example 2

#### Note

The selection behavior demonstrated differs from the behavior provided by browsers for native HTML `<select multiple>` elements. The HTML select element behavior is to alter selection with unmodified up/down arrow keys, requiring the use of modifier keys to select multiple options. This example demonstrates the multiple selection interaction model recommended in the [Keyboard Interaction section of the Listbox Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/listbox/#keyboard_interaction), which does not require the use of modifier keys.

| Key | Function |
| --- | --- |
| Space | changes the selection state of the focused option . |
| Shift + Down Arrow | Moves focus to and selects the next option. |
| Shift + Up Arrow | Moves focus to and selects the previous option. |
| Control + Shift + Home | Selects from the focused option to the beginning of the list. |
| Control + Shift + End | Selects from the focused option to the end of the list. |
| Control + A (All Platforms)  
Command-A (macOS) | Selects all options in the list. If all options are selected, unselects all options. |