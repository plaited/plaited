---
source: https://www.w3.org/WAI/ARIA/apg/patterns/combobox/

---
# Combobox Pattern

## About This Pattern

A  [combobox](https://w3c.github.io/aria/#combobox)  is an input widget with an associated popup that enables users to select a value for the combobox from a collection of possible values. In some implementations, the popup presents allowed values, while in other implementations, the popup presents suggested values, and users may either select one of the suggestions or type a value. The popup may be a  [listbox](listbox.md),  [grid](grid.md),  [tree](treeview.md), or  [dialog.](dialog-modal.md)  Many implementations also include a third optional element -- a graphical  Open  button adjacent to the combobox, which indicates availability of the popup. Activating the  Open  button displays the popup if suggestions are available.

The combobox pattern supports several optional behaviors. The one that most shapes interaction is text input. Some comboboxes allow users to type and edit text in the combobox and others do not. If a combobox does not support text input, it is referred to as select-only, meaning the only way users can set a value is by selecting a value in the popup. For example, in some browsers, an HTML  `select`  element with  `size="1"`  is presented to assistive technologies as a combobox. Alternatively, if a combobox supports text input, it is referred to as editable. An editable combobox may either allow users to input any arbitrary value, or it may restrict its value to a discrete set of allowed values, in which case typing input serves to filter suggestions presented in the popup.

The popup is hidden by default, i.e., the default state is collapsed. The conditions that trigger expansion -- display of the popup --are specific to each implementation. Some possible conditions that trigger expansion include:

-   It is displayed when the  Down Arrow  key is pressed or the  Open  button is activated. Optionally, if the combobox is editable and contains a string that does not match an allowed value, expansion does not occur.
-   It is displayed when the combobox receives focus even if the combobox is editable and empty.
-   If the combobox is editable, the popup is displayed only if a certain number of characters are typed in the combobox and those characters match some portion of one of the suggested values.

Combobox widgets are useful for acquiring user input in either of two scenarios:

1.  The value must be one of a predefined set of allowed values, e.g., a location field must contain a valid location name. Note that the listbox and menu button patterns are also useful in this scenario; differences between combobox and alternative patterns are described below.
2.  An arbitrary value is allowed, but it is advantageous to suggest possible values to users. For example, a search field may suggest similar or previous searches to save the user time.

The nature of possible values presented by a popup and the way they are presented is called the autocomplete behavior. Comboboxes can have one of four forms of autocomplete:

1.  **No autocomplete:**  The combobox is editable, and when the popup is triggered, the suggested values it contains are the same regardless of the characters typed in the combobox. For example, the popup suggests a set of recently entered values, and the suggestions do not change as the user types.
2.  **List autocomplete with manual selection:**  When the popup is triggered, it presents suggested values. If the combobox is editable, the suggested values complete or logically correspond to the characters typed in the combobox. The character string the user has typed will become the value of the combobox unless the user selects a value in the popup.
3.  **List autocomplete with automatic selection:**  The combobox is editable, and when the popup is triggered, it presents suggested values that complete or logically correspond to the characters typed in the combobox, and the first suggestion is automatically highlighted as selected. The automatically selected suggestion becomes the value of the combobox when the combobox loses focus unless the user chooses a different suggestion or changes the character string in the combobox.
4.  **List with inline autocomplete:**  This is the same as list with automatic selection with one additional feature. The portion of the selected suggestion that has not been typed by the user, a completion string, appears inline after the input cursor in the combobox. The inline completion string is visually highlighted and has a selected state.

If a combobox is editable and has any form of list autocomplete, the popup may appear and disappear as the user types. For example, if the user types a two character string that triggers five suggestions to be displayed but then types a third character that forms a string that does not have any matching suggestions, the popup may close and, if present, the inline completion string disappears.

Two other widgets that are also visually compact and enable users to make a single choice from a set of discrete choices are  [listbox](listbox.md)  and  [menu button](menu-button.md). One feature that distinguishes combobox from both listbox and menu button is that the user's choice can be presented as a value in an editable field, which gives users the ability to select some or all of the value for copying to the clipboard. Comboboxes and menu buttons can be implemented so users can explore the set of allowed choices without losing a previously made choice. That is, users can navigate the set of available choices in a combobox popup or menu and then press  escape, which closes the popup or menu without changing previous input. In contrast, navigating among options in a single-select listbox immediately changes its value, and  Escape  does not provide an undo mechanism. Comboboxes and listboxes can be marked as required with  `aria-required="true"`, and they have an accessible name that is distinct from their value. Thus, when assistive technology users focus either a combobox or listbox in its default state, they can perceive both a name and value for the widget. However, a menu button cannot be marked required, and while it has an accessible name, it does not have a value so is not suitable for conveying the user's choice in its collapsed state.

![](images/combobox.svg)

## Examples

-   [Select-Only Combobox](combobox-select-only.example.md): A single-select combobox with no text input that is functionally similar to an HTML  `select`  element.
-   [Editable Combobox with Both List and Inline Autocomplete](combobox-autocomplete-both.example.md): An editable combobox that demonstrates the autocomplete behavior known as  list with inline autocomplete.
-   [Editable Combobox with List Autocomplete](combobox-autocomplete-list.example.md): An editable combobox that demonstrates the autocomplete behavior known as  list with manual selection.
-   [Editable Combobox Without Autocomplete](combobox-autocomplete-none.example.md): An editable combobox that demonstrates the behavior associated with  `aria-autocomplete=none`.
-   [Editable Combobox with Grid Popup](grid-combo.example.md): An editable combobox that presents suggestions in a grid, enabling users to navigate descriptive information about each suggestion.
-   [Date Picker Combobox](combobox-datepicker.example.md): An editable date input combobox that opens a dialog containing a calendar grid and buttons for navigating by month and year.

## Keyboard Interaction

-   Tab: The combobox is in the page  Tab  sequence.
-   Note: The popup indicator icon or button (if present), the popup, and the popup descendants are excluded from the page  Tab  sequence.

### Combobox Keyboard Interaction

When focus is in the combobox:

-   Down Arrow: If the popup is available, moves focus into the popup:
    -   If the autocomplete behavior automatically selected a suggestion before  Down Arrow  was pressed, focus is placed on the suggestion following the automatically selected suggestion.
    -   Otherwise, places focus on the first focusable element in the popup.
-   Up Arrow  (Optional): If the popup is available, places focus on the last focusable element in the popup.
-   Escape: Dismisses the popup if it is visible. Optionally, if the popup is hidden before  Escape  is pressed, clears the combobox.
-   Enter: If the combobox is editable and an autocomplete suggestion is selected in the popup, accepts the suggestion either by placing the input cursor at the end of the accepted value in the combobox or by performing a default action on the value. For example, in a messaging application, the default action may be to add the accepted value to a list of message recipients and then clear the combobox so the user can add another recipient.
-   Printable Characters:
    -   If the combobox is editable, type characters in the combobox. Note that some implementations may regard certain characters as invalid and prevent their input.
    -   If the combobox is not editable, optionally moves focus to a value that starts with the typed characters.
-   If the combobox is editable, it supports standard single line text editing keys appropriate for the device platform (see note below).
-   Alt + Down Arrow  (Optional): If the popup is available but not displayed, displays the popup without moving focus.
-   Alt + Up Arrow  (Optional): If the popup is displayed:
    -   If the popup contains focus, returns focus to the combobox.
    -   Closes the popup.

#### Note

Standard single line text editing keys appropriate for the device platform:

1.  include keys for input, cursor movement, selection, and text manipulation.
2.  Standard key assignments for editing functions depend on the device operating system.
3.  The most robust approach for providing text editing functions is to rely on browsers, which supply them for HTML inputs with type text and for elements with the  `contenteditable`  HTML attribute.
4.  **IMPORTANT:**  Ensure JavaScript does not interfere with browser-provided text editing functions by capturing key events for the keys used to perform them.

### Listbox Popup Keyboard Interaction

When focus is in a listbox popup:

-   Enter: Accepts the focused option in the listbox by closing the popup, placing the accepted value in the combobox, and if the combobox is editable, placing the input cursor at the end of the value.
-   Escape: Closes the popup and returns focus to the combobox. Optionally, if the combobox is editable, clears the contents of the combobox.
-   Down Arrow: Moves focus to and selects the next option. If focus is on the last option, either returns focus to the combobox or does nothing.
-   Up Arrow: Moves focus to and selects the previous option. If focus is on the first option, either returns focus to the combobox or does nothing.
-   Right Arrow: If the combobox is editable, returns focus to the combobox without closing the popup and moves the input cursor one character to the right. If the input cursor is on the right-most character, the cursor does not move.
-   Left Arrow: If the combobox is editable, returns focus to the combobox without closing the popup and moves the input cursor one character to the left. If the input cursor is on the left-most character, the cursor does not move.
-   Home  (Optional): Either moves focus to and selects the first option or, if the combobox is editable, returns focus to the combobox and places the cursor on the first character.
-   End  (Optional): Either moves focus to the last option or, if the combobox is editable, returns focus to the combobox and places the cursor after the last character.
-   Any printable character:
    -   If the combobox is editable, returns the focus to the combobox without closing the popup and types the character.
    -   Otherwise, moves focus to the next option with a name that starts with the characters typed.
-   Backspace  (Optional): If the combobox is editable, returns focus to the combobox and deletes the character prior to the cursor.
-   Delete  (Optional): If the combobox is editable, returns focus to the combobox, removes the selected state if a suggestion was selected, and removes the inline autocomplete string if present.

#### Note

1.  DOM Focus is maintained on the combobox and the assistive technology focus is moved within the listbox using  `aria-activedescendant`  as described in  [Managing Focus in Composites Using aria-activedescendant](keyboard-interface.md#kbd_focus_activedescendant).
2.  Selection follows focus in the listbox; the listbox allows only one suggested value to be selected at a time for the combobox value.

### Grid Popup Keyboard Interaction

In a grid popup, each suggested value may be represented by either a single cell or an entire row. See notes below for how this aspect of grid design effects the keyboard interaction design and the way that selection moves in response to focus movements.

-   Enter: Accepts the currently selected suggested value by closing the popup, placing the selected value in the combobox, and if the combobox is editable, placing the input cursor at the end of the value.
-   Escape: Closes the popup and returns focus to the combobox. Optionally, if the combobox is editable, clears the contents of the combobox.
-   Right Arrow: Moves focus one cell to the right. Optionally, if focus is on the right-most cell in the row, focus may move to the first cell in the following row. If focus is on the last cell in the grid, either does nothing or returns focus to the combobox.
-   Left Arrow: Moves focus one cell to the left. Optionally, if focus is on the left-most cell in the row, focus may move to the last cell in the previous row. If focus is on the first cell in the grid, either does nothing or returns focus to the combobox.
-   Down Arrow: Moves focus one cell down. If focus is in the last row of the grid, either does nothing or returns focus to the combobox.
-   Up Arrow: Moves focus one cell up. If focus is in the first row of the grid, either does nothing or returns focus to the combobox.
-   Page Down  (Optional): Moves focus down an author-determined number of rows, typically scrolling so the bottom row in the currently visible set of rows becomes one of the first visible rows. If focus is in the last row of the grid, focus does not move.
-   Page Up  (Optional): Moves focus up an author-determined number of rows, typically scrolling so the top row in the currently visible set of rows becomes one of the last visible rows. If focus is in the first row of the grid, focus does not move.
-   Home  (Optional):  **Either:**
    -   Moves focus to the first cell in the row that contains focus. Or, if the grid has fewer than three cells per row or multiple suggested values per row, focus may move to the first cell in the grid.
    -   If the combobox is editable, returns focus to the combobox and places the cursor on the first character.
-   End  (Optional):  **Either:**
    -   Moves focus to the last cell in the row that contains focus. Or, if the grid has fewer than three cells per row or multiple suggested values per row, focus may move to the last cell in the grid.
    -   If the combobox is editable, returns focus to the combobox and places the cursor after the last character.
-   Control + Home  (optional): moves focus to the first row.
-   Control + End  (Optional): moves focus to the last row.
-   Any printable character: If the combobox is editable, returns the focus to the combobox without closing the popup and types the character.
-   Backspace  (Optional): If the combobox is editable, returns focus to the combobox and deletes the character prior to the cursor.
-   Delete  (Optional): If the combobox is editable, returns focus to the combobox, removes the selected state if a suggestion was selected, and removes the inline autocomplete string if present.

#### Note

1.  DOM Focus is maintained on the combobox and the assistive technology focus is moved within the grid using  `aria-activedescendant`  as described in  [Managing Focus in Composites Using aria-activedescendant](keyboard-interface.md#kbd_focus_activedescendant).
2.  The grid allows only one suggested value to be selected at a time for the combobox value.
3.  In a grid popup, each suggested value may be represented by either a single cell or an entire row. This aspect of design effects focus and selection movement:
    1.  If every cell contains a different suggested value:
        -   Selection follows focus so that the cell containing focus is selected.
        -   Horizontal arrow key navigation typically wraps from one row to another.
        -   Vertical arrow key navigation typically wraps from one column to another.
    2.  If all cells in a row contain information about the same suggested value:
        -   Either the row containing focus is selected or a cell containing a suggested value is selected when any cell in the same row contains focus.
        -   Horizontal key navigation may wrap from one row to another.
        -   Vertical arrow key navigation  **does not**  wrap from one column to another.

### Tree Popup Keyboard Interaction

In some implementations of tree popups, some or all parent nodes may serve as suggestion category labels so may not be selectable values. See notes below for how this aspect of the design effects the way selection moves in response to focus movements.

When focus is in a vertically oriented tree popup:

-   Enter: Accepts the currently selected suggested value by closing the popup, placing the selected value in the combobox, and if the combobox is editable, placing the input cursor at the end of the value.
-   Escape: Closes the popup and returns focus to the combobox. Optionally, clears the contents of the combobox.
-   Right arrow:
    -   When focus is on a closed node, opens the node; focus and selection do not move.
    -   When focus is on a open node, moves focus to the first child node and selects it if it is selectable.
    -   When focus is on an end node, does nothing.
-   Left arrow:
    -   When focus is on an open node, closes the node.
    -   When focus is on a child node that is also either an end node or a closed node, moves focus to its parent node and selects it if it is selectable.
    -   When focus is on a root node that is also either an end node or a closed node, does nothing.
-   Down Arrow: Moves focus to the next node that is focusable without opening or closing a node and selects it if it is selectable.
-   Up Arrow: Moves focus to the previous node that is focusable without opening or closing a node and selects it if it is selectable.
-   Home: Moves focus to the first focusable node in the tree without opening or closing a node and selects it if it is selectable.
-   End: Moves focus to the last focusable node in the tree without opening or closing a node and selects it if it is selectable.
-   Any printable character:
    -   If the combobox is editable, returns the focus to the combobox without closing the popup and types the character.
    -   Otherwise, moves focus to the next suggested value with a name that starts with the characters typed.

#### Note

1.  DOM Focus is maintained on the combobox and the assistive technology focus is moved within the tree using  `aria-activedescendant`  as described in  [Managing Focus in Composites Using aria-activedescendant](keyboard-interface.md#kbd_focus_activedescendant).
2.  The tree allows only one suggested value to be selected at a time for the combobox value.
3.  In a tree popup, some or all parent nodes may not be selectable values; they may serve as category labels for suggested values. If focus moves to a node that is not a selectable value, either:
    -   The previously selected node, if any, remains selected until focus moves to a node that is selectable.
    -   There is no selected value.
    -   In either case, focus is visually distinct from selection so users can readily see if a value is selected or not.
4.  If nodes in the tree are arranged horizontally ([aria-orientation](https://w3c.github.io/aria/#aria-orientation)  is set to  `horizontal`):
    1.  Down Arrow  performs as  Right Arrow  is described above, and vice versa.
    2.  Up Arrow  performs as  Left Arrow  is described above, and vice versa.

### Dialog Popup Keyboard Interaction

When focus is in a dialog popup:

-   There are two ways to close the popup and return focus to the combobox:
    1.  Perform an action in the dialog, such as activate a button, that specifies a value for the combobox.
    2.  Cancel out of the dialog, e.g., press  Escape  or activate the cancel button in the dialog. Canceling either returns focus to the text box without changing the combobox value or returns focus to the combobox and clears the combobox.
-   The dialog implements the keyboard interaction defined in the  [modal dialog pattern.](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)

#### Note

Unlike other combobox popups, dialogs do not support  `aria-activedescendant`  so DOM focus moves into the dialog from the combobox.

## WAI-ARIA Roles, States, and Properties

-   The element that serves as an input and displays the combobox value has role  [combobox](https://w3c.github.io/aria/#combobox).
-   The combobox element has  [aria-controls](https://w3c.github.io/aria/#aria-controls)  set to a value that refers to the element that serves as the popup. Note that  `aria-controls`  only needs to be set when the popup is visible. However, it is valid to reference an element that is not visible.
-   The popup is an element that has role  [listbox](https://w3c.github.io/aria/#listbox),  [tree](https://w3c.github.io/aria/#tree),  [grid](https://w3c.github.io/aria/#grid), or  [dialog](https://w3c.github.io/aria/#dialog).
-   If the popup has a role other than  `listbox`, the element with role  `combobox`  has  [aria-haspopup](https://w3c.github.io/aria/#aria-haspopup)  set to a value that corresponds to the popup type. That is,  `aria-haspopup`  is set to  `grid`,  `tree`, or  `dialog`. Note that elements with role  `combobox`  have an implicit  `aria-haspopup`  value of  `listbox`.
-   When the combobox popup is not visible, the element with role  `combobox`  has  [aria-expanded](https://w3c.github.io/aria/#aria-expanded)  set to  `false`. When the popup element is visible,  `aria-expanded`  is set to  `true`. Note that elements with role  `combobox`  have a default value for  `aria-expanded`  of  `false`.
-   When a combobox receives focus, DOM focus is placed on the combobox element.
-   When a descendant of a listbox, grid, or tree popup is focused, DOM focus remains on the combobox and the combobox has  [aria-activedescendant](https://w3c.github.io/aria/#aria-activedescendant)  set to a value that refers to the focused element within the popup.
-   For a combobox that controls a listbox, grid, or tree popup, when a suggested value is visually indicated as the currently selected value, the  `option`,  `gridcell`,  `row`, or  `treeitem`  containing that value has  [aria-selected](https://w3c.github.io/aria/#aria-selected)  set to  `true`.
-   If the combobox has a visible label and the combobox element is an HTML element that can be labelled using the HTML  `label`  element (e.g., the  `input`  element), it is labeled using the  `label`  element. Otherwise, if it has a visible label, the combobox element has  [aria-labelledby](https://w3c.github.io/aria/#aria-labelledby)  set to a value that refers to the labelling element. Otherwise, the combobox element has a label provided by  [aria-label](https://w3c.github.io/aria/#aria-label).
-   The combobox element has  [aria-autocomplete](https://w3c.github.io/aria/#aria-autocomplete)  set to a value that corresponds to its autocomplete behavior:
    -   `none`: When the popup is displayed, the suggested values it contains are the same regardless of the characters typed in the combobox.
    -   `list`: When the popup is triggered, it presents suggested values. If the combobox is editable, the values complete or logically correspond to the characters typed in the combobox.
    -   `both`: When the popup is triggered, it presents suggested values that complete or logically correspond to the characters typed in the combobox. In addition, the portion of the selected suggestion that has not been typed by the user, known as the  completion string, appears inline after the input cursor in the combobox. The inline completion string is visually highlighted and has a selected state.

### Note

1.  In ARIA 1.0, the combobox referenced its popup with  [aria-owns](https://w3c.github.io/aria/#aria-owns)  instead of  [aria-controls](https://w3c.github.io/aria/#aria-controls). While user agents might support comboboxes with  [aria-owns](https://w3c.github.io/aria/#aria-owns)  for backwards compatibility with legacy content, it is strongly recommended that authors use  [aria-controls](https://w3c.github.io/aria/#aria-controls).
2.  When referring to the roles, states, and properties documentation for the below list of patterns used for popups, keep in mind that a combobox is a single-select widget where selection follows focus in the popup.
3.  The roles, states, and properties for popup elements are defined in their respective design patterns:
    -   [Listbox Roles, States, and Properties](https://www.w3.org/WAI/ARIA/apg/patterns/listbox/#roles_states_properties)
    -   [Grid Roles, States, and Properties](https://www.w3.org/WAI/ARIA/apg/patterns/grid/#roles_states_properties)
    -   [Tree Roles, States, and Properties](https://www.w3.org/WAI/ARIA/apg/patterns/treeview/#roles_states_properties)
    -   [Dialog Roles, States, and Properties](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/#roles_states_properties)

