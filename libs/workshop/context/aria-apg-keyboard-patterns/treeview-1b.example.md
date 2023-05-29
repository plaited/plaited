---
source: https://www.w3.org/WAI/ARIA/apg/patterns/treeview/examples/treeview-1b/
---
File Directory Treeview Example Using Declared Properties
=========================================================

Keyboard Support
----------------

Note that in this example, selection and focus are distinct; moving focus does not change which node is selected. Because selection does not follow focus, keyboard and screen reader users can navigate and explore the tree without changing the content of the file viewer. To learn more about this aspect of the design, read the guidance section about [Deciding When to Make Selection Automatically Follow Focus](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/#kbd_selection_follows_focus).

| Key | Function |
| --- | --- |
| Enter | Performs the default action, which is to select the node, causing the name of the node to appear in the File or Folder Selected textbox. |
| Space | Performs the default action, which is to select the node, causing the name of the node to appear in the File or Folder Selected textbox. |
| Down arrow | 
*   Moves focus to the next node that is focusable without opening or closing a node.
*   If focus is on the last node, does nothing.

 |
| Up arrow | 

*   Moves focus to the previous node that is focusable without opening or closing a node.
*   If focus is on the first node, does nothing.

 |
| Right Arrow | 

*   When focus is on a closed node, opens the node; focus does not move.
*   When focus is on a open node, moves focus to the first child node.
*   When focus is on an end node, does nothing.

 |
| Left Arrow | 

*   When focus is on an open node, closes the node.
*   When focus is on a child node that is also either an end node or a closed node, moves focus to its parent node.
*   When focus is on a root node that is also either an end node or a closed node, does nothing.

 |
| Home | Moves focus to first node without opening or closing a node. |
| End | Moves focus to the last node that can be focused without expanding any nodes that are closed. |
| a-z, A-Z | 

*   Focus moves to the next node with a name that starts with the typed character.
*   Search wraps to first node if a matching name is not found among the nodes that follow the focused node.
*   Search ignores nodes that are descendants of closed nodes.

 |
| \* (asterisk) | 

*   Expands all closed sibling nodes that are at the same level as the focused node.
*   Focus does not move.

 |