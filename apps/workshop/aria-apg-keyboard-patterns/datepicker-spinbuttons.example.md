---
source: https://www.w3.org/WAI/ARIA/apg/patterns/spinbutton/examples/datepicker-spinbuttons/
---
Date Picker Spin Button Example
===============================

Keyboard Support
----------------

The spin buttons provide the following keyboard support described in the [Spin Button Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/spinbutton/#keyboard_interaction).

| Key | Function |
| --- | --- |
| Down Arrow | 
*   Decreases value 1 step.
*   When focus is on the Day spin button and the value is the first day of the month, changes value to the last day of the month.
*   When focus is on the Month spin button and the value is January, changes value to December.

 |
| Up Arrow | 

*   Increases the value 1 step.
*   When focus is on the Day spin button and the value is the last day of the month, changes value to the first day of the month.
*   When focus is on the Month spin button and the value is December, changes value to January.

 |
| Page Down | 

*   Decreases the value 5 steps.
*   When focus is on the Day spin button and the value is the fifth day of the month or less, changes value to the last day of the month.
*   When focus is on the Month spin button and the value is the fifth month of the year or less, changes value to December.

 |
| Page Up | 

*   Increases the value 5 steps.
*   When focus is on the Day spin button and the value is any of the last five days of the month, changes value to the first day of the month.
*   When focus is on the Month spin button and the value is any of the last five months of the year, changes value to January.

 |
| Home | Decreases to minimum value. |
| End | Increases to maximum value. |