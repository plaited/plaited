---
source: https://www.w3.org/WAI/ARIA/apg/patterns/radio/examples/radio-rating/
---
Rating Radio Group Example
==========================

Keyboard Support
----------------

| Key | Function |
| --- | --- |
| Tab | 
*   Moves focus to the checked `radio` button in the `radiogroup`.
*   If a `radio` button is not checked, focus moves to the first `radio` button in the group.

 |
| Space | 

*   If the `radio` button with focus is not checked, changes the state to `checked`.
*   Otherwise, does nothing.
*   Note: The state where a radio is not checked only occurs on page load.

 |
| Down arrow  
Right arrow | 

*   Moves focus to and checks the next `radio` button in the group.
*   If focus is on the last `radio` button, moves focus to the first `radio` button.
*   The state of the previously checked radio button is changed to unchecked.

 |
| Up arrow  
Left arrow | 

*   Moves focus to and checks the previous `radio` button in the group.
*   If focus is on the first `radio` button, moves focus to and checks the last `radio` button.
*   The state of the previously checked radio button is changed to unchecked.

 |