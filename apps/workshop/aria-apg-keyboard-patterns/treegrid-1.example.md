---
source: https://www.w3.org/WAI/ARIA/apg/patterns/treegrid/examples/treegrid-1/
---
Treegrid Email Inbox Example
============================

Keyboard Support
----------------

**NOTE:** The following table includes descriptions of how keyboard commands move focus among cells and rows in the treegrid implementation on this page. In the example on this page, some cells contain a single focusable widget, and if a cell contains a widget, the cell is not focusable; the widget receives focus instead of the cell. So, when a keyboard command description says a command moves focus to a cell, the command may either focus the cell or a widget inside the cell.

| Key | Function |
| --- | --- |
| Right Arrow | 
*   If a row is focused, and it is collapsed, expands the current row.
*   If a row is focused, and it is expanded, focuses the first cell in the row.
*   If a cell is focused, moves one cell to the right.
*   If focus is on the right most cell, focus does not move.

 |
| Left Arrow | 

*   If a row is focused, and it is expanded, collapses the current row.
*   If a row is focused, and it is collapsed, moves to the parent row (if there is one).
*   If a cell in the first column is focused, focuses the row.
*   If a cell in a different column is focused, moves focus one cell to the left.

 |
| Down Arrow | 

*   Moves focus one row or one cell down, depending on whether a row or cell is currently focused.
*   If focus is on the bottom row, focus does not move.

 |
| Up Arrow | 

*   Moves focus one row or one cell up, depending on whether a row or cell is currently focused.
*   If focus is on the top row, focus does not move.

 |
| Tab | 

*   Moves focus to the next interactive widget in the current row.
*   If there are no more interactive widgets in the current row, moves focus out of the treegrid.

 |
| Shift + Tab | 

*   If a cell is focused, moves focus to the previous interactive widget in the current row.
*   If a row is focused, moves focus out of the treegrid.

 |
| Home | 

*   If a row is focused, moves to the first row.
*   If a cell is focused, moves focus to the first cell in the row containing focus.

 |
| End | 

*   If a row is focused, moves to the last row.
*   If a cell is focused, moves focus to the last cell in the row containing focus.

 |
| Control + Home | 

*   If a row has focus, moves focus to the first row.
*   If a cell has focus, moves focus to the cell in the first row in the same column as the cell that had focus.

 |
| Control + End | 

*   If a row has focus, moves focus to the last row.
*   If a cell has focus, moves focus to the cell in the last row in the same column as the cell that had focus.

 |
| Enter | 

*   Performs default action associated with row or cell that has focus, e.g. opens message or navigate to link.
*   If focus is on the cell with the expand/collapse button, and there is no other action, will toggle expansion of the current row.

 |