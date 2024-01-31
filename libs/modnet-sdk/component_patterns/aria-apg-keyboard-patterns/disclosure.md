---
source: https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/

---
# Disclosure (Show/Hide) Pattern

## About This Pattern

A disclosure is a widget that enables content to be either collapsed (hidden) or expanded (visible). It has two elements: a disclosure  [button](button.md)  and a section of content whose visibility is controlled by the button. When the controlled content is hidden, the button is often styled as a typical push button with a right-pointing arrow or triangle to hint that activating the button will display additional content. When the content is visible, the arrow or triangle typically points down.

![](images/disclosure.svg)

## Examples

-   [Disclosure (Show/Hide) of Image Description](disclosure-image-description.md)
-   [Disclosure (Show/Hide) of Answers to Frequently Asked Questions](disclosure-faq.example.md)
-   [Disclosure (Show/Hide) Navigation Menu](disclosure-navigation.example.md)
-   [Disclosure (Show/Hide) Navigation Menu with Top-Level Links](disclosure-navigation-hybrid.example.md)

## Keyboard Interaction

When the disclosure control has focus:

-   Enter: activates the disclosure control and toggles the visibility of the disclosure content.
-   Space: activates the disclosure control and toggles the visibility of the disclosure content.

## WAI-ARIA Roles, States, and Properties

-   The element that shows and hides the content has role  [button](https://w3c.github.io/aria/#button).
-   When the content is visible, the element with role  `button`  has  [aria-expanded](https://w3c.github.io/aria/#aria-expanded)  set to  `true`. When the content area is hidden, it is set to  `false`.
-   Optionally, the element with role  `button`  has a value specified for  [aria-controls](https://w3c.github.io/aria/#aria-controls)  that refers to the element that contains all the content that is shown or hidden.

