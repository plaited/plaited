---
source: https://www.w3.org/WAI/ARIA/apg/patterns/alertdialog/

---

# Alert and Message Dialogs Pattern

## About This Pattern

An alert dialog is a  [modal dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)  that interrupts the user's workflow to communicate an important message and acquire a response. Examples include action confirmation prompts and error message confirmations. The  [alertdialog](https://w3c.github.io/aria/#alertdialog)  role enables assistive technologies and browsers to distinguish alert dialogs from other dialogs so they have the option of giving alert dialogs special treatment, such as playing a system alert sound.

![](images/alertdialog.svg)

## Example

[Alert Dialog Example](alertdialog.example.md): A confirmation prompt that demonstrates an alert dialog.

## Keyboard Interaction

See the keyboard interaction section for the  [modal dialog pattern](dialog-modal.md).

## WAI-ARIA Roles, States, and Properties

-   The element that contains all elements of the dialog, including the alert message and any dialog buttons, has role  [alertdialog](https://w3c.github.io/aria/#alertdialog).
-   The element with role  `alertdialog`  has either:
    -   A value for  [aria-labelledby](https://w3c.github.io/aria/#aria-labelledby)  that refers to the element containing the title of the dialog if the dialog has a visible label.
    -   A value for  [aria-label](https://w3c.github.io/aria/#aria-label)  if the dialog does not have a visible label.
-   The element with role  `alertdialog`  has a value set for  [aria-describedby](https://w3c.github.io/aria/#aria-describedby)  that refers to the element containing the alert message.

