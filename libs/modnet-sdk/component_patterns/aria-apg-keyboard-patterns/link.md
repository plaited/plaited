---
source: https://www.w3.org/WAI/ARIA/apg/patterns/link/

---
# Link Pattern

## About This Pattern

A  [link](https://w3c.github.io/aria/#link)  widget provides an interactive reference to a resource. The target resource can be either external or local, i.e., either outside or within the current page or application.

### note

Authors are strongly encouraged to use a native host language link element, such as an HTML  `<A>`  element with an  `href`  attribute. As with other WAI-ARIA widget roles, applying the link role to an element will not cause browsers to enhance the element with standard link behaviors, such as navigation to the link target or context menu actions. When using the  `link`  role, providing these features of the element is the author's responsibility.

![](images/link.svg)

## Examples

[Link Examples](link.example.md): Link widgets constructed from HTML  `span`  and  `img`  elements.

## Keyboard Interaction

-   Enter: Executes the link and moves focus to the link target.
-   Shift + F10  (Optional): Opens a context menu for the link.

## WAI-ARIA Roles, States, and Properties

The element containing the link text or graphic has role of  [link](https://w3c.github.io/aria/#link).

