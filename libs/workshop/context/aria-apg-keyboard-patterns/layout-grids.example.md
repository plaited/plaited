---
source: https://www.w3.org/WAI/ARIA/apg/patterns/grid/examples/layout-grids/
---
Layout Grid Examples
====================

Keyboard Support
----------------

**NOTE:** The following table describes keyboard commands that move focus among grid cells. In the examples on this page, some cells contain a single focusable widget, and if a cell contains a widget, the cell is not focusable; the widget receives focus instead of the cell. So, when a description says a command moves focus to a cell, the command may either focus the cell or a widget inside the cell.

| Key | Function |
| --- | --- |
| Right Arrow | 
*   Moves focus one cell to the right.
*   When focus is on the right-most cell in the row, focus moves to the first cell in the following row.
*   If focus is on the last cell in the grid, focus does not move.

 |
| Left Arrow | 

*   Moves focus one cell to the left.
*   When focus is on the left-most cell in the row, focus moves to the last cell in the previous row.
*   If focus is on the first cell in the grid, focus does not move.

 |
| Down Arrow | 

*   Moves focus to the next logical row.
*   In examples 2 and 3, if focus is in the last logical row, focus does not move.
*   In example 1, since there is only one logical row and since all elements are logically equivalent, focus moves to the next cell but does not move if it is in the last cell of the grid.

 |
| Up Arrow | 

*   Moves focus to the previous logical row.
*   In examples 2 and 3, if focus is in the first logical row, focus does not move.
*   In example 1, since there is only one logical row and since all elements are logically equivalent, focus moves to the previous cell but does not move if it is in the first cell of the grid.

 |
| Page Down (Example 3) | 

*   Moves focus down five rows, scrolling so the bottom row in the currently visible set of rows becomes the first visible row.
*   If focus is in the last row, focus does not move.

 |
| Page Up (Example 3) | 

*   Moves focus up 5 rows, scrolling so the top row in the currently visible set of rows becomes the last visible row.
*   If focus is in the first row, focus does not move.

 |
| Home | Moves focus to the first cell in the row that contains focus. |
| End | Moves focus to the last cell in the row that contains focus. |
| Control + Home | Moves focus to the first cell in the first row. |
| Control + End | Moves focus to the last cell in the last row. |