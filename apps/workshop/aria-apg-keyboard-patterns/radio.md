---
source: https://www.w3.org/WAI/ARIA/apg/patterns/radio/

---
# Radio Group Pattern

## About This Pattern

A radio group is a set of checkable buttons, known as radio buttons, where no more than one of the buttons can be checked at a time. Some implementations may initialize the set with all buttons in the unchecked state in order to force the user to check one of the buttons before moving past a certain point in the workflow.

![](images/radio.svg)

## Examples

-   [Radio Group Example Using Roving tabindex](radio.example.md)
-   [Radio Group Example Using aria-activedescendant](radio-activedescendant.example.md)
-   [Rating Radio Group Example](radio-rating.example.md): Radio group that provides input for a five-star rating scale.

## Keyboard Interaction

### For Radio Groups Not Contained in a Toolbar

This section describes the keyboard interaction implemented for most radio groups. For the special case of a radio group nested inside a  [toolbar](toolbar.md), use the keyboard interaction described in the following section.

-   Tab  and  Shift + Tab: Move focus into and out of the radio group. When focus moves into a radio group:
    -   If a radio button is checked, focus is set on the checked button.
    -   If none of the radio buttons are checked, focus is set on the first radio button in the group.
-   Space: checks the focused radio button if it is not already checked.
-   Right Arrow  and  Down Arrow: move focus to the next radio button in the group, uncheck the previously focused button, and check the newly focused button. If focus is on the last button, focus moves to the first button.
-   Left Arrow  and  Up Arrow: move focus to the previous radio button in the group, uncheck the previously focused button, and check the newly focused button. If focus is on the first button, focus moves to the last button.

### Note

The initial focus behavior described above differs slightly from the behavior provided by some browsers for native HTML radio groups. In some browsers, if none of the radio buttons are selected, moving focus into the radio group with  Shift+Tab  will place focus on the last radio button instead of the first radio button.

### For Radio Group Contained in a Toolbar

Because arrow keys are used to navigate among elements of a toolbar and the  Tab  key moves focus in and out of a toolbar, when a radio group is nested inside a toolbar, the keyboard interaction of the radio group is slightly different from that of a radio group that is not inside of a toolbar. For instance, users need to be able to navigate among all toolbar elements, including the radio buttons, without changing which radio button is checked. So, when navigating through a radio group in a toolbar with arrow keys, the button that is checked does not change. The keyboard interaction of a radio group nested in a toolbar is as follows.

-   Space: If the focused radio button is not checked, unchecks the currently checked radio button and checks the focused radio button. Otherwise, does nothing.
-   Enter  (optional): If the focused radio button is not checked, unchecks the currently checked radio button and checks the focused radio button. Otherwise, does nothing.
-   Right Arrow:
    -   When focus is on a radio button and that radio button is  **not**  the last radio button in the radio group, moves focus to the next radio button.
    -   When focus is on the last radio button in the radio group and that radio button is  **not**  the last element in the toolbar, moves focus to the next element in the toolbar.
    -   When focus is on the last radio button in the radio group and that radio button is also the last element in the toolbar, moves focus to the first element in the toolbar.
-   Left Arrow:
    -   When focus is on a radio button and that radio button is  **not**  the first radio button in the radio group, moves focus to the previous radio button.
    -   When focus is on the first radio button in the radio group and that radio button is  **not**  the first element in the toolbar, moves focus to the previous element in the toolbar.
    -   When focus is on the first radio button in the radio group and that radio button is also the first element in the toolbar, moves focus to the last element in the toolbar.
-   Down Arrow  (optional): Moves focus to the next radio button in the radio group. If focus is on the last radio button in the radio group, moves focus to the first radio button in the group.
-   Up Arrow  (optional): Moves focus to the previous radio button in the radio group. If focus is on the first radio button in the radio group, moves focus to the last radio button in the group.

#### Note

Radio buttons in a toolbar are frequently styled in a manner that appears more like toggle buttons. For an example, See the  [Simple Editor Toolbar Example](toolbar.example.md).

## WAI-ARIA Roles, States, and Properties

-   The radio buttons are contained in or owned by an element with role  [radiogroup](https://w3c.github.io/aria/#radiogroup).
-   Each radio button element has role  [radio](https://w3c.github.io/aria/#radio).
-   If a radio button is checked, the  `radio`  element has  [aria-checked](https://w3c.github.io/aria/#aria-checked)  set to  `true`. If it is not checked, it has  [aria-checked](https://w3c.github.io/aria/#aria-checked)  set to  `false`.
-   Each  `radio`  element is labelled by its content, has a visible label referenced by  [aria-labelledby](https://w3c.github.io/aria/#aria-labelledby), or has a label specified with  [aria-label](https://w3c.github.io/aria/#aria-label).
-   The  `radiogroup`  element has a visible label referenced by  [aria-labelledby](https://w3c.github.io/aria/#aria-labelledby)  or has a label specified with  [aria-label](https://w3c.github.io/aria/#aria-label).
-   If elements providing additional information about either the radio group or each radio button are present, those elements are referenced by the  `radiogroup`  element or  `radio`  elements with the  [aria-describedby](https://w3c.github.io/aria/#aria-describedby)  property.

