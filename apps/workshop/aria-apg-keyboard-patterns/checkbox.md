---
source: https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/

---
# Checkbox Pattern

## About This Pattern

WAI-ARIA supports two types of  [checkbox](https://w3c.github.io/aria/#checkbox)  widgets: dual-state checkboxes toggle between two choices -- checked and not checked -- and tri-state checkboxes, which allow an additional third state known as partially checked.

One common use of a tri-state checkbox can be found in software installers where a single tri-state checkbox is used to represent and control the state of an entire group of install options. And, each option in the group can be individually turned on or off with a dual state checkbox.

-   If all options in the group are checked, the overall state is represented by the tri-state checkbox displaying as checked.
-   If some of the options in the group are checked, the overall state is represented with the tri-state checkbox displaying as partially checked.
-   If none of the options in the group are checked, the overall state of the group is represented with the tri-state checkbox displaying as not checked.

The user can use the tri-state checkbox to change all options in the group with a single action:

-   Checking the overall checkbox checks all options in the group.
-   Unchecking the overall checkbox will uncheck all options in the group.
-   And, In some implementations, the system may remember which options were checked the last time the overall status was partially checked. If this feature is provided, activating the overall checkbox a third time recreates that partially checked state where only some options in the group are checked.

![](images/checkbox.svg)

## Examples

-   [Checkbox (Two-State) Example](checkbox.example.md): Demonstrates a simple 2-state checkbox.
-   [Checkbox (Mixed-State) Example](checkbox-mixed.example.md): Demonstrates a checkbox that uses the mixed value for aria-checked to reflect and control checked states within a group of two-state HTML checkboxes contained in an HTML  `fieldset`.

## Keyboard Interaction

When the checkbox has focus, pressing the  Space  key changes the state of the checkbox.

## WAI-ARIA Roles, States, and Properties

-   The checkbox has role  [checkbox](https://w3c.github.io/aria/#checkbox).
-   The checkbox has an accessible label provided by one of the following:
    -   Visible text content contained within the element with role  `checkbox`.
    -   A visible label referenced by the value of  [aria-labelledby](https://w3c.github.io/aria/#aria-labelledby)  set on the element with role  `checkbox`.
    -   [aria-label](https://w3c.github.io/aria/#aria-label)  set on the element with role  `checkbox`.
-   When checked, the checkbox element has state  [aria-checked](https://w3c.github.io/aria/#aria-checked)  set to  `true`.
-   When not checked, it has state  [aria-checked](https://w3c.github.io/aria/#aria-checked)  set to  `false`.
-   When partially checked, it has state  [aria-checked](https://w3c.github.io/aria/#aria-checked)  set to  `mixed`.
-   If a set of checkboxes is presented as a logical group with a visible label, the checkboxes are included in an element with role  [group](https://w3c.github.io/aria/#group)  that has the property  [aria-labelledby](https://w3c.github.io/aria/#aria-labelledby)  set to the ID of the element containing the label.
-   If the presentation includes additional descriptive static text relevant to a checkbox or checkbox group, the checkbox or checkbox group has the property  [aria-describedby](https://w3c.github.io/aria/#aria-describedby)  set to the ID of the element containing the description.

