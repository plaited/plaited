---
source: https://www.w3.org/WAI/ARIA/apg/patterns/carousel/

---

# Carousel (Slide Show or Image Rotator) Pattern

## About This Pattern

A carousel presents a set of items, referred to as slides, by sequentially displaying a subset of one or more slides. Typically, one slide is displayed at a time, and users can activate a next or previous slide control that hides the current slide and "rotates" the next or previous slide into view. In some implementations, rotation automatically starts when the page loads, and it may also automatically stop once all the slides have been displayed. While a slide may contain any type of content, image carousels where each slide contains nothing more than a single image are common.

Ensuring all users can easily control and are not adversely affected by slide rotation is an essential aspect of making carousels accessible. For instance, the screen reader experience can be confusing and disorienting if slides that are not visible on screen are incorrectly hidden, e.g., displayed off-screen. Similarly, if slides rotate automatically and a screen reader user is not aware of the rotation, the user may read an element on slide one, execute the screen reader command for next element, and, instead of hearing the next element on slide one, hear an element from slide 2 without any knowledge that the element just announced is from an entirely new context.

Features needed to provide sufficient rotation control include:

-   Buttons for displaying the previous and next slides.
-   Optionally, a control, or group of controls, for choosing a specific slide to display. For example, slide picker controls can be marked up as tabs in a tablist with the slide represented by a tabpanel element.
-   If the carousel can automatically rotate, it also:
    -   Has a button for stopping and restarting rotation. This is particularly important for supporting assistive technologies operating in a mode that does not move either keyboard focus or the mouse.
    -   Stops rotating when keyboard focus enters the carousel. It does not restart unless the user explicitly requests it to do so.
    -   Stops rotating whenever the mouse is hovering over the carousel.

![](images/carousel.svg)

## Examples

-   [Auto-Rotating Image Carousel with Buttons for Slide Control:](carousel-1-prev-next.example.md)  A basic image carousel that demonstrates the accessibility features necessary for carousels that rotate automatically on page load and also enables users to choose which slide is displayed with buttons for previous and next slide.
-   [Auto-Rotating Image Carousel with Tabs for Slide Control:](carousel-2-tablist.example.md)  An image carousel that demonstrates accessibility features necessary for carousels that rotate automatically on page load and also enables users to choose which slide is displayed with a set of tabs.

## Terms

The following terms are used to describe components of a carousel.

Slide

A single content container within a set of content containers that hold the content to be presented by the carousel.

Rotation Control

An interactive element that stops and starts automatic slide rotation.

Next Slide Control

An interactive element, often styled as an arrow, that displays the next slide in the rotation sequence.

Previous Slide Control

An interactive element, often styled as an arrow, that displays the previous slide in the rotation sequence.

Slide Picker Controls

A group of elements, often styled as small dots, that enable the user to pick a specific slide in the rotation sequence to display.

## Keyboard Interaction

-   If the carousel has an auto-rotate feature, automatic slide rotation stops when any element in the carousel receives keyboard focus. It does not resume unless the user activates the rotation control.
-   Tab  and  Shift + Tab: Move focus through the interactive elements of the carousel as specified by the page tab sequence -- scripting for  Tab  is not necessary.
-   Button elements implement the keyboard interaction defined in the  [button pattern](button.md). Note: Activating the rotation control, next slide, and previous slide do not move focus, so users may easily repetitively activate them as many times as desired.
-   If present, the rotation control is the first element in the  Tab  sequence inside the carousel. It is essential that it precede the rotating content so it can be easily located.
-   If tab elements are used for slide picker controls, they implement the keyboard interaction defined in the  [Tabs Pattern.](tabs.md)

## WAI-ARIA Roles, States, and Properties

This section describes the element composition for three styles of carousels:

-   Basic: Has rotation, previous slide, and next slide controls but no slide picker controls.
-   Tabbed: Has basic controls plus a single tab stop for slide picker controls implemented using the  [tabs pattern.](tabs.md)
-   Grouped: Has basic controls plus a series of tab stops in a group of slide picker controls where each control implements the  [button pattern.](button.md)  Because each slide selector button adds an element to the page tab sequence, this style is the least friendly for keyboard users.

### Basic carousel elements

-   A carousel container element that encompasses all components of the carousel, including both carousel controls and slides, has either role  [region](https://w3c.github.io/aria/#region)  or role  [group.](https://w3c.github.io/aria/#group)  The most appropriate role for the carousel container depends on the information architecture of the page. See the  [Landmark Regions Practice](https://www.w3.org/WAI/ARIA/apg/practices/landmark-regions/)  to determine whether the carousel warrants being designated as a landmark region.
-   The carousel container has the  [aria-roledescription](https://w3c.github.io/aria/#aria-roledescription)  property set to  `carousel`.
-   If the carousel has a visible label, its accessible label is provided by the property  [aria-labelledby](https://w3c.github.io/aria/#aria-labelledby)  on the carousel container set to the ID of the element containing the visible label. Otherwise, an accessible label is provided by the property  [aria-label](https://w3c.github.io/aria/#aria-label)  set on the carousel container. Note that since the  `aria-roledescription`  is set to "carousel", the label does not contain the word "carousel".
-   The rotation control, next slide control, and previous slide control are either native button elements (recommended) or implement the  [button pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/).
-   The rotation control has an accessible label provided by either its inner text or  [aria-label](https://w3c.github.io/aria/#aria-label). The label changes to match the action the button will perform, e.g., "Stop slide rotation" or "Start slide rotation". A label that changes when the button is activated clearly communicates both that slide content can change automatically and when it is doing so. Note that since the label changes, the rotation control does not have any states, e.g.,  `aria-pressed`, specified.
-   Each slide container has role  [group](https://w3c.github.io/aria/#group)  with the property  [aria-roledescription](https://w3c.github.io/aria/#aria-roledescription)  set to  `slide`.
-   Each slide has an accessible name:
    -   If a slide has a visible label, its accessible label is provided by the property  [aria-labelledby](https://w3c.github.io/aria/#aria-labelledby)  on the slide container set to the ID of the element containing the visible label.
    -   Otherwise, an accessible label is provided by the property  [aria-label](https://w3c.github.io/aria/#aria-label)  set on the slide container.
    -   If unique names that identify the slide content are not available, a number and set size can serve as a meaningful alternative, e.g., "3 of 10". Note: Normally, including set position and size information in an accessible name is not appropriate. An exception is helpful in this implementation because group elements do not support  [aria-setsize](https://w3c.github.io/aria/#aria-setsize)  or  [aria-posinset](https://w3c.github.io/aria/#aria-posinset). The tabbed carousel implementation pattern does not have this limitation.
    -   Note that since the  `aria-roledescription`  is set to "slide", the label does not contain the word "slide."
-   Optionally, an element wrapping the set of slide elements has  [aria-atomic](https://w3c.github.io/aria/#aria-atomic)  set to  `false`  and  [aria-live](https://w3c.github.io/aria/#aria-live)  set to:
    -   `off`: if the carousel is automatically rotating.
    -   `polite`: if the carousel is  **NOT**  automatically rotating.

### Tabbed Carousel Elements

The structure of a tabbed carousel is the same as a basic carousel except that:

-   Each slide container has role  [tabpanel](https://w3c.github.io/aria/#tabpanel)  in lieu of  `group`, and it does not have the  `aria-roledescription`  property.
-   It has slide picker controls implemented using the  [tabs pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/)  where:
    -   Each control is a  `tab`  element, so activating a tab displays the slide associated with that tab.
    -   The accessible name of each  `tab`  indicates which slide it will display by including the name or number of the slide, e.g., "Slide 3". Slide names are preferable if each slide has a unique name.
    -   The set of controls is grouped in a  `tablist`  element with an accessible name provided by the value of  [aria-label](https://w3c.github.io/aria/#aria-label)  that identifies the purpose of the tabs, e.g., "Choose slide to display."
    -   The  `tab`,  `tablist`, and  `tabpanel`  implement the properties specified in the  [tabs pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/).

### Grouped Carousel Elements

A grouped carousel has the same structure as a basic carousel, but it also includes slide picker controls where:

-   The set of slide picker controls is contained in an element with role  [group](https://w3c.github.io/aria/#group).
-   The group containing the picker controls has an accessible label provided by the value of  [aria-label](https://w3c.github.io/aria/#aria-label)  that identifies the purpose of the controls, e.g., "Choose slide to display."
-   Each picker control is a native button element (recommended) or implements the  [button pattern.](https://www.w3.org/WAI/ARIA/apg/patterns/button/)
-   The accessible name of each picker button matches the name of the slide it displays. One technique for accomplishing this is to set  [aria-labelledby](https://w3c.github.io/aria/#aria-labelledby)  to a value that references the slide  `group`  element.
-   The picker button representing the currently displayed slide has the property  [aria-disabled](https://w3c.github.io/aria/#aria-disabled)  set to  `true`. Note:  `aria-disabled`  is preferable to the HTML  `disabled`  attribute because this is a circumstance where screen reader users benefit from the disabled button being included in the page  Tab  sequence.

