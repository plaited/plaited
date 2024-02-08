---
source: https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/examples/checkbox-mixed/
---
Checkbox Example (Mixed-State)
==============================

Keyboard Support
----------------

| Key | Function |
| --- | --- |
| Tab | Moves keyboard focus among the checkboxes. |
| Space | 
*   Cycles the tri-state checkbox among unchecked, mixed, and checked states.
*   When the tri-state checkbox is unchecked, all the controlled checkboxes are unchecked.
*   When the tri-state checkbox is mixed, the controlled checkboxes return to the last combination of states they had when the tri-state checkbox was last mixed or to the default combination of states they had when the page loaded.
*   When the tri-state checkbox is checked, all the controlled checkboxes are checked.

 |