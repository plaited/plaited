---
source: https://www.w3.org/WAI/ARIA/apg/patterns/tabs/

---
# Tabs Pattern

## About This Pattern

Tabs are a set of layered sections of content, known as tab panels, that display one panel of content at a time. Each tab panel has an associated tab element, that when activated, displays the panel. The list of tab elements is arranged along one edge of the currently displayed panel, most commonly the top edge.

Terms used to describe this design pattern include:

Tabs or Tabbed Interface

A set of tab elements and their associated tab panels.

Tab List

A set of tab elements contained in a  [tablist](https://w3c.github.io/aria/#tablist)  element.

[tab](https://w3c.github.io/aria/#tab)

An element in the tab list that serves as a label for one of the tab panels and can be activated to display that panel.

[tabpanel](https://w3c.github.io/aria/#tabpanel)

The element that contains the content associated with a tab.

When a tabbed interface is initialized, one tab panel is displayed and its associated tab is styled to indicate that it is active. When the user activates one of the other tab elements, the previously displayed tab panel is hidden, the tab panel associated with the activated tab becomes visible, and the tab is considered "active".

![](images/tabs.svg)

## Examples

-   [Tabs With Automatic Activation](tabs-automatic.example.md): A tabs widget where tabs are automatically activated and their panel is displayed when they receive focus.
-   [Tabs With Manual Activation](tabs-manual.example.md): A tabs widget where users activate a tab and display its panel by pressing  Space  or  Enter.

## Keyboard Interaction

For the tab list:

-   Tab:
    -   When focus moves into the tab list, places focus on the active  `tab`  element.
    -   When the tab list contains the focus, moves focus to the next element in the page tab sequence outside the tablist, which is the tabpanel unless the first element containing meaningful content inside the tabpanel is focusable.
-   When focus is on a tab element in a horizontal tab list:
    -   Left Arrow: moves focus to the previous tab. If focus is on the first tab, moves focus to the last tab. Optionally, activates the newly focused tab (See note below).
    -   Right Arrow: Moves focus to the next tab. If focus is on the last tab element, moves focus to the first tab. Optionally, activates the newly focused tab (See note below).
-   When focus is on a tab in a tablist with either horizontal or vertical orientation:
    -   Space or Enter: Activates the tab if it was not activated automatically on focus.
    -   Home  (Optional): Moves focus to the first tab. Optionally, activates the newly focused tab (See note below).
    -   End  (Optional): Moves focus to the last tab. Optionally, activates the newly focused tab (See note below).
    -   Shift + F10: If the tab has an associated popup menu, opens the menu.
    -   Delete  (Optional): If deletion is allowed, deletes (closes) the current tab element and its associated tab panel, sets focus on the tab following the tab that was closed, and optionally activates the newly focused tab. If there is not a tab that followed the tab that was deleted, e.g., the deleted tab was the right-most tab in a left-to-right horizontal tab list, sets focus on and optionally activates the tab that preceded the deleted tab. If the application allows all tabs to be deleted, and the user deletes the last remaining tab in the tab list, the application moves focus to another element that provides a logical work flow. As an alternative to  Delete, or in addition to supporting  Delete, the delete function is available in a context menu.

### Note

1.  It is recommended that tabs activate automatically when they receive focus as long as their associated tab panels are displayed without noticeable latency. This typically requires tab panel content to be preloaded. Otherwise, automatic activation slows focus movement, which significantly hampers users' ability to navigate efficiently across the tab list. For additional guidance, see  [Deciding When to Make Selection Automatically Follow Focus](keyboard-interface.md#kbd_selection_follows_focus).
2.  When a tab list has its  [aria-orientation](https://w3c.github.io/aria/#aria-orientation)  set to  `vertical`:
    1.  Down Arrow  performs as  Right Arrow  is described above.
    2.  Up Arrow  performs as  Left Arrow  is described above.
3.  If the tab list is horizontal, it does not listen for  Down Arrow  or  Up Arrow  so those keys can provide their normal browser scrolling functions even when focus is inside the tab list.
4.  When the tabpanel does not contain any focusable elements or the first element with content is not focusable, the tabpanel should set  `tabindex="0"`  to include it in the tab sequence of the page.

## WAI-ARIA Roles, States, and Properties

-   The element that serves as the container for the set of tabs has role  [tablist](https://w3c.github.io/aria/#tablist).
-   Each element that serves as a tab has role  [tab](https://w3c.github.io/aria/#tab)  and is contained within the element with role  `tablist`.
-   Each element that contains the content panel for a  `tab`  has role  [tabpanel](https://w3c.github.io/aria/#tabpanel).
-   If the tab list has a visible label, the element with role  `tablist`  has  [aria-labelledby](https://w3c.github.io/aria/#aria-labelledby)  set to a value that refers to the labelling element. Otherwise, the  `tablist`  element has a label provided by  [aria-label](https://w3c.github.io/aria/#aria-label).
-   Each element with role  `tab`  has the property  [aria-controls](https://w3c.github.io/aria/#aria-controls)  referring to its associated  `tabpanel`  element.
-   The active  `tab`  element has the state  [aria-selected](https://w3c.github.io/aria/#aria-selected)  set to  `true`  and all other  `tab`  elements have it set to  `false`.
-   Each element with role  `tabpanel`  has the property  [aria-labelledby](https://w3c.github.io/aria/#aria-labelledby)  referring to its associated  `tab`  element.
-   If a  `tab`  element has a popup menu, it has the property  [aria-haspopup](https://w3c.github.io/aria/#aria-haspopup)  set to either  `menu`  or  `true`.
-   If the  `tablist`  element is vertically oriented, it has the property  [aria-orientation](https://w3c.github.io/aria/#aria-orientation)  set to  `vertical`. The default value of  `aria-orientation`  for a  `tablist`  element is  `horizontal`.

