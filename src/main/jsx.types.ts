import type { CSSProperties } from './css.types.js'
import { P_TARGET, P_TRIGGER, TEMPLATE_OBJECT_IDENTIFIER } from './jsx.constants.js'

type Booleanish = boolean | 'true' | 'false'
type CrossOrigin = 'anonymous' | 'use-credentials' | ''
/**
 * Represents the internal structure produced by Plaited's JSX factory (`h` or `createTemplate`).
 * This object contains the processed HTML strings and associated metadata needed for rendering.
 *
 * @property html - An array of string fragments representing the HTML structure.
 * @property stylesheets - An array of CSS stylesheet strings collected from this template and its children.
 * @property registry - An array of custom element tag names encountered within this template
 * @property $ - A unique symbol (`TEMPLATE_OBJECT_IDENTIFIER`) used as a type guard to identify Plaited template objects.
 */
export type TemplateObject = {
  html: string[]
  stylesheets: string[]
  registry: string[]
  $: typeof TEMPLATE_OBJECT_IDENTIFIER
}
/**
 * Represents the valid primitive types that can be rendered directly as children within JSX.
 * This includes numbers (which are converted to strings) and strings. TemplateObjects are also valid children for composition.
 */
export type Child = number | string | TemplateObject
/**
 * Represents the children prop in JSX. It can be a single valid child (`Child`) or an array of children.
 */
export type Children = Child[] | Child
/**
 * Defines core attributes applicable to all elements processed by Plaited's JSX factory.
 * Includes standard HTML attributes, ARIA attributes, and Plaited-specific extensions.
 *
 * @property class - Supports standard `string` or an `array` of strings for CSS classes.
 * @property children - Represents the child elements or content.
 * @property p-target - Used to identify elements for targeted updates or interactions (value is usually a string or number).
 * @property p-trigger - Defines declarative event bindings for behavioral programming integration (maps event names to action types).
 * @property stylesheet - Accepts a CSS string or an array of strings to be associated with the element, hoisted, and deduplicated.
 * @property trusted - If `true`, disables HTML escaping for the element's attributes and children that are not TemplateObject's. Use with extreme caution, only with sanitized or known-safe content.
 * @property style - Accepts a `CSSProperties` object (similar to React) for inline styles.
 */
export type PlaitedAttributes = {
  class?: string
  children?: Children
  [P_TARGET]?: string | number
  [P_TRIGGER]?: Record<string, string>
  stylesheet?: string | string[]
  className?: string[]
  /** setting trusted to true will disable all escaping security policy measures for this element template */
  trusted?: boolean
  style?: CSSProperties
}

/** Defines WAI-ARIA attributes for accessibility. */
type AriaAttributes = {
  /** Identifies the currently active element when DOM focus is on a composite widget, textbox, group, or application. */
  'aria-activedescendant'?: string
  /** Indicates whether assistive technologies will present all, or only parts of, the changed region based on the change notifications defined by the aria-relevant attribute. */
  'aria-atomic'?: Booleanish
  /**
   * Indicates whether inputting text could trigger display of one or more predictions of the user's intended value for an input and specifies how predictions would be
   * presented if they are made.
   */
  'aria-autocomplete'?: 'none' | 'inline' | 'list' | 'both'
  /** Indicates an element is being modified and that assistive technologies MAY want to wait until the modifications are complete before exposing them to the user. */
  /**
   * Defines a string value that labels the current element, which is intended to be converted into Braille.
   * @see aria-label.
   */
  'aria-braillelabel'?: string
  /**
   * Defines a human-readable, author-localized abbreviated description for the role of an element, which is intended to be converted into Braille.
   * @see aria-roledescription.
   */
  'aria-brailleroledescription'?: string
  'aria-busy'?: Booleanish
  /**
   * Indicates the current "checked" state of checkboxes, radio buttons, and other widgets.
   * @see aria-pressed @see aria-selected.
   */
  'aria-checked'?: boolean | 'false' | 'mixed' | 'true'
  /**
   * Defines the total number of columns in a table, grid, or treegrid.
   * @see aria-colindex.
   */
  'aria-colcount'?: number
  /**
   * Defines an element's column index or position with respect to the total number of columns within a table, grid, or treegrid.
   * @see aria-colcount @see aria-colspan.
   */
  'aria-colindex'?: number
  /**
   * Defines a human readable text alternative of aria-colindex.
   * @see aria-rowindextext.
   */
  'aria-colindextext'?: string
  /**
   * Defines the number of columns spanned by a cell or gridcell within a table, grid, or treegrid.
   * @see aria-colindex @see aria-rowspan.
   */
  'aria-colspan'?: number
  /**
   * Identifies the element (or elements) whose contents or presence are controlled by the current element.
   * @see aria-owns.
   */
  'aria-controls'?: string
  /** Indicates the element that represents the current item within a container or set of related elements. */
  'aria-current'?: boolean | 'false' | 'true' | 'page' | 'step' | 'location' | 'date' | 'time'
  /**
   * Identifies the element (or elements) that describes the object.
   * @see aria-labelledby
   */
  'aria-describedby'?: string
  /**
   * Defines a string value that describes or annotates the current element.
   * @see related aria-describedby.
   */
  'aria-description'?: string
  /**
   * Identifies the element that provides a detailed, extended description for the object.
   * @see aria-describedby.
   */
  'aria-details'?: string
  /**
   * Indicates that the element is perceivable but disabled, so it is not editable or otherwise operable.
   * @see aria-hidden @see aria-readonly.
   */
  'aria-disabled'?: Booleanish
  /**
   * Identifies the element that provides an error message for the object.
   * @see aria-invalid @see aria-describedby.
   */
  'aria-errormessage'?: string
  /** Indicates whether the element, or another grouping element it controls, is currently expanded or collapsed. */
  'aria-expanded'?: Booleanish
  /**
   * Identifies the next element (or elements) in an alternate reading order of content which, at the user's discretion,
   * allows assistive technology to override the general default of reading in document source order.
   */
  'aria-flowto'?: string
  /** Indicates the availability and type of interactive popup element, such as menu or dialog, that can be triggered by an element. */
  'aria-haspopup'?: boolean | 'false' | 'true' | 'menu' | 'listbox' | 'tree' | 'grid' | 'dialog'
  /**
   * Indicates whether the element is exposed to an accessibility API.
   * @see aria-disabled.
   */
  'aria-hidden'?: Booleanish
  /**
   * Indicates the entered value does not conform to the format expected by the application.
   * @see aria-errormessage.
   */
  'aria-invalid'?: boolean | 'false' | 'true' | 'grammar' | 'spelling'
  /** Indicates keyboard shortcuts that an author has implemented to activate or give focus to an element. */
  'aria-keyshortcuts'?: string
  /**
   * Defines a string value that labels the current element.
   * @see aria-labelledby.
   */
  'aria-label'?: string
  /**
   * Identifies the element (or elements) that labels the current element.
   * @see aria-describedby.
   */
  'aria-labelledby'?: string
  /** Defines the hierarchical level of an element within a structure. */
  'aria-level'?: number
  /** Indicates that an element will be updated, and describes the types of updates the user agents, assistive technologies, and user can expect from the live region. */
  'aria-live'?: 'off' | 'assertive' | 'polite'
  /** Indicates whether an element is modal when displayed. */
  'aria-modal'?: Booleanish
  /** Indicates whether a text box accepts multiple lines of input or only a single line. */
  'aria-multiline'?: Booleanish
  /** Indicates that the user may select more than one item from the current selectable descendants. */
  'aria-multiselectable'?: Booleanish
  /** Indicates whether the element's orientation is horizontal, vertical, or unknown/ambiguous. */
  'aria-orientation'?: 'horizontal' | 'vertical'
  /**
   * Identifies an element (or elements) in order to define a visual, functional, or contextual parent/child relationship
   * between DOM elements where the DOM hierarchy cannot be used to represent the relationship.
   * @see aria-controls.
   */
  'aria-owns'?: string
  /**
   * Defines a short hint (a word or short phrase) intended to aid the user with data entry when the control has no value.
   * A hint could be a sample value or a brief description of the expected format.
   */
  'aria-placeholder'?: string
  /**
   * Defines an element's number or position in the current set of listitems or treeitems. Not required if all elements in the set are present in the DOM.
   * @see aria-setsize.
   */
  'aria-posinset'?: number
  /**
   * Indicates the current "pressed" state of toggle buttons.
   * @see aria-checked @see aria-selected.
   */
  'aria-pressed'?: boolean | 'false' | 'mixed' | 'true'
  /**
   * Indicates that the element is not editable, but is otherwise operable.
   * @see aria-disabled.
   */
  'aria-readonly'?: Booleanish
  /**
   * Indicates what notifications the user agent will trigger when the accessibility tree within a live region is modified.
   * @see aria-atomic.
   */
  'aria-relevant'?:
    | 'additions'
    | 'additions removals'
    | 'additions text'
    | 'all'
    | 'removals'
    | 'removals additions'
    | 'removals text'
    | 'text'
    | 'text additions'
    | 'text removals'
  /** Indicates that user input is required on the element before a form may be submitted. */
  'aria-required'?: Booleanish
  /** Defines a human-readable, author-localized description for the role of an element. */
  'aria-roledescription'?: string
  /**
   * Defines the total number of rows in a table, grid, or treegrid.
   * @see aria-rowindex.
   */
  'aria-rowcount'?: number
  /**
   * Defines an element's row index or position with respect to the total number of rows within a table, grid, or treegrid.
   * @see aria-rowcount @see aria-rowspan.
   */
  'aria-rowindex'?: number
  /**
   * Defines a human readable text alternative of aria-rowindex.
   * @see aria-colindextext.
   */
  'aria-rowindextext'?: string
  /**
   * Defines the number of rows spanned by a cell or gridcell within a table, grid, or treegrid.
   * @see aria-rowindex @see aria-colspan.
   */
  'aria-rowspan'?: number
  /**
   * Indicates the current "selected" state of various widgets.
   * @see aria-checked @see aria-pressed.
   */
  'aria-selected'?: Booleanish
  /**
   * Defines the number of items in the current set of listitems or treeitems. Not required if all elements in the set are present in the DOM.
   * @see aria-posinset.
   */
  'aria-setsize'?: number
  /** Indicates if items in a table or grid are sorted in ascending or descending order. */
  'aria-sort'?: 'none' | 'ascending' | 'descending' | 'other'
  /** Defines the maximum allowed value for a range widget. */
  'aria-valuemax'?: number
  /** Defines the minimum allowed value for a range widget. */
  'aria-valuemin'?: number
  /**
   * Defines the current value for a range widget.
   * @see aria-valuetext.
   */
  'aria-valuenow'?: number
  /** Defines the human readable text alternative of aria-valuenow for a range widget. */
  'aria-valuetext'?: string
}

/** Defines allowed values for the ARIA `role` attribute. */
type AriaRole =
  | 'alert'
  | 'alertdialog'
  | 'application'
  | 'article'
  | 'banner'
  | 'button'
  | 'cell'
  | 'checkbox'
  | 'columnheader'
  | 'combobox'
  | 'complementary'
  | 'contentinfo'
  | 'definition'
  | 'dialog'
  | 'directory'
  | 'document'
  | 'feed'
  | 'figure'
  | 'form'
  | 'grid'
  | 'gridcell'
  | 'group'
  | 'heading'
  | 'img'
  | 'link'
  | 'list'
  | 'listbox'
  | 'listitem'
  | 'log'
  | 'main'
  | 'marquee'
  | 'math'
  | 'menu'
  | 'menubar'
  | 'menuitem'
  | 'menuitemcheckbox'
  | 'menuitemradio'
  | 'navigation'
  | 'none'
  | 'note'
  | 'option'
  | 'presentation'
  | 'progressbar'
  | 'radio'
  | 'radiogroup'
  | 'region'
  | 'row'
  | 'rowgroup'
  | 'rowheader'
  | 'scrollbar'
  | 'search'
  | 'searchbox'
  | 'separator'
  | 'slider'
  | 'spinbutton'
  | 'status'
  | 'switch'
  | 'tab'
  | 'table'
  | 'tablist'
  | 'tabpanel'
  | 'term'
  | 'textbox'
  | 'timer'
  | 'toolbar'
  | 'tooltip'
  | 'tree'
  | 'treegrid'
  | 'treeitem'

/** Base HTML attributes common to most elements, including ARIA attributes and Plaited-specific ones. */
type HTMLAttributes = AriaAttributes &
  PlaitedAttributes & {
    // Standard HTML Attributes
    accesskey?: string
    autofocus?: boolean
    contenteditable?: Booleanish | 'inherit' | 'plaintext-only'
    dir?: string
    draggable?: Booleanish
    hidden?: boolean
    id?: string | number
    lang?: string
    nonce?: string
    placeholder?: string
    slot?: string
    spellcheck?: Booleanish
    tabindex?: number
    title?: string
    translate?: 'yes' | 'no'

    // WAI-ARIA
    role?: AriaRole

    // RDFa Attributes
    about?: string
    content?: string
    datatype?: string
    prefix?: string
    property?: string
    rel?: string
    resource?: string
    rev?: string
    typeof?: string
    vocab?: string

    // Non-standard Attributes
    autocapitalize?: 'off' | 'none' | 'on' | 'sentences' | 'words' | 'characters'
    autocorrect?: 'on' | 'off'
    autosave?: string
    itemprop?: string
    itemscope?: boolean
    itemtype?: string
    itemid?: string
    itemref?: string
    results?: number
    security?: string

    // Living Standard
    /**
     * Hints at the type of data that might be entered by the user while editing the element or its contents
     * @see https://html.spec.whatwg.org/multipage/interaction.html#input-modalities:-the-inputmode-attribute
     */
    inputmode?: 'none' | 'text' | 'tel' | 'url' | 'email' | 'numeric' | 'decimal' | 'search'
    /**
     * Specify that a standard HTML element should behave like a defined custom built-in element
     * @see https://html.spec.whatwg.org/multipage/custom-elements.html#attr-is
     */
    is?: string
  }

/**
 * Represents detailed HTML attributes, including standard HTML, ARIA, Plaited-specific,
 * and allowing for any custom `data-*` or other attributes via `Record<string, any>`.
 * This is the base type often extended for specific HTML elements.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DetailedHTMLAttributes = HTMLAttributes & Record<string, any>

/** HTML attribute type for the `referrerpolicy` attribute. */
type HTMLAttributeReferrerPolicy =
  | ''
  | 'no-referrer'
  | 'no-referrer-when-downgrade'
  | 'origin'
  | 'origin-when-cross-origin'
  | 'same-origin'
  | 'strict-origin'
  | 'strict-origin-when-cross-origin'
  | 'unsafe-url'

/** HTML attribute type for the anchor `target` attribute. */
type HTMLAttributeAnchorTarget = '_self' | '_blank' | '_parent' | '_top'

/** Detailed attributes specific to the `<a>` (anchor) element. */
type DetailedAnchorHTMLAttributes = DetailedHTMLAttributes & {
  download?: boolean
  href?: string
  hreflang?: string
  media?: string
  ping?: string
  target?: HTMLAttributeAnchorTarget
  type?: string
  referrerpolicy?: HTMLAttributeReferrerPolicy
}

/** Detailed attributes specific to the `<audio>` element. */
type DetailedAudioHTMLAttributes = DetailedMediaHTMLAttributes

/** Detailed attributes specific to the `<area>` element. */
type DetailedAreaHTMLAttributes = DetailedHTMLAttributes & {
  alt?: string
  coords?: string
  download?: boolean
  href?: string
  hreflang?: string
  media?: string
  referrerpolicy?: HTMLAttributeReferrerPolicy
  shape?: string
  target?: string
}

/** Detailed attributes specific to the `<base>` element. */
type DetailedBaseHTMLAttributes = DetailedHTMLAttributes & {
  href?: string
  target?: string
}

/** Detailed attributes specific to the `<blockquote>` element. */
type DetailedBlockquoteHTMLAttributes = DetailedHTMLAttributes & {
  cite?: string
}

/** Detailed attributes specific to the `<button>` element. */
type DetailedButtonHTMLAttributes = DetailedHTMLAttributes & {
  disabled?: boolean
  form?: string
  formaction?: string
  formenctype?: string
  formmethod?: string
  formnovalidate?: boolean
  formtarget?: string
  name?: string
  type?: 'submit' | 'reset' | 'button'
  value?: string | number
}

/** Detailed attributes specific to the `<canvas>` element. */
type DetailedCanvasHTMLAttributes = DetailedHTMLAttributes & {
  height?: number | string
  width?: number | string
}

/** Detailed attributes specific to the `<col>` element. */
type DetailedColHTMLAttributes = DetailedHTMLAttributes & {
  span?: number
  width?: number | string
}

/** Detailed attributes specific to the `<colgroup>` element. */
type DetailedColgroupHTMLAttributes = DetailedHTMLAttributes & {
  span?: number
}

/** Detailed attributes specific to the `<data>` element. */
type DetailedDataHTMLAttributes = DetailedHTMLAttributes & {
  value?: string | number
}

/** Detailed attributes specific to the `<details>` element. */
type DetailedDetailsHTMLAttributes = DetailedHTMLAttributes & {
  open?: boolean
}

/** Detailed attributes specific to the `<del>` element. */
type DetailedDelHTMLAttributes = DetailedHTMLAttributes & {
  cite?: string
  datetime?: string
}

/** Detailed attributes specific to the `<dialog>` element. */
type DetailedDialogHTMLAttributes = DetailedHTMLAttributes & {
  open?: boolean
}

/** Detailed attributes specific to the `<embed>` element. */
type DetailedEmbedHTMLAttributes = DetailedHTMLAttributes & {
  height?: number | string
  src?: string
  type?: string
  width?: number | string
}

/** Detailed attributes specific to the `<fieldset>` element. */
type DetailedFieldsetHTMLAttributes = DetailedHTMLAttributes & {
  disabled?: boolean
  form?: string
  name?: string
}

/** Detailed attributes specific to the `<form>` element. */
type DetailedFormHTMLAttributes = DetailedHTMLAttributes & {
  'accept-charset'?: string
  action?: string
  autocomplete?: string
  enctype?: string
  method?: string
  name?: string
  novalidate?: boolean
  target?: string
}

/** Detailed attributes specific to the `<html>` element. */
type DetailedHtmlHTMLAttributes = DetailedHTMLAttributes & {
  manifest?: string
}

/** Detailed attributes specific to the `<iframe>` element. */
type DetailedIframeHTMLAttributes = DetailedHTMLAttributes & {
  allow?: string
  height?: number | string
  loading?: 'eager' | 'lazy'
  name?: string
  referrerpolicy?: HTMLAttributeReferrerPolicy
  sandbox?: string
  seamless?: boolean
  src?: string
  srcdoc?: string
  width?: number | string
}

/** Detailed attributes specific to the `<img>` element. */
type DetailedImgHTMLAttributes = DetailedHTMLAttributes & {
  alt?: string
  crossorigin?: CrossOrigin
  decoding?: 'async' | 'auto' | 'sync'
  height?: number | string
  loading?: 'eager' | 'lazy'
  referrerpolicy?: HTMLAttributeReferrerPolicy
  sizes?: string
  src?: string
  srcset?: string
  usemap?: string
  width?: number | string
}

/** Detailed attributes specific to the `<ins>` element. */
type DetailedInsHTMLAttributes = DetailedHTMLAttributes & {
  cite?: string
  datetime?: string
}

/** Defines allowed values for the input `type` attribute. */
type HTMLInputTypeAttribute =
  | 'button'
  | 'checkbox'
  | 'color'
  | 'date'
  | 'datetime-local'
  | 'email'
  | 'file'
  | 'hidden'
  | 'image'
  | 'month'
  | 'number'
  | 'password'
  | 'radio'
  | 'range'
  | 'reset'
  | 'search'
  | 'submit'
  | 'tel'
  | 'text'
  | 'time'
  | 'url'
  | 'week'

/** Detailed attributes specific to the `<input>` element. */
type DetailedInputHTMLAttributes = DetailedHTMLAttributes & {
  accept?: string
  alt?: string
  autocomplete?: string
  capture?: boolean | 'user' | 'environment' // https://www.w3.org/TR/html-media-capture/#the-capture-attribute
  checked?: boolean
  disabled?: boolean
  enterkeyhint?: 'enter' | 'done' | 'go' | 'next' | 'previous' | 'search' | 'send'
  form?: string
  formaction?: string
  formenctype?: string
  formmethod?: string
  formnovalidate?: boolean
  formtarget?: string
  height?: number | string
  list?: string
  max?: number | string
  maxlength?: number
  min?: number | string
  minlength?: number
  multiple?: boolean
  name?: string
  pattern?: string
  placeholder?: string
  readonly?: boolean
  required?: boolean
  size?: number
  src?: string
  step?: number | string
  type?: HTMLInputTypeAttribute
  value?: string | number
  width?: number | string
}

/** Detailed attributes specific to the `<label>` element */
type DetailedLabelHTMLAttributes = DetailedHTMLAttributes & {
  form?: string
  for?: string
}

/** Detailed attributes specific to the `<li>` element. */
type DetailedLiHTMLAttributes = DetailedHTMLAttributes & {
  value?: string | number
}

/** Detailed attributes specific to the `<link>` element. */
type DetailedLinkHTMLAttributes = DetailedHTMLAttributes & {
  as?: string
  crossorigin?: CrossOrigin
  fetchPriority?: 'high' | 'low' | 'auto'
  href?: string
  hreflang?: string
  integrity?: string
  media?: string
  imagesrcset?: string
  imagesizes?: string
  referrerpolicy?: HTMLAttributeReferrerPolicy
  sizes?: string
  type?: string
  charSet?: string
}

/** Detailed attributes specific to the `<map>` element. */
type DetailedMapHTMLAttributes = DetailedHTMLAttributes & {
  name?: string
}

/** Detailed attributes specific to the `<menu>` element. */
type DetailedMenuHTMLAttributes = DetailedHTMLAttributes & {
  type?: string
}

/** Detailed attributes common to media elements like `<audio>` and `<video>`. */
type DetailedMediaHTMLAttributes = DetailedHTMLAttributes & {
  autoplay?: boolean
  controls?: boolean
  controlslist?: string
  crossorigin?: CrossOrigin
  loop?: boolean
  mediagroup?: string
  muted?: boolean
  playsinline?: boolean
  preload?: string
  src?: string
}

/** Detailed attributes specific to the `<meta>` element. */
type DetailedMetaHTMLAttributes = DetailedHTMLAttributes & {
  charset?: string
  'http-equiv'?: string
  name?: string
  media?: string
  content?: string
}

/** Detailed attributes specific to the `<meter>` element. */
type DetailedMeterHTMLAttributes = DetailedHTMLAttributes & {
  form?: string
  high?: number
  low?: number
  max?: number | string
  min?: number | string
  optimum?: number
  value?: string | number
}

/** Detailed attributes specific to the `<q>` (quote) element. */
type DetailedQuoteHTMLAttributes = DetailedHTMLAttributes & {
  cite?: string
}

/** Detailed attributes specific to the `<object>` element. */
type DetailedObjectHTMLAttributes = DetailedHTMLAttributes & {
  classid?: string
  data?: string
  form?: string
  height?: number | string
  name?: string
  type?: string
  usemap?: string
  width?: number | string
}

/** Detailed attributes specific to the `<ol>` (ordered list) element. */
type DetailedOlHTMLAttributes = DetailedHTMLAttributes & {
  reversed?: boolean
  start?: number
  type?: '1' | 'a' | 'A' | 'i' | 'I'
}

/** Detailed attributes specific to the `<optgroup>` element. */
type DetailedOptgroupHTMLAttributes = DetailedHTMLAttributes & {
  disabled?: boolean
  label?: string
}

/** Detailed attributes specific to the `<option>` element. */
type DetailedOptionHTMLAttributes = DetailedHTMLAttributes & {
  disabled?: boolean
  label?: string
  selected?: boolean
  value?: string | number
}

/** Detailed attributes specific to the `<output>` element. */
type DetailedOutputHTMLAttributes = DetailedHTMLAttributes & {
  form?: string
  for?: string
  name?: string
}

/** Detailed attributes specific to the `<progress>` element. */
type DetailedProgressHTMLAttributes = DetailedHTMLAttributes & {
  max?: number | string
  value?: string | number
}

/** Detailed attributes specific to the `<slot>` element. */
type DetailedSlotHTMLAttributes = DetailedHTMLAttributes & {
  name?: string
}

/** Detailed attributes specific to the `<script>` element. Requires `trusted={true}` to be used. */
type DetailedScriptHTMLAttributes = DetailedHTMLAttributes & {
  async?: boolean
  crossorigin?: CrossOrigin
  defer?: boolean
  integrity?: string
  nomodule?: boolean
  referrerpolicy?: HTMLAttributeReferrerPolicy
  src?: string
  type?: string
}

/** Detailed attributes specific to the `<select>` element. */
type DetailedSelectHTMLAttributes = DetailedHTMLAttributes & {
  autocomplete?: string
  disabled?: boolean
  form?: string
  multiple?: boolean
  name?: string
  required?: boolean
  size?: number
  value?: string | number
}

/** Detailed attributes specific to the `<source>` element. */
type DetailedSourceHTMLAttributes = DetailedHTMLAttributes & {
  height?: number | string
  media?: string
  sizes?: string
  src?: string
  srcset?: string
  type?: string
  width?: number | string
}

/** Detailed attributes specific to the `<style>` element. */
type DetailedStyleHTMLAttributes = DetailedHTMLAttributes & {
  media?: string
}

/** Detailed attributes specific to the `<table>` element. */
type DetailedTableHTMLAttributes = DetailedHTMLAttributes & {
  align?: 'left' | 'center' | 'right'
  bgcolor?: string
  border?: number
  cellpadding?: number | string
  cellspacing?: number | string
  frame?: boolean
  rules?: 'none' | 'groups' | 'rows' | 'columns' | 'all'
  summary?: string
  width?: number | string
}

/** Detailed attributes specific to the `<template>` element, including declarative shadow DOM attributes. */
type DetailedTemplateHTMLAttributes = DetailedHTMLAttributes & {
  shadowrootmode?: 'open' | 'closed'
  shadowrootdelegatesfocus?: boolean
}

/** Detailed attributes specific to the `<textarea>` element. */
type DetailedTextareaHTMLAttributes = DetailedHTMLAttributes & {
  autocomplete?: string
  cols?: number
  dirname?: string
  disabled?: boolean
  form?: string
  maxlength?: number
  minlength?: number
  name?: string
  placeholder?: string
  readonly?: boolean
  required?: boolean
  rows?: number
  value?: string | number
  wrap?: string
}

/** Detailed attributes specific to the `<td>` (table data) element. */
type DetailedTdHTMLAttributes = DetailedHTMLAttributes & {
  align?: 'left' | 'center' | 'right' | 'justify' | 'char'
  colspan?: number
  headers?: string
  rowspan?: number
  scope?: string
  abbr?: string
  height?: string
  width?: string
  valign?: 'top' | 'middle' | 'bottom' | 'baseline'
}

/** Detailed attributes specific to the `<th>` (table header) element. */
type DetailedThHTMLAttributes = DetailedHTMLAttributes & {
  align?: 'left' | 'center' | 'right' | 'justify' | 'char'
  colspan?: number
  headers?: string
  rowspan?: number
  scope?: string
  abbr?: string
}

/** Detailed attributes specific to the `<time>` element. */
type DetailedTimeHTMLAttributes = DetailedHTMLAttributes & {
  datetime?: string
}

/** Detailed attributes specific to the `<track>` element. */
type DetailedTrackHTMLAttributes = DetailedHTMLAttributes & {
  default?: boolean
  kind?: 'subtitles' | 'captions' | 'descriptions' | 'chapters' | 'metadata'
  label?: string
  src?: string
  srclang?: string
}

/** Detailed attributes specific to the `<video>` element. */
type DetailedVideoHTMLAttributes = DetailedMediaHTMLAttributes & {
  height?: string
  playsinline?: boolean
  poster?: string
  width?: string
  disablepictureinpicture?: boolean
  disableremoteplayback?: boolean
}

/** Detailed attributes for SVG elements, extending base HTML attributes. */
export type DetailedSVGAttributes = DetailedHTMLAttributes & {
  'accent-height'?: number
  accumulate?: 'none' | 'sum' | string
  additive?: 'replace' | 'sum' | string
  'alignment-baseline'?:
    | 'auto'
    | 'baseline'
    | 'before-edge'
    | 'text-before-edge'
    | 'middle'
    | 'central'
    | 'after-edge'
    | 'text-after-edge'
    | 'ideographic'
    | 'alphabetic'
    | 'hanging'
    | 'mathematical'
    | 'inherit'
    | string
  allowReorder?: 'no' | 'yes' | string
  amplitude?: number | string
  attributeName?: string
  attributeType?: string
  autoReverse?: Booleanish
  azimuth?: number
  baseFrequency?: number | string
  'baseline-shift'?: 'sub' | 'super' | number | string
  baseProfile?: string
  begin?: number | string
  bias?: number | string
  by?: number | string
  calcMode?: 'discrete' | 'linear' | 'paced' | 'spline' | string
  'clip-path'?: string
  'clip-rule'?: 'nonzero' | 'evenodd' | 'inherit' | string
  clipPathUnits?: 'userSpaceOnUse' | 'objectBoundingBox' | string
  color?: string
  'color-interpolation'?: 'auto' | 'sRGB' | 'linearRGB' | 'inherit' | string
  'color-interpolation-filters'?: string
  'color-rendering'?: number | string
  contentScriptType?: string
  contentStyleType?: string
  cursor?: string
  cx?: string
  cy?: string
  d?: string
  decoding?: 'sync' | 'async' | 'auto' | string
  diffuseConstant?: number | string
  direction?: 'ltr' | 'rtl' | string
  display?: string
  divisor?: number | string
  'dominant-baseline'?:
    | 'auto'
    | 'text-bottom'
    | 'alphabetic'
    | 'ideographic'
    | 'middle'
    | 'central'
    | 'mathematical'
    | 'hanging'
    | 'text-top'
    | string
  dur?: 'media' | 'indefinite' | number | string
  dx?: number | string
  dy?: number | number | string
  edgeMode?: string
  elevation?: number | string
  end?: string
  exponent?: number | string
  fill?: string
  'fill-opacity'?: number | string
  'fill-rule'?: 'nonzero' | 'evenodd' | 'inherit' | string
  filter?: string
  filterRes?: number | string
  filterUnits?: 'userSpaceOnUse' | 'objectBoundingBox' | string
  'flood-color'?: string
  'flood-opacity'?: number | string
  focusable?: Booleanish | 'auto'
  'font-family'?: string
  'font-size'?: string
  'font-size-adjust'?: string
  'font-stretch'?: string
  'font-style'?: string
  'font-variant'?: string
  'font-weight'?: string
  fr?: string
  from?: string
  fx?: string
  fy?: string
  gradientTransform?: string
  gradientUnits?: 'userSpaceOnUse' | 'objectBoundingBox' | string
  height?: number | string
  href?: string
  id?: string | number
  'image-rendering'?: 'auto' | 'optimizeSpeed' | 'optimizeQuality' | string
  in?: 'SourceGraphic' | 'SourceAlpha' | 'BackgroundImage' | 'BackgroundAlpha' | 'FillPaint' | 'StrokePaint' | string
  in2?: 'SourceGraphic' | 'SourceAlpha' | 'BackgroundImage' | 'BackgroundAlpha' | 'FillPaint' | 'StrokePaint' | string
  intercept?: number | string
  k1?: number | string
  k2?: number | string
  k3?: number | string
  k4?: number | string
  kernelMatrix?: string
  kernelUnitLength?: string
  keyPoints?: string
  keySplines?: string
  keyTimes?: string
  lang?: string
  lengthAdjust?: 'spacing' | 'spacingAndGlyphs' | string
  'letter-spacing'?: number | string
  'lighting-color'?: string
  limitingConeAngle?: number | string
  'marker-end'?: string
  'marker-mid'?: string
  'marker-start'?: string
  markerHeight?: string | number
  markerUnits?: 'userSpaceOnUse' | 'strokeWidth' | string
  markerWidth?: string | number
  mask?: string
  maskContentUnits?: 'userSpaceOnUse' | 'objectBoundingBox' | string
  maskUnits?: 'userSpaceOnUse' | 'objectBoundingBox' | string
  max?: string
  media?: string
  method?: 'align' | 'stretch'
  min?: string
  mode?: string
  numOctaves?: number | string
  offset?: string
  opacity?: number | string
  operator?: string
  order?: number | string
  orient?: number | string
  origin?: string
  overflow?: 'visible' | 'hidden' | 'scroll' | 'auto' | string
  'overline-position'?: number | string
  'overline-thickness'?: number | string
  'paint-order'?: string
  path?: string
  pathLength?: number | string
  patternContentUnits?: 'userSpaceOnUse' | 'objectBoundingBox' | string
  patternTransform?: string
  patternUnits?: 'userSpaceOnUse' | 'objectBoundingBox' | string
  'pointer-events'?:
    | 'bounding-box'
    | 'visiblePainted'
    | 'visibleFill'
    | 'visibleStroke'
    | 'visible'
    | 'painted'
    | 'fill'
    | 'stroke'
    | 'all'
    | 'none'
    | string
  points?: string
  pointsAtX?: number | string
  pointsAtY?: number | string
  pointsAtZ?: number | string
  preserveAlpha?: 'true' | 'false'
  preserveAspectRatio?: string
  primitiveUnits?: 'userSpaceOnUse' | 'objectBoundingBox' | string
  r?: number | string
  radius?: number | string
  referrerpolicy?: string
  refX?: number | string
  refY?: number | string
  repeatCount?: 'indefinite' | number | string
  repeatDur?: 'indefinite' | string
  restart?: 'always' | 'whenNotActive' | 'never' | string
  result?: string
  rotate?: 'auto' | 'auto-reverse' | number | string
  rx?: number | string
  ry?: number | string
  scale?: number | string
  seed?: number | string
  'shape-rendering'?: 'auto' | 'optimizeSpeed' | 'crispEdges' | 'geometricPrecision' | string
  spacing?: 'auto' | 'exact'
  specularConstant?: number | string
  specularExponent?: number | string
  spreadMethod?: 'pad' | 'reflect' | 'repeat' | string
  startOffset?: number | string
  stdDeviation?: number | string
  stitchTiles?: 'noStitch' | 'stitch' | string
  'stop-color'?: string
  'stop-opacity'?: number | string
  'strikethrough-position'?: number | string
  'strikethrough-thickness'?: number | string
  stroke?: string
  'stroke-dasharray'?: string
  'stroke-dashoffset'?: number | string
  'stroke-linecap'?: 'butt' | 'round' | 'square' | 'inherit' | string
  'stroke-linejoin'?: 'arcs' | 'bevel' | 'miter' | 'miter-clip' | 'round' | 'inherit' | string
  'stroke-miterlimit'?: number | string
  'stroke-opacity'?: number | string
  'stroke-width'?: number | string
  surfaceScale?: number | string
  systemLanguage?: string
  tableValues?: string
  targetX?: number | string
  targetY?: number | string
  'text-anchor'?: 'start' | 'middle' | 'end' | string
  'text-decoration'?: string
  'text-rendering'?: 'auto' | 'optimizeSpeed' | 'optimizeLegibility' | 'geometricPrecision' | string
  textLength?: number | string
  to?: number | string
  transform?: string
  'transform-origin'?: string
  type?: string
  'underline-position'?: number | string
  'underline-thickness'?: number | string
  values?: string
  'vector-effect'?: 'none' | 'non-scaling-stroke' | 'non-scaling-size' | 'non-rotation' | 'fixed-position' | string
  viewBox?: string
  visibility?: 'visible' | 'hidden' | 'collapse' | string
  width?: number | string
  'word-spacing'?: number | string
  'writing-mode'?: 'horizontal-tb' | 'vertical-rl' | 'vertical-lr' | string
  x?: number | string
  x1?: number | string
  x2?: number | string
  xChannelSelector?: 'R' | 'G' | 'B' | 'A' | string
  y?: number | string
  y1?: number | string
  y2?: number | string
  yChannelSelector?: 'R' | 'G' | 'B' | 'A' | string
  z?: number | string
}

/** Detailed attributes specific to the Electron `<webview>` tag. */
type DetailedWebViewHTMLAttributes = DetailedHTMLAttributes & {
  src?: string
  nodeintegration?: boolean
  nodeintegrationinsubframes?: boolean
  plugins?: boolean
  preload?: string
  httpreferrer?: string
  useragent?: string
  disablewebsecurity?: boolean
  partition?: string
  allowpopups?: boolean
  webpreferences?: string
  enableblinkfeatures?: string
  disableblinkfeatures?: string
}
/**
 * A comprehensive mapping of intrinsic HTML and SVG element tag names
 * to their corresponding detailed attribute types (`Detailed*HTMLAttributes` or `DetailedSVGAttributes`).
 * This is used by TypeScript's JSX type checking (`JSX.IntrinsicElements`) to validate attributes passed to elements.
 * It also allows for arbitrary string keys to accommodate custom elements, mapping them to `DetailedHTMLAttributes`.
 */
export type ElementAttributeList = {
  a: DetailedAnchorHTMLAttributes
  abbr: DetailedHTMLAttributes
  address: DetailedHTMLAttributes
  area: DetailedAreaHTMLAttributes
  article: DetailedHTMLAttributes
  aside: DetailedHTMLAttributes
  audio: DetailedAudioHTMLAttributes
  b: DetailedHTMLAttributes
  base: DetailedBaseHTMLAttributes
  bdi: DetailedHTMLAttributes
  bdo: DetailedHTMLAttributes
  big: DetailedHTMLAttributes
  blockquote: DetailedBlockquoteHTMLAttributes
  body: DetailedHTMLAttributes
  br: DetailedHTMLAttributes
  button: DetailedButtonHTMLAttributes
  canvas: DetailedCanvasHTMLAttributes
  caption: DetailedHTMLAttributes
  cite: DetailedHTMLAttributes
  code: DetailedHTMLAttributes
  col: DetailedColHTMLAttributes
  colgroup: DetailedColgroupHTMLAttributes
  data: DetailedDataHTMLAttributes
  datalist: DetailedHTMLAttributes
  dd: DetailedHTMLAttributes
  del: DetailedDelHTMLAttributes
  details: DetailedDetailsHTMLAttributes
  dfn: DetailedHTMLAttributes
  dialog: DetailedDialogHTMLAttributes
  div: DetailedHTMLAttributes
  dl: DetailedHTMLAttributes
  dt: DetailedHTMLAttributes
  em: DetailedHTMLAttributes
  embed: DetailedEmbedHTMLAttributes
  fieldset: DetailedFieldsetHTMLAttributes
  figcaption: DetailedHTMLAttributes
  figure: DetailedHTMLAttributes
  footer: DetailedHTMLAttributes
  form: DetailedFormHTMLAttributes
  h1: DetailedHTMLAttributes
  h2: DetailedHTMLAttributes
  h3: DetailedHTMLAttributes
  h4: DetailedHTMLAttributes
  h5: DetailedHTMLAttributes
  h6: DetailedHTMLAttributes
  head: DetailedHTMLAttributes
  header: DetailedHTMLAttributes
  hgroup: DetailedHTMLAttributes
  hr: DetailedHTMLAttributes
  html: DetailedHtmlHTMLAttributes
  i: DetailedHTMLAttributes
  iframe: DetailedIframeHTMLAttributes
  img: DetailedImgHTMLAttributes
  input: DetailedInputHTMLAttributes
  ins: DetailedInsHTMLAttributes
  kbd: DetailedHTMLAttributes
  label: DetailedLabelHTMLAttributes
  legend: DetailedHTMLAttributes
  li: DetailedLiHTMLAttributes
  link: DetailedLinkHTMLAttributes
  main: DetailedHTMLAttributes
  map: DetailedMapHTMLAttributes
  mark: DetailedHTMLAttributes
  menu: DetailedMenuHTMLAttributes
  menuitem: DetailedHTMLAttributes
  meta: DetailedMetaHTMLAttributes
  meter: DetailedMeterHTMLAttributes
  nav: DetailedHTMLAttributes
  noscript: DetailedHTMLAttributes
  object: DetailedObjectHTMLAttributes
  ol: DetailedOlHTMLAttributes
  optgroup: DetailedOptgroupHTMLAttributes
  option: DetailedOptionHTMLAttributes
  output: DetailedOutputHTMLAttributes
  p: DetailedHTMLAttributes
  picture: DetailedHTMLAttributes
  pre: DetailedHTMLAttributes
  progress: DetailedProgressHTMLAttributes
  q: DetailedQuoteHTMLAttributes
  rp: DetailedHTMLAttributes
  rt: DetailedHTMLAttributes
  ruby: DetailedHTMLAttributes
  s: DetailedHTMLAttributes
  samp: DetailedHTMLAttributes
  script: DetailedScriptHTMLAttributes
  search: DetailedHTMLAttributes
  section: DetailedHTMLAttributes
  select: DetailedSelectHTMLAttributes
  slot: DetailedSlotHTMLAttributes
  small: DetailedHTMLAttributes
  source: DetailedSourceHTMLAttributes
  span: DetailedHTMLAttributes
  strong: DetailedHTMLAttributes
  style: DetailedStyleHTMLAttributes
  sub: DetailedHTMLAttributes
  summary: DetailedHTMLAttributes
  sup: DetailedHTMLAttributes
  table: DetailedTableHTMLAttributes
  template: DetailedTemplateHTMLAttributes
  tbody: DetailedHTMLAttributes
  td: DetailedTdHTMLAttributes
  textarea: DetailedTextareaHTMLAttributes
  tfoot: DetailedHTMLAttributes
  th: DetailedThHTMLAttributes
  thead: DetailedHTMLAttributes
  time: DetailedTimeHTMLAttributes
  title: DetailedHTMLAttributes
  tr: DetailedHTMLAttributes
  track: DetailedTrackHTMLAttributes
  u: DetailedHTMLAttributes
  ul: DetailedHTMLAttributes
  var: DetailedHTMLAttributes
  video: DetailedVideoHTMLAttributes
  wbr: DetailedHTMLAttributes
  webview: DetailedWebViewHTMLAttributes
  //SVG
  svg: DetailedSVGAttributes
  animate: DetailedSVGAttributes
  circle: DetailedSVGAttributes
  animateMotion: DetailedSVGAttributes
  animateTransform: DetailedSVGAttributes
  clipPath: DetailedSVGAttributes
  defs: DetailedSVGAttributes
  desc: DetailedSVGAttributes
  ellipse: DetailedSVGAttributes
  feBlend: DetailedSVGAttributes
  feColorMatrix: DetailedSVGAttributes
  feComponentTransfer: DetailedSVGAttributes
  feComposite: DetailedSVGAttributes
  feConvolveMatrix: DetailedSVGAttributes
  feDiffuseLighting: DetailedSVGAttributes
  feDisplacementMap: DetailedSVGAttributes
  feDistantLight: DetailedSVGAttributes
  feDropShadow: DetailedSVGAttributes
  feFlood: DetailedSVGAttributes
  feFuncA: DetailedSVGAttributes
  feFuncB: DetailedSVGAttributes
  feFuncG: DetailedSVGAttributes
  feFuncR: DetailedSVGAttributes
  feGaussianBlur: DetailedSVGAttributes
  feImage: DetailedSVGAttributes
  feMerge: DetailedSVGAttributes
  feMergeNode: DetailedSVGAttributes
  feMorphology: DetailedSVGAttributes
  feOffset: DetailedSVGAttributes
  fePointLight: DetailedSVGAttributes
  feSpecularLighting: DetailedSVGAttributes
  feSpotLight: DetailedSVGAttributes
  feTile: DetailedSVGAttributes
  feTurbulence: DetailedSVGAttributes
  filter: DetailedSVGAttributes
  foreignObject: DetailedSVGAttributes
  g: DetailedSVGAttributes
  image: DetailedSVGAttributes
  line: DetailedSVGAttributes
  linearGradient: DetailedSVGAttributes
  marker: DetailedSVGAttributes
  mask: DetailedSVGAttributes
  metadata: DetailedSVGAttributes
  mpath: DetailedSVGAttributes
  path: DetailedSVGAttributes
  pattern: DetailedSVGAttributes
  polygon: DetailedSVGAttributes
  polyline: DetailedSVGAttributes
  radialGradient: DetailedSVGAttributes
  rect: DetailedSVGAttributes
  set: DetailedSVGAttributes
  stop: DetailedSVGAttributes
  switch: DetailedSVGAttributes
  symbol: DetailedSVGAttributes
  text: DetailedSVGAttributes
  textPath: DetailedSVGAttributes
  tspan: DetailedSVGAttributes
  use: DetailedSVGAttributes
  view: DetailedSVGAttributes
  [key: string]: DetailedHTMLAttributes // Allows custom element tags
}
/**
 * Generic type for component attributes/props.
 * It combines the base `DetailedHTMLAttributes` (providing standard HTML/ARIA/Plaited attributes)
 * with an optional generic type `T` for component-specific properties.
 *
 * @template T An optional type extending `DetailedHTMLAttributes` to include custom props for a component. Defaults to `DetailedHTMLAttributes`.
 */
export type Attrs<T extends DetailedHTMLAttributes = DetailedHTMLAttributes> = DetailedHTMLAttributes & T
/**
 * Defines the signature for a Plaited functional component template.
 * A functional component is a function that accepts an `Attrs` object (props)
 * and returns a `TemplateObject`.
 *
 * @template T The type of the props object accepted by the component, extending `Attrs`. Defaults to `Attrs`.
 * @param attrs The props object passed to the component during rendering. Includes standard attributes, Plaited attributes, and custom props defined by `T`.
 * @returns A `TemplateObject` representing the component's rendered output.
 */
export type FunctionTemplate<T extends Attrs = Attrs> = (attrs: T & PlaitedAttributes) => TemplateObject
/**
 * Shorthand alias for `FunctionTemplate`.
 *
 * @see FunctionTemplate
 */
export type FT<T extends Attrs = Attrs> = FunctionTemplate<T>
/**
 * Represents the string pattern for a valid custom element tag name.
 * Custom element names must contain at least one hyphen (`-`).
 */
export type CustomElementTag = `${string}-${string}`
