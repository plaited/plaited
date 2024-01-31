---
source: https://www.w3.org/WAI/ARIA/apg/patterns/tabs/examples/tabs-manual/
---
Example of Tabs with Manual Activation
======================================

Keyboard Support
----------------

| Key | Function |
| --- | --- |
| Tab | 
*   When focus moves into the tab list, places focus on the active `tab` element.
*   When the tab list contains the focus, moves focus to the next element in the tab sequence, which is the `a` element in `tabpanel`.

 |
| Enter  
Space | When a tab has focus, activates the tab, causing its associated panel to be displayed. |
| Right Arrow | When a tab has focus:

*   Moves focus to the next tab.
*   If focus is on the last tab, moves focus to the first tab.

 |
| Left Arrow | When a tab has focus:

*   Moves focus to the previous tab.
*   If focus is on the first tab, moves focus to the last tab.

 |
| Home | When a tab has focus, moves focus to the first tab. |
| End | When a tab has focus, moves focus to the last tab. |