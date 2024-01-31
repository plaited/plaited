---
source: https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/

---

# Menu Button Pattern

## About This Pattern

A menu button is a  [button](button.md)  that opens a menu as described in the  [Menu and Menubar Pattern](menubar.md). It is often styled as a typical push button with a downward pointing arrow or triangle to hint that activating the button will display a menu.

![](images/menu-button.svg)

## Examples

-   [Action Menu Button Example Using aria-activedescendant](menu-button-actions-active-descendant.example.md): A button that opens a menu of actions or commands where focus in the menu is managed using aria-activedescendant.
-   [Action Menu Button Example Using element.focus()](menu-button-actions.example.md): A menu button made from an HTML  `button`  element that opens a menu of actions or commands where focus in the menu is managed using  `element.focus()`.
-   [Navigation Menu Button](menu-button-links.example.md): A menu button made from an HTML  `a`  element that opens a menu of items that behave as links.

## Keyboard Interaction

-   With focus on the button:
    -   Enter: opens the menu and places focus on the first menu item.
    -   Space: Opens the menu and places focus on the first menu item.
    -   (Optional)  Down Arrow: opens the menu and moves focus to the first menu item.
    -   (Optional)  Up Arrow: opens the menu and moves focus to the last menu item.
-   The keyboard behaviors needed after the menu is open are described in the  [Menu and Menubar Pattern](menubar.md).

## WAI-ARIA Roles, States, and Properties

-   The element that opens the menu has role  [button](https://w3c.github.io/aria/#button).
-   The element with role  `button`  has  [aria-haspopup](https://w3c.github.io/aria/#aria-haspopup)  set to either  `menu`  or  `true`.
-   When the menu is displayed, the element with role  `button`  has  [aria-expanded](https://w3c.github.io/aria/#aria-expanded)  set to  `true`. When the menu is hidden, it is recommended that  `aria-expanded`  is not present. If  `aria-expanded`  is specified when the menu is hidden, it is set to  `false`.
-   The element that contains the menu items displayed by activating the button has role  [menu](https://w3c.github.io/aria/#menu).
-   Optionally, the element with role  `button`  has a value specified for  [aria-controls](https://w3c.github.io/aria/#aria-controls)  that refers to the element with role  `menu`.
-   Additional roles, states, and properties needed for the menu element are described in the  [Menu and Menubar Pattern](menubar.md).

