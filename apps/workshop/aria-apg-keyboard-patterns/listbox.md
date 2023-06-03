---
source: https://www.w3.org/WAI/ARIA/apg/patterns/listbox/

---
# Listbox Pattern

## About This Pattern

A  [listbox](https://w3c.github.io/aria/#listbox)  widget presents a list of options and allows a user to select one or more of them. A listbox that allows a single option to be chosen is a single-select listbox; one that allows multiple options to be selected is a multi-select listbox.

When screen readers present a listbox, they may render the name, state, and position of each option in the list. The name of an option is a string calculated by the browser, typically from the content of the option element. As a flat string, the name does not contain any semantic information. Thus, if an option contains a semantic element, such as a heading, screen reader users will not have access to the semantics. In addition, the interaction model conveyed by the listbox role to assistive technologies does not support interacting with elements inside of an option. Because of these traits of the listbox widget, it does not provide an accessible way to present a list of interactive elements, such as links, buttons, or checkboxes. To present a list of interactive elements, see the  [Grid Pattern](grid.md).

Avoiding very long option names facilitates understandability and perceivability for screen reader users. The entire name of an option is spoken as a single unit of speech when the option is read. When too much information is spoken as the result of a single key press, it is difficult to understand. Long names inhibit perception by increasing the impact of interrupted speech because users typically have to re-read the entire option. And, if the user does not understand what is spoken, reading the name by character, word, or phrase may be a difficult operation for many screen reader users in the context of a listbox widget.

Sets of options where each option name starts with the same word or phrase can also significantly degrade usability for keyboard and screen reader users. Scrolling through the list to find a specific option becomes inordinately time consuming for a screen reader user who must listen to that word or phrase repeated before hearing what is unique about each option. For example, if a listbox for choosing a city were to contain options where each city name were preceded by a country name, and if many cities were listed for each country, a screen reader user would have to listen to the country name before hearing each city name. In such a scenario, it would be better to have 2 list boxes, one for country and one for city.

![](images/listbox.svg)

## Examples

-   [Scrollable Listbox Example](listbox-scrollable.example.md): Single-select listbox that scrolls to reveal more options, similar to HTML  `select`  with  `size`  attribute greater than one.
-   [Example Listboxes with Rearrangeable Options](listbox-rearrangeable.example.md): Examples of both single-select and multi-select listboxes with accompanying toolbars where options can be added, moved, and removed.
-   [Listbox Example with Grouped Options](listbox-grouped.example.md): Single-select listbox with grouped options, similar to an HTML  `select`  with  `optgroup`  children.

## Keyboard Interaction

For a vertically oriented listbox:

-   When a single-select listbox receives focus:
    -   If none of the options are selected before the listbox receives focus, the first option receives focus. Optionally, the first option may be automatically selected.
    -   If an option is selected before the listbox receives focus, focus is set on the selected option.
-   When a multi-select listbox receives focus:
    -   If none of the options are selected before the listbox receives focus, focus is set on the first option and there is no automatic change in the selection state.
    -   If one or more options are selected before the listbox receives focus, focus is set on the first option in the list that is selected.
-   Down Arrow: Moves focus to the next option. Optionally, in a single-select listbox, selection may also move with focus.
-   Up Arrow: Moves focus to the previous option. Optionally, in a single-select listbox, selection may also move with focus.
-   Home  (Optional): Moves focus to first option. Optionally, in a single-select listbox, selection may also move with focus. Supporting this key is strongly recommended for lists with more than five options.
-   End  (Optional): Moves focus to last option. Optionally, in a single-select listbox, selection may also move with focus. Supporting this key is strongly recommended for lists with more than five options.
-   Type-ahead is recommended for all listboxes, especially those with more than seven options:
    -   Type a character: focus moves to the next item with a name that starts with the typed character.
    -   Type multiple characters in rapid succession: focus moves to the next item with a name that starts with the string of characters typed.
-   **Multiple Selection**: Authors may implement either of two interaction models to support multiple selection: a recommended model that does not require the user to hold a modifier key, such as  Shift  or  Control, while navigating the list or an alternative model that does require modifier keys to be held while navigating in order to avoid losing selection states.
    -   Recommended selection model -- holding modifier keys is not necessary:
        -   Space: changes the selection state of the focused option.
        -   Shift + Down Arrow  (Optional): Moves focus to and toggles the selected state of the next option.
        -   Shift + Up Arrow  (Optional): Moves focus to and toggles the selected state of the previous option.
        -   Shift + Space  (Optional): Selects contiguous items from the most recently selected item to the focused item.
        -   Control + Shift + Home  (Optional): Selects the focused option and all options up to the first option. Optionally, moves focus to the first option.
        -   Control + Shift + End  (Optional): Selects the focused option and all options down to the last option. Optionally, moves focus to the last option.
        -   Control + A  (Optional): Selects all options in the list. Optionally, if all options are selected, it may also unselect all options.
    -   Alternative selection model -- moving focus without holding a  Shift  or  Control  modifier unselects all selected options except the focused option:
        -   Shift + Down Arrow: Moves focus to and toggles the selection state of the next option.
        -   Shift + Up Arrow: Moves focus to and toggles the selection state of the previous option.
        -   Control + Down Arrow: Moves focus to the next option without changing its selection state.
        -   Control + Up Arrow: Moves focus to the previous option without changing its selection state.
        -   Control + Space  Changes the selection state of the focused option.
        -   Shift + Space  (Optional): Selects contiguous items from the most recently selected item to the focused item.
        -   Control + Shift + Home  (Optional): Selects the focused option and all options up to the first option. Optionally, moves focus to the first option.
        -   Control + Shift + End  (Optional): Selects the focused option and all options down to the last option. Optionally, moves focus to the last option.
        -   Control + A  (Optional): Selects all options in the list. Optionally, if all options are selected, it may also unselect all options.

### Note

1.  DOM focus (the active element) is functionally distinct from the selected state. For more details, see  [this description of differences between focus and selection](keyboard-interface.md#kbd_focus_vs_selection).
2.  The  `listbox`  role supports the  [aria-activedescendant](https://w3c.github.io/aria/#aria-activedescendant)  property, which provides an alternative to moving DOM focus among  `option`  elements when implementing keyboard navigation. For details, see  [Managing Focus in Composites Using aria-activedescendant](keyboard-interface.md#kbd_focus_activedescendant).
3.  In a single-select listbox, moving focus may optionally unselect the previously selected option and select the newly focused option. This model of selection is known as "selection follows focus". Having selection follow focus can be very helpful in some circumstances and can severely degrade accessibility in others. For additional guidance, see  [Deciding When to Make Selection Automatically Follow Focus](keyboard-interface.md#kbd_selection_follows_focus).
4.  If selecting or unselecting all options is an important function, implementing separate controls for these actions, such as buttons for "Select All" and "Unselect All", significantly improves accessibility.
5.  If the options in a listbox are arranged horizontally:
    1.  Down Arrow  performs as  Right Arrow  is described above, and vice versa.
    2.  Up Arrow  performs as  Left Arrow  is described above, and vice versa.

## WAI-ARIA Roles, States, and Properties

-   An element that contains or owns all the listbox options has role  [listbox](https://w3c.github.io/aria/#listbox).
-   Each option in the listbox has role  [option](https://w3c.github.io/aria/#option)  and is contained in or owned by either:
    -   The element with role  `listbox`.
    -   An element with role  [group](https://w3c.github.io/aria/#group)  that is contained in or owned by the element with role  `listbox`.
-   Options contained in a  `group`  are referred to as  grouped options  and form what is called an  option group.  If a listbox contains grouped options, then:
    -   All option groups contain at least one option.
    -   Each option group has an accessible name provided via  [aria-label](https://w3c.github.io/aria/#aria-label)  or  [aria-labelledby](https://w3c.github.io/aria/#aria-labelledby).
-   If the element with role  `listbox`  is not part of another widget, such as a combobox, then it has either a visible label referenced by  [aria-labelledby](https://w3c.github.io/aria/#aria-labelledby)  or a value specified for  [aria-label](https://w3c.github.io/aria/#aria-label).
-   If the listbox supports selection of more than one option, the element with role  `listbox`  has  [aria-multiselectable](https://w3c.github.io/aria/#aria-multiselectable)  set to  `true`. Otherwise,  `aria-multiselectable`  is either set to  `false`  or the default value of  `false`  is implied.
-   The selection state of each selectable option is indicated with either  [aria-selected](https://w3c.github.io/aria/#aria-selected)  or  [aria-checked](https://w3c.github.io/aria/#aria-checked):
    -   If the selection state is indicated with  `aria-selected`, then  `aria-checked`  is not specified for any options. Alternatively, if the selection state is indicated with  `aria-checked`, then  `aria-selected`  is not specified for any options. See notes below regarding considerations for which property to use and for details of the unusual conditions that might allow for both properties in the same listbox.
    -   If any options are selected, each selected option has either  [aria-selected](https://w3c.github.io/aria/#aria-selected)  or  [aria-checked](https://w3c.github.io/aria/#aria-checked)  set to  `true`. No more than one option is selected at a time if the element with role  `listbox`  does  _not_  have  [aria-multiselectable](https://w3c.github.io/aria/#aria-multiselectable)  set to  `true`.
    -   All options that are selectable but not selected have either  [aria-selected](https://w3c.github.io/aria/#aria-selected)  or  [aria-checked](https://w3c.github.io/aria/#aria-checked)  set to  `false`.
    -   Note that except in listboxes where selection follows focus, the selected state is distinct from focus. For more details, see  [this description of differences between focus and selection](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/#kbd_focus_vs_selection)  and  [Deciding When to Make Selection Automatically Follow Focus](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/#kbd_selection_follows_focus).
-   If the complete set of available options is not present in the DOM due to dynamic loading as the user scrolls, their  [aria-setsize](https://w3c.github.io/aria/#aria-setsize)  and  [aria-posinset](https://w3c.github.io/aria/#aria-posinset)  attributes are set appropriately.
-   If options are arranged horizontally, the element with role  `listbox`  has  [aria-orientation](https://w3c.github.io/aria/#aria-orientation)  set to  `horizontal`. The default value of  `aria-orientation`  for  `listbox`  is  `vertical`.

### Note

1.  Some factors to consider when choosing whether to indicate selection with  `aria-selected`  or  `aria-checked`  are:
    -   Some design systems use  `aria-selected`  for single-select widgets and  `aria-checked`  for multi-select widgets. In the absence of factors that would make an alternative convention more appropriate, this is a recommended convention.
    -   The language of instructions and the appearance of the interface might suggest one attribute is more appropriate than the other. For instance, do instructions say to  select  items? Or, is the visual indicator of selection a check mark?
    -   It is important to adopt a consistent convention for selection models across a site or app.
2.  Conditions that would permit a listbox to include both  `aria-selected`  and  `aria-checked`  are extremely rare. It is strongly recommended to avoid designing a listbox widget that would have the need for more than one type of state. If both states were to be used within a listbox, all the following conditions need to be satisfied:
    -   The meaning and purpose of  `aria-selected`  is different from the meaning and purpose of  `aria-checked`  in the user interface.
    -   The user interface makes the meaning and purpose of each state apparent.
    -   The user interface provides a separate method for controlling each state.
3.  If  [aria-owns](https://w3c.github.io/aria/#aria-owns)  is set on the listbox element to include elements that are not DOM children of the container, those elements will appear in the reading order in the sequence they are referenced and after any items that are DOM children. Scripts that manage focus need to ensure the visual focus order matches this assistive technology reading order.

