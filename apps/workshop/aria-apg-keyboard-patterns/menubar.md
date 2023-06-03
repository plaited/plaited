---
source: https://www.w3.org/WAI/ARIA/apg/patterns/menubar/

---
# Menu and Menubar Pattern

## About This Pattern

A  [menu](https://w3c.github.io/aria/#menu)  is a widget that offers a list of choices to the user, such as a set of actions or functions. Menu widgets behave like native operating system menus, such as the menus that pull down from the menubars commonly found at the top of many desktop application windows. A menu is usually opened, or made visible, by activating a  [menu button](menu-button.md), choosing an item in a menu that opens a sub menu, or by invoking a command, such as  Shift + F10  in Windows, that opens a context specific menu. When a user activates a choice in a menu, the menu usually closes unless the choice opened a submenu.

A menu that is visually persistent is a  [menubar](https://w3c.github.io/aria/#menubar). A menubar is typically horizontal and is often used to create a menu bar similar to those found near the top of the window in many desktop applications, offering the user quick access to a consistent set of commands.

A common convention for indicating that a menu item launches a dialog box is to append "…" (ellipsis) to the menu item label, e.g., "Save as …".

![](images/menubar.svg)

## Examples

-   [Editor Menubar Example](menubar-editor.example.md): Demonstrates menu radios and menu checkboxes in submenus of a menubar that provides text formatting commands for a text field.
-   [Navigation Menubar Example](menubar-navigation.example.md): Demonstrates a menubar that provides site navigation.

## Keyboard Interaction

The following description of keyboard behaviors assumes:

1.  A horizontal  `menubar`  containing several  `menuitem`,  `menuitemradio`, or  `menuitemcheckbox`  elements.
2.  Some  `menuitem`  elements in the  `menubar`  have child submenus that contain vertically arranged items.
3.  Some of the  `menuitem`  elements in the submenus have child submenus with items that are also vertically arranged.

When reading the following descriptions, also keep in mind that:

1.  Focusable elements, which may have role  `menuitem`,  `menuitemradio`, or  `menuitemcheckbox`, are referred to as items.
2.  If a behavior applies to only certain types of items, e.g.,  `menuitem`  elements, the specific role name is used.
3.  Submenus, also known as popup menus, are elements with role  `menu`.
4.  Except where noted, menus opened from a menubutton behave the same as menus opened from a menubar.

When a  `menu`  opens, or when a  `menubar`  receives focus, keyboard focus is placed on the first item. Because  `menubar`  and  `menu`  elements are composite widgets as described in the practice for  [Keyboard Navigation Inside Components](keyboard-interface.md#kbd_general_within),  Tab  and  Shift + Tab  do not move focus among the items in the menu. Instead, the keyboard commands described in this section enable users to move focus among the elements in a  `menubar`  or  `menu`.

-   Tab  and  Shift + Tab:
    -   Move focus into a  `menubar`:
        -   If focus is moving into the  `menubar`  for the first time, focus is set on the first  `menuitem`.
        -   If the  `menubar`  has previously contained focus, focus is optionally set on the  `menuitem`  that last had focus. Otherwise, it is set on the first  `menuitem`  that is not disabled.
    -   When focus is on a  `menuitem`  in a  `menu`  or  `menubar`, move focus out of the  `menu`  or  `menubar`, and close all menus and submenus.
    -   Note that  Tab  and  Shift + Tab  do not move focus into a  `menu`. Unlike a  `menubar`, a  `menu`  is not visually persistent, and authors are responsible for ensuring focus moves to an item inside of a  `menu`  when the  `menu`  opens.
-   Enter:
    -   When focus is on a  `menuitem`  that has a submenu, opens the submenu and places focus on its first item.
    -   Otherwise, activates the item and closes the menu.
-   Space:
    -   (Optional): When focus is on a  `menuitemcheckbox`, changes the state without closing the menu.
    -   (Optional): When focus is on a  `menuitemradio`  that is not checked, without closing the menu, checks the focused  `menuitemradio`  and unchecks any other checked  `menuitemradio`  element in the same group.
    -   (Optional): When focus is on a  `menuitem`  that has a submenu, opens the submenu and places focus on its first item.
    -   (Optional): When focus is on a  `menuitem`  that does not have a submenu, activates the  `menuitem`  and closes the menu.
-   Down Arrow:
    -   When focus is on a  `menuitem`  in a  `menubar`, and that  `menuitem`  has a submenu, opens the submenu and places focus on the first item in the submenu.
    -   When focus is in a  `menu`, moves focus to the next item, optionally wrapping from the last to the first.
-   Up Arrow:
    -   When focus is in a  `menu`, moves focus to the previous item, optionally wrapping from the first to the last.
    -   (Optional): When focus is on a  `menuitem`  in a  `menubar`, and that  `menuitem`  has a submenu, opens the submenu and places focus on the last item in the submenu.
-   Right Arrow:
    -   When focus is in a  `menubar`, moves focus to the next item, optionally wrapping from the last to the first.
    -   When focus is in a  `menu`  and on a  `menuitem`  that has a submenu, opens the submenu and places focus on its first item.
    -   When focus is in a  `menu`  and on an item that does not have a submenu, performs the following 3 actions:
        
        1.  Closes the submenu and any parent menus.
        2.  Moves focus to the next item in the  `menubar`.
        3.  If focus is now on a  `menuitem`  with a submenu, either: (Recommended) opens the submenu of that  `menuitem`  without moving focus into the submenu, or opens the submenu of that  `menuitem`  and places focus on the first item in the submenu.
        
        Note that if the  `menubar`  were not present, e.g., the menus were opened from a menubutton,  Right Arrow  would not do anything when focus is on an item that does not have a submenu.
-   Left Arrow:
    -   When focus is in a  `menubar`, moves focus to the previous item, optionally wrapping from the first to the last.
    -   When focus is in a submenu of an item in a  `menu`, closes the submenu and returns focus to the parent  `menuitem`.
    -   When focus is in a submenu of an item in a  `menubar`, performs the following 3 actions:
        1.  Closes the submenu.
        2.  Moves focus to the previous item in the  `menubar`.
        3.  If focus is now on a  `menuitem`  with a submenu, either: (Recommended) opens the submenu of that  `menuitem`  without moving focus into the submenu, or opens the submenu of that  `menuitem`  and places focus on the first item in the submenu.
-   Home: If arrow key wrapping is not supported, moves focus to the first item in the current  `menu`  or  `menubar`.
-   End: If arrow key wrapping is not supported, moves focus to the last item in the current  `menu`  or  `menubar`.
-   Any key that corresponds to a printable character (Optional): Move focus to the next item in the current menu whose label begins with that printable character.
-   Escape: Close the menu that contains focus and return focus to the element or context, e.g., menu button or parent  `menuitem`, from which the menu was opened.

### Note

1.  Disabled menu items are focusable but cannot be activated.
2.  A  [separator](https://w3c.github.io/aria/#separator)  in a menu is not focusable or interactive.
3.  If a menu is opened or a menubar receives focus as a result of a context action,  Escape  or  Enter  may return focus to the invoking context. For example, a rich text editor may have a menubar that receives focus when a shortcut key, e.g.,  alt + F10, is pressed while editing. In this case, pressing  Escape  or activating a command from the menu may return focus to the editor.
4.  Although it is recommended that authors avoid doing so, some implementations of navigation menubars may have  `menuitem`  elements that both perform a function and open a submenu. In such implementations,  Enter  and  Space  perform a navigation function, e.g., load new content, while  Down Arrow, in a horizontal menubar, opens the submenu associated with that same  `menuitem`.
5.  When items in a  `menubar`  are arranged vertically and items in  `menu`  containers are arranged horizontally:
    1.  Down Arrow  performs as  Right Arrow  is described above, and vice versa.
    2.  Up Arrow  performs as  Left Arrow  is described above, and vice versa.

## WAI-ARIA Roles, States, and Properties

-   A menu is a container of items that represent choices. The element serving as the menu has a role of either  [menu](https://w3c.github.io/aria/#menu)  or  [menubar](https://w3c.github.io/aria/#menubar).
-   The items contained in a menu are child elements of the containing menu or menubar and have any of the following roles:
    -   [menuitem](https://w3c.github.io/aria/#menuitem)
    -   [menuitemcheckbox](https://w3c.github.io/aria/#menuitemcheckbox)
    -   [menuitemradio](https://w3c.github.io/aria/#menuitemradio)
-   If activating a  [menuitem](https://w3c.github.io/aria/#menuitem)  opens a submenu, the menuitem is known as a parent menuitem. A submenu's  `menu`  element is:
    -   Contained inside the same  `menu`  element as its parent  `menuitem`.
    -   Is the sibling element immediately following its parent  `menuitem`.
-   A parent menuitem has  [aria-haspopup](https://w3c.github.io/aria/#aria-haspopup)  set to either  `menu`  or  `true`.
-   A parent menuitem has  [aria-expanded](https://w3c.github.io/aria/#aria-expanded)  set to  `false`  when its child menu is not visible and set to  `true`  when the child menu is visible.
-   One of the following approaches is used to enable scripts to move focus among items in a menu as described in the practice for  [Keyboard Navigation Inside Components](keyboard-interface.md#kbd_general_within):
    -   The menu container has  `tabindex`  set to  `-1`  or  `0`  and  [aria-activedescendant](https://w3c.github.io/aria/#aria-activedescendant)  set to the ID of the focused item.
    -   Each item in the menu has  `tabindex`  set to  `-1`, except in a menubar, where the first item has  `tabindex`  set to  `0`.
-   When a  [menuitemcheckbox](https://w3c.github.io/aria/#menuitemcheckbox)  or  [menuitemradio](https://w3c.github.io/aria/#menuitemradio)  is checked,  [aria-checked](https://w3c.github.io/aria/#aria-checked)  is set to  `true`.
-   When a menu item is disabled,  [aria-disabled](https://w3c.github.io/aria/#aria-disabled)  is set to  `true`.
-   Items in a menu may be divided into groups by placing an element with a role of  [separator](https://w3c.github.io/aria/#separator)  between groups. For example, this technique should be used when a menu contains a set of  [menuitemradio](https://w3c.github.io/aria/#menuitemradio)  items.
-   All  [separators](https://w3c.github.io/aria/#separator)  should have  [aria-orientation](https://w3c.github.io/aria/#aria-orientation)  consistent with the separator's orientation.
-   If a menubar has a visible label, the element with role  `menubar`  has  [aria-labelledby](https://w3c.github.io/aria/#aria-labelledby)  set to a value that refers to the labelling element. Otherwise, the menubar element has a label provided by  [aria-label](https://w3c.github.io/aria/#aria-label).
-   If a menubar is vertically oriented, it has  [aria-orientation](https://w3c.github.io/aria/#aria-orientation)  set to  `vertical`. The default value of  `aria-orientation`  for a menubar is  `horizontal`.
-   An element with role  `menu`  either has:
    -   [aria-labelledby](https://w3c.github.io/aria/#aria-labelledby)  set to a value that refers to the menuitem or button that controls its display.
    -   A label provided by  [aria-label](https://w3c.github.io/aria/#aria-label).
-   If a menu is horizontally oriented, it has  [aria-orientation](https://w3c.github.io/aria/#aria-orientation)  set to  `horizontal`. The default value of  `aria-orientation`  for a menu is  `vertical`.

### Note

If  [aria-owns](https://w3c.github.io/aria/#aria-owns)  is set on the menu container to include elements that are not DOM children of the container, those elements will appear in the reading order in the sequence they are referenced and after any items that are DOM children. Scripts that manage focus need to ensure the visual focus order matches this assistive technology reading order.

