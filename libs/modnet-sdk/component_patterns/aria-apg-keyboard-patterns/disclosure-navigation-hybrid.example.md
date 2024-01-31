---
source: https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/examples/disclosure-navigation-hybrid/
---
Example Disclosure Navigation Menu with Top-Level Links
=======================================================

Keyboard Support
----------------

| Key | Function |
| --- | --- |
| Tab  
Shift + Tab | Move keyboard focus among top-level links and buttons, and if a dropdown is open, through links in the dropdown. |
| Space or  
Enter | 
*   If focus is on a disclosure button, activates the button, which toggles the visibility of the dropdown.
*   If focus is on a link:
    *   If any link has `aria-current` set, removes it.
    *   Sets `aria-current="page"` on the focused link.
    *   Activates the focused link.

 |
| Escape | If a dropdown is open, closes it and sets focus on the button that controls that dropdown. |
| Down Arrow or  
Right Arrow  
(Optional) | 

*   If focus is on a top-level link or button with a collapsed dropdown, and it is not the last top-level item, moves focus to the next top-level link or button.
*   if focus is on a top-level button and its dropdown is expanded, moves focus to the first link in the dropdown.
*   If focus is on a link within an expanded dropdown, and it is not the last link, moves focus to the next link.

 |
| Up Arrow or  
Left Arrow  
(Optional) | 

*   If focus is on a top-level link or button, and it is not the first item, moves focus to the previous link or button.
*   If focus is on a link within an expanded dropdown, and it is not the first link, moves focus to the previous link.

 |
| Home (Optional) | 

*   If focus is on a top-level link button, and it is not the first item, moves focus to the first item.
*   If focus is on a link within an expanded dropdown, and it is not the first link, moves focus to the first link.

 |
| End (Optional) | 

*   If focus is on a top-level link or button, and it is not the last item, moves focus to the last item.
*   If focus is on a link within an expanded dropdown, and it is not the last link, moves focus to the last link.

 |