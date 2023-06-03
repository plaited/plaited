---
source: https://www.w3.org/WAI/ARIA/apg/patterns/tabs/examples/tabs-automatic/
---
Example of Tabs with Automatic Activation
=========================================

Keyboard Support
----------------

| Key | Function |
| --- | --- |
| Tab | 
*   When focus moves into the tab list, places focus on the active `tab` element .
*   When the tab list contains the focus, moves focus to the next element in the tab sequence, which is the `tabpanel` element.

 |
| Right Arrow | 

*   Moves focus to the next tab.
*   If focus is on the last tab, moves focus to the first tab.
*   Activates the newly focused tab.

 |
| Left Arrow | 

*   Moves focus to the previous tab.
*   If focus is on the first tab, moves focus to the last tab.
*   Activates the newly focused tab.

 |
| Home | Moves focus to the first tab and activates it. |
| End | Moves focus to the last tab and activates it. |