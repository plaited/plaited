---
source: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/examples/datepicker-dialog/
---
Date Picker Dialog Example
==========================

Keyboard Support
----------------

### Choose Date Button

| Key | Function |
| --- | --- |
| Space,  
Enter | 
*   Open the date picker dialog.
*   Move focus to selected date, i.e., the date displayed in the date input text field. If no date has been selected, places focus on the current date.

 |

### Date Picker Dialog

| Key | Function |
| --- | --- |
| ESC | Closes the dialog and returns focus to the "Choose Date" button. |
| Tab | 
*   Moves focus to next element in the dialog Tab sequence.
*   Note that, as specified in the [Grid Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/), only one button in the calendar grid is in the Tab sequence.
*   If focus is on the last button (i.e., "OK"), moves focus to the first button (i.e. "Previous Year").

 |
| Shift + Tab | 

*   Moves focus to previous element in the dialog Tab sequence.
*   Note that, as specified in the [Grid Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/), only one button in the calendar grid is in the Tab sequence.
*   If focus is on the first button (i.e., "Previous Year"), moves focus to the last button (i.e. "OK").

 |

### Date Picker Dialog: Month/Year Buttons

| Key | Function |
| --- | --- |
| Space,  
Enter | Change the month and/or year displayed in the calendar grid. |

### Date Picker Dialog: Date Grid

| Key | Function |
| --- | --- |
| Space,  
Enter | 
*   Select the date, close the dialog, and move focus to the "Choose Date" button.
*   Update the value of the "Date" input with the selected date.
*   Update the accessible name of the "Choose Date" button to include the selected date.

 |
| Up Arrow | Moves focus to the same day of the previous week. |
| Down Arrow | Moves focus to the same day of the next week. |
| Right Arrow | Moves focus to the next day. |
| Left Arrow | Moves focus to the previous day. |
| Home | Moves focus to the first day (e.g Sunday) of the current week. |
| End | Moves focus to the last day (e.g. Saturday) of the current week. |
| Page Up | 

*   Changes the grid of dates to the previous month.
*   Sets focus on the same day of the same week. If that day does not exist, then moves focus to the same day of the previous or next week.

 |
| Shift + Page Up | 

*   Changes the grid of dates to the previous Year.
*   Sets focus on the same day of the same week. If that day does not exist, then moves focus to the same day of the previous or next week.

 |
| Page Down | 

*   Changes the grid of dates to the next month.
*   Sets focus on the same day of the same week. If that day does not exist, then moves focus to the same day of the previous or next week.

 |
| Shift + Page Down | 

*   Changes the grid of dates to the next Year.
*   Sets focus on the same day of the same week. If that day does not exist, then moves focus to the same day of the previous or next week.

 |

### Date Picker Dialog: OK and Cancel Buttons

| Key | Function |
| --- | --- |
| Space,  
Enter | Activates the button:
*   "Cancel": Closes the dialog, moves focus to "Choose Date" button, does not update date in date input.
*   "OK": Closes the dialog, moves focus to "Choose Date" button, updates date in date input, updates accessible name of the "Choose Date" button to include the selected date.

 |