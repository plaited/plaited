---
source: https://www.w3.org/WAI/ARIA/apg/patterns/combobox/examples/combobox-datepicker/
---
Date Picker Combobox Example
============================

Keyboard Support
----------------

### Combobox

| Key | Function |
| --- | --- |
| Down Arrow,  
ALT + Down Arrow | 
*   Open the date picker dialog.
*   If the combobox contains a valid date, moves focus to that date in the calendar grid. Otherwise, moves focus to current date, i.e., today's date.

 |

### Date Picker Dialog

| Key | Function |
| --- | --- |
| ESC | Closes the dialog and moves focus to the combobox. |
| TAB | 
*   Moves focus to next element in the dialog Tab sequence.
*   Note that, as specified in the [Grid Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/), only one element in the calendar grid is in the Tab sequence.
*   If focus is on the last button (i.e., "OK"), moves focus to the first button (i.e. "Previous Year").

 |
| Shift + TAB | 

*   Moves focus to previous element in the dialog Tab sequence.
*   Note that, as specified in the [Grid Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/), only one element in the calendar grid is in the Tab sequence.
*   If focus is on the first button (i.e., "Previous Year"), moves focus to the last button (i.e. "OK").

 |

### Date Picker Dialog: Calendar Buttons

| Key | Function |
| --- | --- |
| Space,  
Enter | Change the month and/or year displayed in the calendar grid. |

### Date Picker Dialog: Date Grid

| Key | Function |
| --- | --- |
| Space | 
*   Selects the date.
*   Updates the value of the `combobox` with the selected date.

 |
| Enter | 

*   Selects the date.
*   Updates the value of the `combobox` with the selected date.
*   Closes the dialog and moves focus to the `combobox`.

 |
| Up Arrow | Moves focus to the same day of the previous week. |
| Down Arrow | Moves focus to the same day of the next week. |
| Right Arrow | Moves focus to the next day. |
| Left Arrow | Moves focus to the previous day. |
| Home | Moves focus to the first day (e.g. Sunday) of the current week. |
| End | Moves focus to the last day (e.g. Saturday) of the current week. |
| PageUp | 

*   Changes the grid of dates to the previous month.
*   Moves focus to the day of the month that has the same number. If that day does not exist, moves focus to the last day of the month.

 |
| Shift+  
PageUp | 

*   Changes the grid of dates to the same month in the previous year.
*   Moves focus to the day of the month that has the same number. If that day does not exist, moves focus to the last day of the month.

 |
| PageDown | 

*   Changes the grid of dates to the next month.
*   Moves focus to the day of the month that has the same number. If that day does not exist, moves focus to the last day of the month.

 |
| Shift+  
PageDown | 

*   Changes the grid of dates to the same month in the next year.
*   Moves focus to the day of the month that has the same number. If that day does not exist, moves focus to the last day of the month.

 |

### Date Picker Dialog: OK and Cancel Buttons

| Key | Function |
| --- | --- |
| Space,  
Enter | Activates the button:
*   "Cancel": Closes the dialog, moves focus to combobox, does not update combobox value.
*   "OK": Closes the dialog, moves focus to combobox, updates date in combobox.

 |