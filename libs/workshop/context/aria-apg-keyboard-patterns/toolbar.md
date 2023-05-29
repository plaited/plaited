---
source: https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/

---
# Toolbar Pattern

## About This Pattern

A  [toolbar](https://w3c.github.io/aria/#toolbar)  is a container for grouping a set of controls, such as buttons, menubuttons, or checkboxes.

When a set of controls is visually presented as a group, the  `toolbar`  role can be used to communicate the presence and purpose of the grouping to screen reader users. Grouping controls into toolbars can also be an effective way of reducing the number of tab stops in the keyboard interface.

To optimize the benefit of toolbar widgets:

-   Implement focus management so the keyboard tab sequence includes one stop for the toolbar and arrow keys move focus among the controls in the toolbar.
    -   In horizontal toolbars,  Left Arrow  and  Right Arrow  navigate among controls.  Up Arrow  and  Down Arrow  can duplicate  Left Arrow  and  Right Arrow, respectively, or can be reserved for operating controls, such as spin buttons that require vertical arrow keys to operate.
    -   In vertical toolbars,  Up Arrow  and  Down Arrow  navigate among controls.  Left Arrow  and  Right Arrow  can duplicate  Up Arrow  and  Down Arrow, respectively, or can be reserved for operating controls, such as horizontal sliders that require horizontal arrow keys to operate.
    -   In toolbars with multiple rows of controls,  Left Arrow  and  Right Arrow  can provide navigation that wraps from row to row, leaving the option of reserving vertical arrow keys for operating controls.
-   Avoid including controls whose operation requires the pair of arrow keys used for toolbar navigation. If unavoidable, include only one such control and make it the last element in the toolbar. For example, in a horizontal toolbar, a textbox could be included as the last element.
-   Use toolbar as a grouping element only if the group contains 3 or more controls.

![](images/toolbar.svg)

## Example

[Toolbar Example](toolbar.example.md): A toolbar that uses roving tabindex to manage focus and contains several types of controls, including toggle buttons, radio buttons, a menu button, a spin button, a checkbox, and a link.

## Keyboard Interaction

-   Tab  and  Shift + Tab: Move focus into and out of the toolbar. When focus moves into a toolbar:
    -   If focus is moving into the toolbar for the first time, focus is set on the first control that is not disabled.
    -   If the toolbar has previously contained focus, focus is optionally set on the control that last had focus. Otherwise, it is set on the first control that is not disabled.
-   For a horizontal toolbar (the default):
    -   Left Arrow: Moves focus to the previous control. Optionally, focus movement may wrap from the first element to the last element.
    -   Right Arrow: Moves focus to the next control. Optionally, focus movement may wrap from the last element to the first element.
-   Home  (Optional): Moves focus to first element.
-   End  (Optional): Moves focus to last element.

### Note

1.  If the items in a toolbar are arranged vertically:
    1.  Down Arrow  performs as  Right Arrow  is described above.
    2.  Up Arrow  performs as  Left Arrow  is described above.
2.  Typically, disabled elements are not focusable when navigating with a keyboard. However, in circumstances where discoverability of a function is crucial, it may be helpful if disabled controls are focusable so screen reader users are more likely to be aware of their presence. For additional guidance, see  [Focusability of disabled controls](keyboard-interface.md#kbd_disabled_controls).
3.  In applications where quick access to a toolbar is important, such as accessing an editor's toolbar from its text area, a documented shortcut key for moving focus from the relevant context to its corresponding toolbar is recommended.

## WAI-ARIA Roles, States, and Properties

-   The element that serves as the toolbar container has role  [toolbar](https://w3c.github.io/aria/#toolbar).
-   If the toolbar has a visible label, it is referenced by  [aria-labelledby](https://w3c.github.io/aria/#aria-labelledby)  on the toolbar element. Otherwise, the toolbar element has a label provided by  [aria-label](https://w3c.github.io/aria/#aria-label).
-   If the controls are arranged vertically, the toolbar element has  [aria-orientation](https://w3c.github.io/aria/#aria-orientation)  set to  `vertical`. The default orientation is horizontal.

