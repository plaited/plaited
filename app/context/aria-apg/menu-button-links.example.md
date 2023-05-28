---
source: https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/examples/menu-button-links/
---
Navigation Menu Button Example
==============================

Keyboard Support
----------------

### Menu Button

| Key | Function |
| --- | --- |
| Down Arrow  
Space  
Enter | Opens `menu` and moves focus to first `menuitem` |
| Up Arrow | Opens `menu` and moves focus to last `menuitem` |

### Menu

| Key | Function |
| --- | --- |
| Space  
Enter | Activates the menu item, which is equivalent to activating the link element from which the menu item is made. |
| Escape | 
*   Closes the menu.
*   Sets focus to the menu button.

 |
| Up Arrow | 

*   Moves focus to the previous menu item.
*   If focus is on the first menu item, moves focus to the last menu item.

 |
| Down Arrow | 

*   Moves focus to the next menu item.
*   If focus is on the last menu item, moves focus to the first menu item.

 |
| Home | Moves focus to the first menu item. |
| End | Moves focus to the last menu item. |
| A-Z  
a-z | 

*   Moves focus to the next menu item with a label that starts with the typed character if such an menu item exists.
*   Otherwise, focus does not move.

 |