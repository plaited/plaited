---
source: https://www.w3.org/WAI/ARIA/apg/patterns/treegrid/

---
# Treegrid Pattern

## About This Pattern

A  [treegrid](https://w3c.github.io/aria/#treegrid)  widget presents a hierarchical data grid consisting of tabular information that is editable or interactive. Any row in the hierarchy may have child rows, and rows with children may be expanded or collapsed to show or hide the children. For example, in a  `treegrid`  used to display messages and message responses for a e-mail discussion list, messages with responses would be in rows that can be expanded to reveal the response messages.

In a treegrid both rows and cells are focusable. Every row and cell contains a focusable element or is itself focusable, regardless of whether individual cell content is editable or interactive. There is one exception: if column header cells do not provide functions, such as sort or filter, they do not need to be focusable. One reason it is important for all cells to be able to receive or contain keyboard focus is that screen readers will typically be in their application reading mode, rather than their document reading mode, when users are interacting with the grid. While in application mode, a screen reader user hears only focusable elements and content that labels focusable elements. So, screen reader users may unknowingly overlook elements contained in a  `treegrid`  that are either not focusable or not used to label a column or row.

When using a keyboard to navigate a  `treegrid`, a visual keyboard indicator informs users which row or cell is focused. If the  `treegrid`  allows users to choose just one item for an action, then it is known as a single-select  `treegrid`, and the item with focus also has a selected state. However, in a multi-select  `treegrid`, which enables users to select more than one row or cell for an action, the selected state is independent of the focus. For example, in a hierarchical e-mail discussion grid, users can move focus to select any number of rows for an action, such as delete or move. It is important that the visual design distinguish between items that are selected and the item that has focus. For more details, see  [this description of differences between focus and selection](keyboard-interface.md#kbd_focus_vs_selection).

![](images/treegrid.svg)

## Example

[E-mail Inbox  `treegrid`  Example](treegrid-1.example.md): A treegrid for navigating an e-mail inbox that demonstrates three keyboard navigation models -- rows first, cells first, and cells only.

## Keyboard Interaction

The following keys provide  `treegrid`  navigation by moving focus among rows and cells of the grid. Implementations of  `treegrid`  make these key commands available when an element in the grid has received focus, e.g., after a user has moved focus to the grid with  Tab. Moving focus into the grid may result in the first cell or the first row being focused. Whether focus goes to a cell or the row depends on author preferences and whether row focus is supported, since some implementations of  `treegrid`  may not provide focus to rows.

-   Enter: If cell-only focus is enabled and focus is on the first cell with the  `aria-expanded`  property, opens or closes the child rows.,Otherwise, performs the default action for the cell.
-   Tab: If the row containing focus contains focusable elements (e.g., inputs, buttons, links, etc.), moves focus to the next input in the row. If focus is on the last focusable element in the row, moves focus out of the  `treegrid`  widget to the next focusable element.
-   Right Arrow:
    -   If focus is on a collapsed row, expands the row.
    -   If focus is on an expanded row or is on a row that does not have child rows, moves focus to the first cell in the row.
    -   If focus is on the right-most cell in a row, focus does not move.
    -   If focus is on any other cell, moves focus one cell to the right.
-   Left Arrow:
    -   If focus is on an expanded row, collapses the row.
    -   If focus is on a collapsed row or on a row that does not have child rows, focus does not move.
    -   If focus is on the first cell in a row and row focus is supported, moves focus to the row.
    -   If focus is on the first cell in a row and row focus is not supported, focus does not move.
    -   If focus is on any other cell, moves focus one cell to the left.
-   Down Arrow:
    -   If focus is on a row, moves focus one row down. If focus is on the last row, focus does not move.
    -   If focus is on a cell, moves focus one cell down. If focus is on the bottom cell in the column, focus does not move.
-   Up Arrow:
    -   If focus is on a row, moves focus one row up. If focus is on the first row, focus does not move.
    -   If focus is on a cell, moves focus one cell up. If focus is on the top cell in the column, focus does not move.
-   Page Down:
    -   If focus is on a row, moves focus down an author-determined number of rows, typically scrolling so the bottom row in the currently visible set of rows becomes one of the first visible rows. If focus is in the last row, focus does not move.
    -   If focus is on a cell, moves focus down an author-determined number of cells, typically scrolling so the bottom row in the currently visible set of rows becomes one of the first visible rows. If focus is in the last row, focus does not move.
-   Page Up:
    -   If focus is on a row, moves focus up an author-determined number of rows, typically scrolling so the top row in the currently visible set of rows becomes one of the last visible rows. If focus is in the first row, focus does not move.
    -   If focus is on a cell, moves focus up an author-determined number of cells, typically scrolling so the top row in the currently visible set of rows becomes one of the last visible rows. If focus is in the first row, focus does not move.
-   Home:
    -   If focus is on a row, moves focus to the first row. If focus is in the first row, focus does not move.
    -   If focus is on a cell, moves focus to the first cell in the row. If focus is in the first cell of the row, focus does not move.
-   End:
    -   If focus is on a row, moves focus to the last row. If focus is in the last row, focus does not move.
    -   If focus is on a cell, moves focus to the last cell in the row. If focus is in the last cell of the row, focus does not move.
-   Control + Home:
    -   If focus is on a row, moves focus to the first row. If focus is in the first row, focus does not move.
    -   If focus is on a cell, moves focus to the first cell in the column. If focus is in the first row, focus does not move.
-   Control + End:
    -   If focus is on a row, moves focus to the last row. If focus is in the last row, focus does not move.
    -   If focus is on a cell, moves focus to the last cell in the column. If focus is in the last row, focus does not move.

### Note

-   When the above  `treegrid`  navigation keys move focus, whether the focus is set on an element inside the cell or on the cell depends on cell content. See  [Whether to Focus on a Cell or an Element Inside It](grid.md#gridNav_focus).
-   While navigation keys, such as arrow keys, are moving focus from cell to cell, they are not available to do something like operate a combobox or move an editing caret inside of a cell. If this functionality is needed, see  [Editing and Navigating Inside a Cell](grid.md#gridNav_inside).
-   If navigation functions can dynamically add more rows or columns to the DOM, key events that move focus to the beginning or end of the grid, such as  control + End, may move focus to the last row in the DOM rather than the last available row in the back-end data.

If a treegrid supports selection of cells, rows, or columns, the following keys are commonly used for these functions.

-   Control + Space:
    -   If focus is on a row, selects all cells.
    -   If focus is on a cell, selects the column that contains the focus.
-   Shift + Space:
    -   If focus is on a row, selects the row.
    -   If focus is on a cell, selects the row that contains the focus. If the treegrid includes a column with checkboxes for selecting rows, this key can serve as a shortcut for checking the box when focus is not on the checkbox.
-   Control + A: Selects all cells.
-   Shift + Right Arrow:
    -   If focus is on a row, does not change selection.
    -   if focus is on a cell, extends selection one cell to the right.
-   Shift + Left Arrow:
    -   If focus is on a row, does not change selection.
    -   if focus is on a cell, extends selection one cell to the left.
-   Shift + Down Arrow:
    -   If focus is on a row, extends selection to all the cells in the next row.
    -   If focus is on a cell, extends selection one cell down.
-   Shift + Up Arrow:
    -   If focus is on a row, extends selection to all the cells in the previous row.
    -   If focus is on a cell, extends selection one cell up.

### Note

See  [Key Assignment Conventions for Common Functions](keyboard-interface.md#kbd_common_conventions)  for cut, copy, and paste key assignments.

## WAI-ARIA Roles, States, and Properties

-   The treegrid container has role  [treegrid](https://w3c.github.io/aria/#treegrid).
-   Each row container has role  [row](https://w3c.github.io/aria/#row)  and is either a DOM descendant of or owned by the  `treegrid`  element or an element with role  [rowgroup](https://w3c.github.io/aria/#rowgroup).
-   Each cell is either a DOM descendant of or owned by a  `row`  element and has one of the following roles:
    -   [columnheader](https://w3c.github.io/aria/#columnheader)  if the cell contains a title or header information for the column.
    -   [rowheader](https://w3c.github.io/aria/#rowheader)  if the cell contains title or header information for the row.
    -   [gridcell](https://w3c.github.io/aria/#gridcell)  if the cell does not contain column or row header information.
-   A  `row`  that can be expanded or collapsed to show or hide a set of child rows is a parent row. Each parent  `row`  has the  [aria-expanded](https://w3c.github.io/aria/#aria-expanded)  state set on either the  `row`  element or on a cell contained in the`row`. The  `aria-expanded`  state is set to  `false`  when the child rows are not displayed and set to  `true`  when the child rows are displayed. Rows that do not control display of child rows do not have the  `aria-expanded`  attribute because, if they were to have it, they would be incorrectly described to assistive technologies as parent rows.
-   If the treegrid supports selection of more than one row or cell, it is a multi-select treegrid and the element with role  `treegrid`  has  [aria-multiselectable](https://w3c.github.io/aria/#aria-multiselectable)  set to  `true`. Otherwise, it is a single-select treegrid, and  `aria-multiselectable`  is either set to  `false`  or the default value of  `false`  is implied.
-   If the treegrid is a single-select treegrid,  [aria-selected](https://w3c.github.io/aria/#aria-selected)  is set to  `true`  on the selected row or cell, and it is not present on any other row or cell in the treegrid.
-   if the treegrid is a multi-select treegrid:
    -   All selected rows or cells have  [aria-selected](https://w3c.github.io/aria/#aria-selected)  set to  `true`.
    -   All rows and cells that are not selected have  [aria-selected](https://w3c.github.io/aria/#aria-selected)  set to  `false`.
-   If there is an element in the user interface that serves as a label for the treegrid,  [aria-labelledby](https://w3c.github.io/aria/#aria-labelledby)  is set on the grid element with a value that refers to the labelling element. Otherwise, a label is specified for the grid element using  [aria-label](https://w3c.github.io/aria/#aria-label).
-   If the treegrid has a caption or description,  [aria-describedby](https://w3c.github.io/aria/#aria-describedby)  is set on the grid element with a value referring to the element containing the description.
-   If the treegrid provides sort functions,  [aria-sort](https://w3c.github.io/aria/#aria-sort)  is set to an appropriate value on the header cell element for the sorted column or row as described in the  [Grid and Table Properties Practice](https://www.w3.org/WAI/ARIA/apg/practices/grid-and-table-properties/#gridAndTableProperties_sort).
-   If the treegrid provides content editing functionality and contains cells that may have edit capabilities disabled in certain conditions,  [aria-readonly](https://w3c.github.io/aria/#aria-readonly)  is set to  `true`  on cells where editing is disabled. If edit functions are disabled for all cells, instead of setting  `aria-readonly`  to  `true`  on every cell,  `aria-readonly`  may be set to  `true`  on the  `treegrid`  element. Treegrids that do not provide cell content editing functions do not include the  `aria-readonly`  attribute on any of their elements.
-   If there are conditions where some rows or columns are hidden or not present in the DOM, e.g., data is dynamically loaded when scrolling or the treegrid provides functions for hiding rows or columns, the following properties are applied as described in the  [Grid and Table Properties Practice](https://www.w3.org/WAI/ARIA/apg/practices/grid-and-table-properties/).
    -   [aria-colcount](https://w3c.github.io/aria/#aria-colcount)  or  [aria-rowcount](https://w3c.github.io/aria/#aria-rowcount)  is set to the total number of columns or rows, respectively.
    -   [aria-colindex](https://w3c.github.io/aria/#aria-colindex)  or  [aria-rowindex](https://w3c.github.io/aria/#aria-rowindex)  is set to the position of a cell within a row or column, respectively.
-   If the treegrid includes cells that span multiple rows or multiple columns, and if the  `treegrid`  role is NOT applied to an HTML  `table`  element, then  [aria-rowspan](https://w3c.github.io/aria/#aria-rowspan)  or  [aria-colspan](https://w3c.github.io/aria/#aria-colspan)  is applied as described in the  [Grid and Table Properties Practice](https://www.w3.org/WAI/ARIA/apg/practices/grid-and-table-properties/#gridAndTableProperties_spans).

### Note

-   A  `treegrid`  built from an HTML  `table`  that includes cells that span multiple rows or columns must use HTML  `rowspan`  and  `colspan`  and must not use  `aria-rowspan`  or  `aria-colspan`.
-   If rows or cells are included in a treegrid via  [aria-owns](https://w3c.github.io/aria/#aria-owns), they will be presented to assistive technologies after the DOM descendants of the  `treegrid`  element unless the DOM descendants are also included in the  `aria-owns`  attribute.

