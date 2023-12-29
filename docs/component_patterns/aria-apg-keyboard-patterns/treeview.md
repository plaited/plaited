---
source: https://www.w3.org/WAI/ARIA/apg/patterns/treeview/

---

# Tree View Pattern

## About This Pattern

A tree view widget presents a hierarchical list. Any item in the hierarchy may have child items, and items that have children may be expanded or collapsed to show or hide the children. For example, in a file system navigator that uses a tree view to display folders and files, an item representing a folder can be expanded to reveal the contents of the folder, which may be files, folders, or both.

When using a keyboard to navigate a tree, a visual keyboard indicator informs the user which item is focused. If the tree allows the user to choose just one item for an action, then it is known as a single-select tree. In some implementations of single-select tree, the focused item also has a selected state; this is known as selection follows focus. However, in multi-select trees, which enable the user to select more than one item for an action, the selected state is always independent of the focus. For example, in a typical file system navigator, the user can move focus to select any number of files for an action, such as copy or move. It is important that the visual design distinguish between items that are selected and the item that has focus. For more details, see  [this description of differences between focus and selection](keyboard-interface.md#kbd_focus_vs_selection)  and  [Deciding When to Make Selection Automatically Follow Focus](keyboard-interface.md#kbd_selection_follows_focus).

![](images/treeview.svg)

## Examples

-   [File Directory Treeview Example Using Computed Properties](treeview-1a.example.md): A file selector tree that demonstrates browser support for automatically computing  `aria-level`,  `aria-posinset`  and  `aria-setsize`  based on DOM structure.
-   [File Directory Treeview Example Using Declared Properties](treeview-1b.example.md): A file selector tree that demonstrates how to explicitly define values for  `aria-level`,  `aria-posinset`  and  `aria-setsize`.
-   [Navigation Treeview Example](treeview-navigation.example.md): A tree that provides navigation to a set of web pages and demonstrates browser support for automatically computing  `aria-level`,  `aria-posinset`  and  `aria-setsize`  based on DOM structure.

## Terms

Terms for describing tree views include:

Node

An item in a tree.

Root Node

Node at the base of the tree; it may have one or more child nodes but does not have a parent node.

Child Node

Node that has a parent; any node that is not a root node is a child node.

End Node

Node that does not have any child nodes; an end node may be either a root node or a child node.

Parent Node

Node with one or more child nodes. It can be open (expanded) or closed (collapsed).

Open Node

Parent node that is expanded so its child nodes are visible.

Closed Node

Parent node that is collapsed so the child nodes are not visible.

## Keyboard Interaction

For a vertically oriented tree:

-   When a single-select tree receives focus:
    -   If none of the nodes are selected before the tree receives focus, focus is set on the first node.
    -   If a node is selected before the tree receives focus, focus is set on the selected node.
-   When a multi-select tree receives focus:
    -   If none of the nodes are selected before the tree receives focus, focus is set on the first node.
    -   If one or more nodes are selected before the tree receives focus, focus is set on the first selected node.
-   Right arrow:
    -   When focus is on a closed node, opens the node; focus does not move.
    -   When focus is on a open node, moves focus to the first child node.
    -   When focus is on an end node, does nothing.
-   Left arrow:
    -   When focus is on an open node, closes the node.
    -   When focus is on a child node that is also either an end node or a closed node, moves focus to its parent node.
    -   When focus is on a root node that is also either an end node or a closed node, does nothing.
-   Down Arrow: Moves focus to the next node that is focusable without opening or closing a node.
-   Up Arrow: Moves focus to the previous node that is focusable without opening or closing a node.
-   Home: Moves focus to the first node in the tree without opening or closing a node.
-   End: Moves focus to the last node in the tree that is focusable without opening a node.
-   Enter: activates a node, i.e., performs its default action. For parent nodes, one possible default action is to open or close the node. In single-select trees where selection does not follow focus (see note below), the default action is typically to select the focused node.
-   Type-ahead is recommended for all trees, especially for trees with more than 7 root nodes:
    -   Type a character: focus moves to the next node with a name that starts with the typed character.
    -   Type multiple characters in rapid succession: focus moves to the next node with a name that starts with the string of characters typed.
-   *  (Optional): Expands all siblings that are at the same level as the current node.
-   **Selection in multi-select trees:**  Authors may implement either of two interaction models to support multiple selection: a recommended model that does not require the user to hold a modifier key, such as  Shift  or  Control, while navigating the list or an alternative model that does require modifier keys to be held while navigating in order to avoid losing selection states.
    -   Recommended selection model -- holding a modifier key while moving focus is not necessary:
        -   Space: Toggles the selection state of the focused node.
        -   Shift + Down Arrow  (Optional): Moves focus to and toggles the selection state of the next node.
        -   Shift + Up Arrow  (Optional): Moves focus to and toggles the selection state of the previous node.
        -   Shift + Space  (Optional): Selects contiguous nodes from the most recently selected node to the current node.
        -   Control + Shift + Home  (Optional): Selects the node with focus and all nodes up to the first node. Optionally, moves focus to the first node.
        -   Control + Shift + End  (Optional): Selects the node with focus and all nodes down to the last node. Optionally, moves focus to the last node.
        -   Control + A  (Optional): Selects all nodes in the tree. Optionally, if all nodes are selected, it can also unselect all nodes.
    -   Alternative selection model -- Moving focus without holding the  Shift  or  Control  modifier unselects all selected nodes except for the focused node:
        -   Shift + Down Arrow: Moves focus to and toggles the selection state of the next node.
        -   Shift + Up Arrow: Moves focus to and toggles the selection state of the previous node.
        -   Control + Down Arrow: Without changing the selection state, moves focus to the next node.
        -   Control + Up Arrow: Without changing the selection state, moves focus to the previous node.
        -   Control + Space: Toggles the selection state of the focused node.
        -   Shift + Space  (Optional): Selects contiguous nodes from the most recently selected node to the current node.
        -   Control + Shift + Home  (Optional): Selects the node with focus and all nodes up to the first node. Optionally, moves focus to the first node.
        -   Control + Shift + End  (Optional): Selects the node with focus and all nodes down to the last node. Optionally, moves focus to the last node.
        -   Control + A  (Optional): Selects all nodes in the tree. Optionally, if all nodes are selected, it can also unselect all nodes.

### Note

1.  DOM focus (the active element) is functionally distinct from the selected state. For more details, see  [this description of differences between focus and selection](keyboard-interface.md#kbd_focus_vs_selection).
2.  The  `tree`  role supports the  [aria-activedescendant](https://w3c.github.io/aria/#aria-activedescendant)  property, which provides an alternative to moving DOM focus among  `treeitem`  elements when implementing keyboard navigation. For details, see  [Managing Focus in Composites Using aria-activedescendant](keyboard-interface.md#kbd_focus_activedescendant).
3.  In a single-select tree, moving focus may optionally unselect the previously selected node and select the newly focused node. This model of selection is known as "selection follows focus". Having selection follow focus can be very helpful in some circumstances and can severely degrade accessibility in others. For additional guidance, see  [Deciding When to Make Selection Automatically Follow Focus](keyboard-interface.md#kbd_selection_follows_focus).
4.  If selecting or unselecting all nodes is an important function, implementing separate controls for these actions, such as buttons for "Select All" and "Unselect All", significantly improves accessibility.
5.  If the nodes in a tree are arranged horizontally:
    1.  Down Arrow  performs as  Right Arrow  is described above, and vice versa.
    2.  Up Arrow  performs as  Left Arrow  is described above, and vice versa.

## WAI-ARIA Roles, States, and Properties

-   All tree nodes are contained in or owned by an element with role  [tree](https://w3c.github.io/aria/#tree).
-   Each element serving as a tree node has role  [treeitem](https://w3c.github.io/aria/#treeitem).
-   Each root node is contained in the element with role  `tree`  or referenced by an  [aria-owns](https://w3c.github.io/aria/#aria-owns)  property set on the  `tree`  element.
-   Each parent node contains or owns an element with role  [group](https://w3c.github.io/aria/#group).
-   Each child node is contained in or owned by an element with role  [group](https://w3c.github.io/aria/#group)  that is contained in or owned by the node that serves as the parent of that child.
-   Each element with role  `treeitem`  that serves as a parent node has  [aria-expanded](https://w3c.github.io/aria/#aria-expanded)  set to  `false`  when the node is in a closed state and set to  `true`  when the node is in an open state. End nodes do not have the  `aria-expanded`  attribute because, if they were to have it, they would be incorrectly described to assistive technologies as parent nodes.
-   If the tree supports selection of more than one node, the element with role  `tree`  has  [aria-multiselectable](https://w3c.github.io/aria/#aria-multiselectable)  set to  `true`. Otherwise,  `aria-multiselectable`  is either set to  `false`  or the default value of  `false`  is implied.
-   The selection state of each selectable node is indicated with either  [aria-selected](https://w3c.github.io/aria/#aria-selected)  or  [aria-checked](https://w3c.github.io/aria/#aria-checked):
    -   If the selection state is indicated with  `aria-selected`, then  `aria-checked`  is not specified for any nodes. Alternatively, if the selection state is indicated with  `aria-checked`, then  `aria-selected`  is not specified for any nodes. See notes below regarding considerations for which property to use and for details of the unusual conditions that might allow for both properties in the same tree.
    -   If any nodes are selected, each selected node has either  [aria-selected](https://w3c.github.io/aria/#aria-selected)  or  [aria-checked](https://w3c.github.io/aria/#aria-checked)  set to  `true`. No more than one node is selected at a time if the element with role  `tree`  does  _not_  have  [aria-multiselectable](https://w3c.github.io/aria/#aria-multiselectable)  set to  `true`.
    -   All nodes that are selectable but not selected have either  [aria-selected](https://w3c.github.io/aria/#aria-selected)  or  [aria-checked](https://w3c.github.io/aria/#aria-checked)  set to  `false`.
    -   If the tree contains nodes that are not selectable, neither  [aria-selected](https://w3c.github.io/aria/#aria-selected)  nor  [aria-checked](https://w3c.github.io/aria/#aria-checked)  is present on those nodes.
    -   Note that except in trees where selection follows focus, the selected state is distinct from focus. For more details, see  [this description of differences between focus and selection](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/#kbd_focus_vs_selection)  and  [Deciding When to Make Selection Automatically Follow Focus](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/#kbd_selection_follows_focus).
-   The element with role  `tree`  has either a visible label referenced by  [aria-labelledby](https://w3c.github.io/aria/#aria-labelledby)  or a value specified for  [aria-label](https://w3c.github.io/aria/#aria-label).
-   If the complete set of available nodes is not present in the DOM due to dynamic loading as the user moves focus in or scrolls the tree, each node has  [aria-level](https://w3c.github.io/aria/#aria-level),  [aria-setsize](https://w3c.github.io/aria/#aria-setsize), and  [aria-posinset](https://w3c.github.io/aria/#aria-posinset)  specified.
-   If the  `tree`  element is horizontally oriented, it has  [aria-orientation](https://w3c.github.io/aria/#aria-orientation)  set to  `horizontal`. The default value of  `aria-orientation`  for a tree is  `vertical`.

### Note

1.  Some factors to consider when choosing whether to indicate selection with  `aria-selected`  or  `aria-checked`  are:
    -   Some design systems use  `aria-selected`  for single-select widgets and  `aria-checked`  for multi-select widgets. In the absence of factors that would make an alternative convention more appropriate, this is a recommended convention.
    -   The language of instructions and the appearance of the interface might suggest one attribute is more appropriate than the other. For instance, do instructions say to  select  items? Or, is the visual indicator of selection a check mark?
    -   It is important to adopt a consistent convention for selection models across a site or app.
2.  Conditions that would permit a tree to include both  `aria-selected`  and  `aria-checked`  are extremely rare. It is strongly recommended to avoid designing a tree widget that would have the need for more than one type of state. If both states were to be used within a tree, all the following conditions need to be satisfied:
    -   The meaning and purpose of  `aria-selected`  is different from the meaning and purpose of  `aria-checked`  in the user interface.
    -   The user interface makes the meaning and purpose of each state apparent.
    -   The user interface provides a separate method for controlling each state.
3.  If  [aria-owns](https://w3c.github.io/aria/#aria-owns)  is set on the tree container to include elements that are not DOM children of the container, those elements will appear in the reading order in the sequence they are referenced and after any items that are DOM children. Scripts that manage focus need to ensure the visual focus order matches this assistive technology reading order.

