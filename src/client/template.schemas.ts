/**
 * @internal
 * @module template.schemas
 *
 * Zod schemas for HTML/SVG attribute validation.
 * Converts hand-written types in `template.types.ts` into runtime-validatable
 * schemas for agent-generated component catalog entries (see `UI-GENERATION-PATTERNS.md` §3.4).
 *
 * @remarks
 * Each exported schema ends in `Schema` with a paired `z.output<>` type alias.
 * The schema is the source of truth for validated shapes; type aliases are derived.
 *
 * @see {@link https://ui-generation-patterns#34-the-catalog-json-shapes}
 */

import * as z from 'zod'
import type { CSSProperties } from './css.types.ts'
import {
  CHILDREN,
  CLASS,
  CUSTOM_ELEMENT_TAG_PATTERN,
  P_FORM,
  P_SCALE,
  P_TARGET,
  P_TRIGGER,
  SCALE,
  STYLE,
  STYLES,
  TEMPLATE_OBJECT_IDENTIFIER,
} from './template.constants.ts'

// ── Internal helper schemas (not exported) ────────────────────────────────

/**
 * Booleanish — `boolean | 'true' | 'false'`.
 * @internal
 */
const booleanishSchema = z.union([z.boolean(), z.enum(['true', 'false'])])

/**
 * Cross-origin attribute value.
 * @internal
 */
const crossOriginSchema = z.enum(['anonymous', 'use-credentials', ''])

/**
 * Anchor target attribute values.
 * @internal
 */
const anchorTargetSchema = z.enum(['_self', '_blank', '_parent', '_top'])

/**
 * Referrer policy attribute values.
 * @internal
 */
const referrerPolicySchema = z.enum([
  '',
  'no-referrer',
  'no-referrer-when-downgrade',
  'origin',
  'origin-when-cross-origin',
  'same-origin',
  'strict-origin',
  'strict-origin-when-cross-origin',
  'unsafe-url',
])

/**
 * Input `type` attribute values.
 * @internal
 */
const inputTypeSchema = z.enum([
  'button',
  'checkbox',
  'color',
  'date',
  'datetime-local',
  'email',
  'file',
  'hidden',
  'image',
  'month',
  'number',
  'password',
  'radio',
  'range',
  'reset',
  'search',
  'submit',
  'tel',
  'text',
  'time',
  'url',
  'week',
])

/**
 * Placeholder schema for CSSProperties until a dedicated CSS schemas file exists.
 * Type-constrained to match the CSSProperties type from css.types.ts.
 * @internal
 */
const cssPropertiesSchema: z.ZodType<CSSProperties> = z.record(z.string(), z.union([z.string(), z.number()]))

/**
 * Minimal schema for a resolved StylesObject — classNames + stylesheets.
 * @internal
 */
const stylesObjectSchema = z.object({
  classNames: z.array(z.string()).optional(),
  stylesheets: z.array(z.string()),
})

// ── ARIA ───────────────────────────────────────────────────────────────────

const AriaAttributesSchema = z.object({
  'aria-activedescendant': z.string().optional(),
  'aria-atomic': booleanishSchema.optional(),
  'aria-autocomplete': z.enum(['none', 'inline', 'list', 'both']).optional(),
  'aria-braillelabel': z.string().optional(),
  'aria-brailleroledescription': z.string().optional(),
  'aria-busy': booleanishSchema.optional(),
  'aria-checked': z.union([z.boolean(), z.enum(['false', 'mixed', 'true'])]).optional(),
  'aria-colcount': z.number().optional(),
  'aria-colindex': z.number().optional(),
  'aria-colindextext': z.string().optional(),
  'aria-colspan': z.number().optional(),
  'aria-controls': z.string().optional(),
  'aria-current': z
    .union([z.boolean(), z.enum(['false', 'true', 'page', 'step', 'location', 'date', 'time'])])
    .optional(),
  'aria-describedby': z.string().optional(),
  'aria-description': z.string().optional(),
  'aria-details': z.string().optional(),
  'aria-disabled': booleanishSchema.optional(),
  'aria-errormessage': z.string().optional(),
  'aria-expanded': booleanishSchema.optional(),
  'aria-flowto': z.string().optional(),
  'aria-haspopup': z
    .union([z.boolean(), z.enum(['false', 'true', 'menu', 'listbox', 'tree', 'grid', 'dialog'])])
    .optional(),
  'aria-hidden': booleanishSchema.optional(),
  'aria-invalid': z.union([z.boolean(), z.enum(['false', 'true', 'grammar', 'spelling'])]).optional(),
  'aria-keyshortcuts': z.string().optional(),
  'aria-label': z.string().optional(),
  'aria-labelledby': z.string().optional(),
  'aria-level': z.number().optional(),
  'aria-live': z.enum(['off', 'assertive', 'polite']).optional(),
  'aria-modal': booleanishSchema.optional(),
  'aria-multiline': booleanishSchema.optional(),
  'aria-multiselectable': booleanishSchema.optional(),
  'aria-orientation': z.enum(['horizontal', 'vertical']).optional(),
  'aria-owns': z.string().optional(),
  'aria-placeholder': z.string().optional(),
  'aria-posinset': z.number().optional(),
  'aria-pressed': z.union([z.boolean(), z.enum(['false', 'mixed', 'true'])]).optional(),
  'aria-readonly': booleanishSchema.optional(),
  'aria-relevant': z
    .enum([
      'additions',
      'additions removals',
      'additions text',
      'all',
      'removals',
      'removals additions',
      'removals text',
      'text',
      'text additions',
      'text removals',
    ])
    .optional(),
  'aria-required': booleanishSchema.optional(),
  'aria-roledescription': z.string().optional(),
  'aria-rowcount': z.number().optional(),
  'aria-rowindex': z.number().optional(),
  'aria-rowindextext': z.string().optional(),
  'aria-rowspan': z.number().optional(),
  'aria-selected': booleanishSchema.optional(),
  'aria-setsize': z.number().optional(),
  'aria-sort': z.enum(['none', 'ascending', 'descending', 'other']).optional(),
  'aria-valuemax': z.number().optional(),
  'aria-valuemin': z.number().optional(),
  'aria-valuenow': z.number().optional(),
  'aria-valuetext': z.string().optional(),
})

/**
 * Schema for custom element tag names (must match `${string}-${string}` pattern).
 *
 * @public
 */
export const customElementTagSchema = z.string().regex(CUSTOM_ELEMENT_TAG_PATTERN)

/** @public */
export type CustomElementTag = `${string}-${string}`

const ariaRoleSchema = z.enum([
  'alert',
  'alertdialog',
  'application',
  'article',
  'banner',
  'button',
  'cell',
  'checkbox',
  'columnheader',
  'combobox',
  'complementary',
  'contentinfo',
  'definition',
  'dialog',
  'directory',
  'document',
  'feed',
  'figure',
  'form',
  'grid',
  'gridcell',
  'group',
  'heading',
  'img',
  'link',
  'list',
  'listbox',
  'listitem',
  'log',
  'main',
  'marquee',
  'math',
  'menu',
  'menubar',
  'menuitem',
  'menuitemcheckbox',
  'menuitemradio',
  'navigation',
  'none',
  'note',
  'option',
  'presentation',
  'progressbar',
  'radio',
  'radiogroup',
  'region',
  'row',
  'rowgroup',
  'rowheader',
  'scrollbar',
  'search',
  'searchbox',
  'separator',
  'slider',
  'spinbutton',
  'status',
  'switch',
  'tab',
  'table',
  'tablist',
  'tabpanel',
  'term',
  'textbox',
  'timer',
  'toolbar',
  'tooltip',
  'tree',
  'treegrid',
  'treeitem',
])

const TemplateObjectSchema = z.object({
  html: z.array(z.string()),
  stylesheets: z.array(z.string()),
  scale: z.literal(Object.values(SCALE)),
  $: z.literal(TEMPLATE_OBJECT_IDENTIFIER),
})

/**
 * Represents the internal structure produced by Plaited's JSX factory (`h`).
 * This object contains the processed HTML strings and associated metadata needed for rendering.
 *
 * @property html - An array of string fragments representing the HTML structure.
 * @property stylesheets - CSS stylesheets collected from this template and its children.
 * @property $ - A unique symbol (`TEMPLATE_OBJECT_IDENTIFIER`) used as a type guard to identify Plaited template objects.
 */
export type TemplateObject = z.output<typeof TemplateObjectSchema>

const ChildSchema = z.union([z.string(), z.number(), TemplateObjectSchema])

/**
 * Represents the valid primitive types that can be rendered directly as children within hyperscript.
 * This includes numbers (which are converted to strings) and strings. TemplateObjects are also valid children for composition.
 */
export type Child = z.output<typeof ChildSchema>

export const ChildrenSchema = z.union([ChildSchema, z.array(ChildSchema)])

/**
 * Represents the children prop in hyperscript. It can be a single valid child (`Child`) or an array of children.
 */
export type Children = z.output<typeof ChildrenSchema>

const PlaitedAttributesSchema = z.object({
  [CHILDREN]: ChildrenSchema.optional(),
  [CLASS]: z.string().optional(),
  [P_FORM]: z.string().optional(),
  [P_SCALE]: z.enum(Object.values(SCALE)).optional(),
  [P_TARGET]: z.union([z.string(), z.number()]).optional(),
  [P_TRIGGER]: z.record(z.string(), z.string()).optional(),
  [STYLE]: cssPropertiesSchema.optional(),
  [STYLES]: z.array(stylesObjectSchema).optional(),
})

/**
 * Schema for standard HTML attributes combined with ARIA and Plaited attributes.
 *
 * @public
 */
export const DetailedHTMLAttributesSchema = z
  .object({
    ...PlaitedAttributesSchema.shape,
    ...AriaAttributesSchema.shape,
    // Standard HTML Attributes
    accesskey: z.string().optional(),
    autofocus: z.boolean().optional(),
    contenteditable: z.union([booleanishSchema, z.enum(['inherit', 'plaintext-only'])]).optional(),
    dir: z.string().optional(),
    draggable: booleanishSchema.optional(),
    hidden: z.boolean().optional(),
    id: z.union([z.string(), z.number()]).optional(),
    lang: z.string().optional(),
    nonce: z.string().optional(),
    placeholder: z.string().optional(),
    slot: z.string().optional(),
    spellcheck: booleanishSchema.optional(),
    tabindex: z.number().optional(),
    title: z.string().optional(),
    translate: z.enum(['yes', 'no']).optional(),

    // WAI-ARIA
    role: ariaRoleSchema.optional(),

    // RDFa Attributes
    about: z.string().optional(),
    content: z.string().optional(),
    datatype: z.string().optional(),
    prefix: z.string().optional(),
    property: z.string().optional(),
    rel: z.string().optional(),
    resource: z.string().optional(),
    rev: z.string().optional(),
    typeof: z.string().optional(),
    vocab: z.string().optional(),

    // Non-standard Attributes
    autocapitalize: z.enum(['off', 'none', 'on', 'sentences', 'words', 'characters']).optional(),
    autocorrect: z.enum(['on', 'off']).optional(),
    autosave: z.string().optional(),
    itemprop: z.string().optional(),
    itemscope: z.boolean().optional(),
    itemtype: z.string().optional(),
    itemid: z.string().optional(),
    itemref: z.string().optional(),
    results: z.number().optional(),
    security: z.string().optional(),

    // Standard HTML attributes not covered above
    for: z.string().optional(),

    // Living Standard
    inputmode: z.enum(['none', 'text', 'tel', 'url', 'email', 'numeric', 'decimal', 'search']).optional(),
    is: z.string().optional(),
  })
  .catchall(z.union([z.string(), z.number(), z.boolean()]))

/** @public */
export type DetailedHTMLAttributes = z.output<typeof DetailedHTMLAttributesSchema>

// ── Element-specific attribute schemas ─────────────────────────────────────

/** @internal */
const DetailedAnchorHTMLAttributesSchema = z.object({
  ...DetailedHTMLAttributesSchema.shape,
  download: z.boolean().optional(),
  href: z.string().optional(),
  hreflang: z.string().optional(),
  media: z.string().optional(),
  ping: z.string().optional(),
  target: anchorTargetSchema.optional(),
  type: z.string().optional(),
  referrerpolicy: referrerPolicySchema.optional(),
})

/**
 * Schema for media element attributes (used by audio, video).
 *
 * @internal
 */
const DetailedMediaHTMLAttributesSchema = z.object({
  ...DetailedHTMLAttributesSchema.shape,
  autoplay: z.boolean().optional(),
  controls: z.boolean().optional(),
  controlslist: z.string().optional(),
  crossorigin: crossOriginSchema.optional(),
  loop: z.boolean().optional(),
  mediagroup: z.string().optional(),
  muted: z.boolean().optional(),
  playsinline: z.boolean().optional(),
  preload: z.string().optional(),
  src: z.string().optional(),
})

/** @internal */
const DetailedAreaHTMLAttributesSchema = z.object({
  ...DetailedHTMLAttributesSchema.shape,
  alt: z.string().optional(),
  coords: z.string().optional(),
  download: z.boolean().optional(),
  href: z.string().optional(),
  hreflang: z.string().optional(),
  media: z.string().optional(),
  referrerpolicy: referrerPolicySchema.optional(),
  shape: z.string().optional(),
  target: z.string().optional(),
})

/** @internal */
const DetailedBaseHTMLAttributesSchema = z.object({
  ...DetailedHTMLAttributesSchema.shape,
  href: z.string().optional(),
  target: z.string().optional(),
})

/** @internal */
const DetailedBlockquoteHTMLAttributesSchema = z.object({
  ...DetailedHTMLAttributesSchema.shape,
  cite: z.string().optional(),
})

/** @internal */
const DetailedButtonHTMLAttributesSchema = z.object({
  ...DetailedHTMLAttributesSchema.shape,
  disabled: z.boolean().optional(),
  form: z.string().optional(),
  formaction: z.string().optional(),
  formenctype: z.string().optional(),
  formmethod: z.string().optional(),
  formnovalidate: z.boolean().optional(),
  formtarget: z.string().optional(),
  name: z.string().optional(),
  type: z.enum(['submit', 'reset', 'button']).optional(),
  value: z.union([z.string(), z.number()]).optional(),
})

/** @internal */
const DetailedCanvasHTMLAttributesSchema = z.object({
  ...DetailedHTMLAttributesSchema.shape,
  height: z.union([z.number(), z.string()]).optional(),
  width: z.union([z.number(), z.string()]).optional(),
})

/** @internal */
const DetailedColHTMLAttributesSchema = z.object({
  ...DetailedHTMLAttributesSchema.shape,
  span: z.number().optional(),
  width: z.union([z.number(), z.string()]).optional(),
})

const DetailedColgroupHTMLAttributesSchema = DetailedHTMLAttributesSchema.and(
  z.object({
    span: z.number().optional(),
  }),
)

const DetailedDataHTMLAttributesSchema = DetailedHTMLAttributesSchema.and(
  z.object({
    value: z.union([z.string(), z.number()]).optional(),
  }),
)

const DetailedDetailsHTMLAttributesSchema = DetailedHTMLAttributesSchema.and(
  z.object({
    open: z.boolean().optional(),
  }),
)

const DetailedDelHTMLAttributesSchema = DetailedHTMLAttributesSchema.and(
  z.object({
    cite: z.string().optional(),
    datetime: z.string().optional(),
  }),
)

const DetailedDialogHTMLAttributesSchema = DetailedHTMLAttributesSchema.and(
  z.object({
    open: z.boolean().optional(),
  }),
)

const DetailedEmbedHTMLAttributesSchema = DetailedHTMLAttributesSchema.and(
  z.object({
    height: z.union([z.number(), z.string()]).optional(),
    src: z.string().optional(),
    type: z.string().optional(),
    width: z.union([z.number(), z.string()]).optional(),
  }),
)

const DetailedFieldsetHTMLAttributesSchema = DetailedHTMLAttributesSchema.and(
  z.object({
    disabled: z.boolean().optional(),
    form: z.string().optional(),
    name: z.string().optional(),
  }),
)

const DetailedFormHTMLAttributesSchema = DetailedHTMLAttributesSchema.and(
  z.object({
    'accept-charset': z.string().optional(),
    action: z.never().optional(),
    autocomplete: z.string().optional(),
    enctype: z.string().optional(),
    method: z.string().optional(),
    name: z.string().optional(),
    novalidate: z.boolean().optional(),
    target: z.string().optional(),
    [P_TRIGGER]: z.never().optional(),
    [P_FORM]: z.string(),
  }),
)

const DetailedHTMLHTMLAttributesSchema = DetailedHTMLAttributesSchema.and(
  z.object({
    manifest: z.string().optional(),
  }),
)

const DetailedIframeHTMLAttributesSchema = DetailedHTMLAttributesSchema.and(
  z.object({
    allow: z.string().optional(),
    height: z.union([z.number(), z.string()]).optional(),
    loading: z.enum(['eager', 'lazy']).optional(),
    name: z.string().optional(),
    referrerpolicy: referrerPolicySchema.optional(),
    sandbox: z.string().optional(),
    seamless: z.boolean().optional(),
    src: z.string().optional(),
    srcdoc: z.string().optional(),
    width: z.union([z.number(), z.string()]).optional(),
  }),
)

const DetailedImgHTMLAttributesSchema = DetailedHTMLAttributesSchema.and(
  z.object({
    alt: z.string().optional(),
    crossorigin: crossOriginSchema.optional(),
    decoding: z.enum(['async', 'auto', 'sync']).optional(),
    height: z.union([z.number(), z.string()]).optional(),
    loading: z.enum(['eager', 'lazy']).optional(),
    referrerpolicy: referrerPolicySchema.optional(),
    sizes: z.string().optional(),
    src: z.string().optional(),
    srcset: z.string().optional(),
    usemap: z.string().optional(),
    width: z.union([z.number(), z.string()]).optional(),
  }),
)

const DetailedInsHTMLAttributesSchema = DetailedHTMLAttributesSchema.and(
  z.object({
    cite: z.string().optional(),
    datetime: z.string().optional(),
  }),
)

const DetailedInputHTMLAttributesSchema = DetailedHTMLAttributesSchema.and(
  z.object({
    accept: z.string().optional(),
    alt: z.string().optional(),
    autocomplete: z.string().optional(),
    capture: z.union([z.boolean(), z.enum(['user', 'environment'])]).optional(),
    checked: z.boolean().optional(),
    disabled: z.boolean().optional(),
    enterkeyhint: z.enum(['enter', 'done', 'go', 'next', 'previous', 'search', 'send']).optional(),
    form: z.string().optional(),
    formaction: z.string().optional(),
    formenctype: z.string().optional(),
    formmethod: z.string().optional(),
    formnovalidate: z.boolean().optional(),
    formtarget: z.string().optional(),
    height: z.union([z.number(), z.string()]).optional(),
    list: z.string().optional(),
    max: z.union([z.number(), z.string()]).optional(),
    maxlength: z.number().optional(),
    min: z.union([z.number(), z.string()]).optional(),
    minlength: z.number().optional(),
    multiple: z.boolean().optional(),
    name: z.string().optional(),
    pattern: z.string().optional(),
    placeholder: z.string().optional(),
    readonly: z.boolean().optional(),
    required: z.boolean().optional(),
    size: z.number().optional(),
    src: z.string().optional(),
    step: z.union([z.number(), z.string()]).optional(),
    type: inputTypeSchema.optional(),
    value: z.union([z.string(), z.number()]).optional(),
    width: z.union([z.number(), z.string()]).optional(),
  }),
)

const DetailedLabelHTMLAttributesSchema = DetailedHTMLAttributesSchema.and(
  z.object({
    form: z.string().optional(),
    for: z.string().optional(),
  }),
)

const DetailedLiHTMLAttributesSchema = DetailedHTMLAttributesSchema.and(
  z.object({
    value: z.union([z.string(), z.number()]).optional(),
  }),
)

const DetailedLinkHTMLAttributesSchema = DetailedHTMLAttributesSchema.and(
  z.object({
    as: z.string().optional(),
    crossorigin: crossOriginSchema.optional(),
    fetchPriority: z.enum(['high', 'low', 'auto']).optional(),
    href: z.string().optional(),
    hreflang: z.string().optional(),
    integrity: z.string().optional(),
    media: z.string().optional(),
    imagesrcset: z.string().optional(),
    imagesizes: z.string().optional(),
    referrerpolicy: referrerPolicySchema.optional(),
    sizes: z.string().optional(),
    type: z.string().optional(),
    charSet: z.string().optional(),
  }),
)

const DetailedMapHTMLAttributesSchema = DetailedHTMLAttributesSchema.and(
  z.object({
    name: z.string().optional(),
  }),
)

const DetailedMenuHTMLAttributesSchema = DetailedHTMLAttributesSchema.and(
  z.object({
    type: z.string().optional(),
  }),
)

// Audio is DetailedMediaHTMLAttributes
const DetailedAudioHTMLAttributesSchema = DetailedMediaHTMLAttributesSchema

const DetailedMetaHTMLAttributesSchema = DetailedHTMLAttributesSchema.and(
  z.object({
    charset: z.string().optional(),
    'http-equiv': z.string().optional(),
    name: z.string().optional(),
    media: z.string().optional(),
    content: z.string().optional(),
  }),
)

const DetailedMeterHTMLAttributesSchema = DetailedHTMLAttributesSchema.and(
  z.object({
    form: z.string().optional(),
    high: z.number().optional(),
    low: z.number().optional(),
    max: z.union([z.number(), z.string()]).optional(),
    min: z.union([z.number(), z.string()]).optional(),
    optimum: z.number().optional(),
    value: z.union([z.string(), z.number()]).optional(),
  }),
)

const DetailedQuoteHTMLAttributesSchema = DetailedHTMLAttributesSchema.and(
  z.object({
    cite: z.string().optional(),
  }),
)

const DetailedObjectHTMLAttributesSchema = DetailedHTMLAttributesSchema.and(
  z.object({
    classid: z.string().optional(),
    data: z.string().optional(),
    form: z.string().optional(),
    height: z.union([z.number(), z.string()]).optional(),
    name: z.string().optional(),
    type: z.string().optional(),
    usemap: z.string().optional(),
    width: z.union([z.number(), z.string()]).optional(),
  }),
)

const DetailedOlHTMLAttributesSchema = DetailedHTMLAttributesSchema.and(
  z.object({
    reversed: z.boolean().optional(),
    start: z.number().optional(),
    type: z.enum(['1', 'a', 'A', 'i', 'I']).optional(),
  }),
)

const DetailedOptgroupHTMLAttributesSchema = DetailedHTMLAttributesSchema.and(
  z.object({
    disabled: z.boolean().optional(),
    label: z.string().optional(),
  }),
)

const DetailedOptionHTMLAttributesSchema = DetailedHTMLAttributesSchema.and(
  z.object({
    disabled: z.boolean().optional(),
    label: z.string().optional(),
    selected: z.boolean().optional(),
    value: z.union([z.string(), z.number()]).optional(),
  }),
)

const DetailedOutputHTMLAttributesSchema = DetailedHTMLAttributesSchema.and(
  z.object({
    form: z.string().optional(),
    for: z.string().optional(),
    name: z.string().optional(),
  }),
)

const DetailedProgressHTMLAttributesSchema = DetailedHTMLAttributesSchema.and(
  z.object({
    max: z.union([z.number(), z.string()]).optional(),
    value: z.union([z.string(), z.number()]).optional(),
  }),
)

const DetailedSlotHTMLAttributesSchema = DetailedHTMLAttributesSchema.and(
  z.object({
    name: z.string().optional(),
  }),
)

const DetailedScriptHTMLAttributesSchema = DetailedHTMLAttributesSchema.and(
  z.object({
    async: z.boolean().optional(),
    crossorigin: crossOriginSchema.optional(),
    defer: z.boolean().optional(),
    integrity: z.string().optional(),
    nomodule: z.boolean().optional(),
    referrerpolicy: referrerPolicySchema.optional(),
    src: z.string().optional(),
    type: z.string().optional(),
  }),
)

const DetailedSelectHTMLAttributesSchema = DetailedHTMLAttributesSchema.and(
  z.object({
    autocomplete: z.string().optional(),
    disabled: z.boolean().optional(),
    form: z.string().optional(),
    multiple: z.boolean().optional(),
    name: z.string().optional(),
    required: z.boolean().optional(),
    size: z.number().optional(),
    value: z.union([z.string(), z.number()]).optional(),
  }),
)

const DetailedSourceHTMLAttributesSchema = DetailedHTMLAttributesSchema.and(
  z.object({
    height: z.union([z.number(), z.string()]).optional(),
    media: z.string().optional(),
    sizes: z.string().optional(),
    src: z.string().optional(),
    srcset: z.string().optional(),
    type: z.string().optional(),
    width: z.union([z.number(), z.string()]).optional(),
  }),
)

const DetailedStyleHTMLAttributesSchema = DetailedHTMLAttributesSchema.and(
  z.object({
    media: z.string().optional(),
  }),
)

const DetailedTableHTMLAttributesSchema = DetailedHTMLAttributesSchema.and(
  z.object({
    align: z.enum(['left', 'center', 'right']).optional(),
    bgcolor: z.string().optional(),
    border: z.number().optional(),
    cellpadding: z.union([z.number(), z.string()]).optional(),
    cellspacing: z.union([z.number(), z.string()]).optional(),
    frame: z.boolean().optional(),
    rules: z.enum(['none', 'groups', 'rows', 'columns', 'all']).optional(),
    summary: z.string().optional(),
    width: z.union([z.number(), z.string()]).optional(),
  }),
)

const DetailedTemplateHTMLAttributesSchema = DetailedHTMLAttributesSchema.and(
  z.object({
    shadowrootmode: z.enum(['open', 'closed']).optional(),
    shadowrootdelegatesfocus: z.boolean().optional(),
    shadowrootclonable: z.boolean().optional(),
  }),
)

const DetailedTextareaHTMLAttributesSchema = DetailedHTMLAttributesSchema.and(
  z.object({
    autocomplete: z.string().optional(),
    cols: z.number().optional(),
    dirname: z.string().optional(),
    disabled: z.boolean().optional(),
    form: z.string().optional(),
    maxlength: z.number().optional(),
    minlength: z.number().optional(),
    name: z.string().optional(),
    placeholder: z.string().optional(),
    readonly: z.boolean().optional(),
    required: z.boolean().optional(),
    rows: z.number().optional(),
    value: z.union([z.string(), z.number()]).optional(),
    wrap: z.string().optional(),
  }),
)

const DetailedTdHTMLAttributesSchema = DetailedHTMLAttributesSchema.and(
  z.object({
    align: z.enum(['left', 'center', 'right', 'justify', 'char']).optional(),
    colspan: z.number().optional(),
    headers: z.string().optional(),
    rowspan: z.number().optional(),
    scope: z.string().optional(),
    abbr: z.string().optional(),
    height: z.string().optional(),
    width: z.string().optional(),
    valign: z.enum(['top', 'middle', 'bottom', 'baseline']).optional(),
  }),
)

const DetailedThHTMLAttributesSchema = DetailedHTMLAttributesSchema.and(
  z.object({
    align: z.enum(['left', 'center', 'right', 'justify', 'char']).optional(),
    colspan: z.number().optional(),
    headers: z.string().optional(),
    rowspan: z.number().optional(),
    scope: z.string().optional(),
    abbr: z.string().optional(),
  }),
)

const DetailedTimeHTMLAttributesSchema = DetailedHTMLAttributesSchema.and(
  z.object({
    datetime: z.string().optional(),
  }),
)

const DetailedTrackHTMLAttributesSchema = DetailedHTMLAttributesSchema.and(
  z.object({
    default: z.boolean().optional(),
    kind: z.enum(['subtitles', 'captions', 'descriptions', 'chapters', 'metadata']).optional(),
    label: z.string().optional(),
    src: z.string().optional(),
    srclang: z.string().optional(),
  }),
)

const DetailedVideoHTMLAttributesSchema = DetailedMediaHTMLAttributesSchema.and(
  z.object({
    height: z.string().optional(),
    playsinline: z.boolean().optional(),
    poster: z.string().optional(),
    width: z.string().optional(),
    disablepictureinpicture: z.boolean().optional(),
    disableremoteplayback: z.boolean().optional(),
  }),
)

const DetailedWebViewHTMLAttributesSchema = DetailedHTMLAttributesSchema.and(
  z.object({
    src: z.string().optional(),
    nodeintegration: z.boolean().optional(),
    nodeintegrationinsubframes: z.boolean().optional(),
    plugins: z.boolean().optional(),
    preload: z.string().optional(),
    httpreferrer: z.string().optional(),
    useragent: z.string().optional(),
    disablewebsecurity: z.boolean().optional(),
    partition: z.string().optional(),
    allowpopups: z.boolean().optional(),
    webpreferences: z.string().optional(),
    enableblinkfeatures: z.string().optional(),
    disableblinkfeatures: z.string().optional(),
  }),
)

// ── SVG attributes ─────────────────────────────────────────────────────────

/**
 * Schema for SVG element attributes, extending Detailed HTML attributes.
 *
 * @internal
 */
const DetailedSvgAttributesSchema = DetailedHTMLAttributesSchema.and(
  z.object({
    'accent-height': z.number().optional(),
    accumulate: z.union([z.enum(['none', 'sum']), z.string()]).optional(),
    additive: z.union([z.enum(['replace', 'sum']), z.string()]).optional(),
    'alignment-baseline': z
      .union([
        z.enum([
          'auto',
          'baseline',
          'before-edge',
          'text-before-edge',
          'middle',
          'central',
          'after-edge',
          'text-after-edge',
          'ideographic',
          'alphabetic',
          'hanging',
          'mathematical',
          'inherit',
        ]),
        z.string(),
      ])
      .optional(),
    allowReorder: z.union([z.enum(['no', 'yes']), z.string()]).optional(),
    amplitude: z.union([z.number(), z.string()]).optional(),
    attributeName: z.string().optional(),
    attributeType: z.string().optional(),
    autoReverse: booleanishSchema.optional(),
    azimuth: z.number().optional(),
    baseFrequency: z.union([z.number(), z.string()]).optional(),
    'baseline-shift': z.union([z.enum(['sub', 'super']), z.number(), z.string()]).optional(),
    baseProfile: z.string().optional(),
    begin: z.union([z.number(), z.string()]).optional(),
    bias: z.union([z.number(), z.string()]).optional(),
    by: z.union([z.number(), z.string()]).optional(),
    calcMode: z.union([z.enum(['discrete', 'linear', 'paced', 'spline']), z.string()]).optional(),
    'clip-path': z.string().optional(),
    'clip-rule': z.union([z.enum(['nonzero', 'evenodd', 'inherit']), z.string()]).optional(),
    clipPathUnits: z.union([z.enum(['userSpaceOnUse', 'objectBoundingBox']), z.string()]).optional(),
    color: z.string().optional(),
    'color-interpolation': z.union([z.enum(['auto', 'sRGB', 'linearRGB', 'inherit']), z.string()]).optional(),
    'color-interpolation-filters': z.string().optional(),
    'color-rendering': z.union([z.number(), z.string()]).optional(),
    contentScriptType: z.string().optional(),
    contentStyleType: z.string().optional(),
    cursor: z.string().optional(),
    cx: z.string().optional(),
    cy: z.string().optional(),
    d: z.string().optional(),
    decoding: z.union([z.enum(['sync', 'async', 'auto']), z.string()]).optional(),
    diffuseConstant: z.union([z.number(), z.string()]).optional(),
    direction: z.union([z.enum(['ltr', 'rtl']), z.string()]).optional(),
    display: z.string().optional(),
    divisor: z.union([z.number(), z.string()]).optional(),
    'dominant-baseline': z
      .union([
        z.enum([
          'auto',
          'text-bottom',
          'alphabetic',
          'ideographic',
          'middle',
          'central',
          'mathematical',
          'hanging',
          'text-top',
        ]),
        z.string(),
      ])
      .optional(),
    dur: z.union([z.enum(['media', 'indefinite']), z.number(), z.string()]).optional(),
    dx: z.union([z.number(), z.string()]).optional(),
    dy: z.union([z.number(), z.number(), z.string()]).optional(),
    edgeMode: z.string().optional(),
    elevation: z.union([z.number(), z.string()]).optional(),
    end: z.string().optional(),
    exponent: z.union([z.number(), z.string()]).optional(),
    fill: z.string().optional(),
    'fill-opacity': z.union([z.number(), z.string()]).optional(),
    'fill-rule': z.union([z.enum(['nonzero', 'evenodd', 'inherit']), z.string()]).optional(),
    filter: z.string().optional(),
    filterRes: z.union([z.number(), z.string()]).optional(),
    filterUnits: z.union([z.enum(['userSpaceOnUse', 'objectBoundingBox']), z.string()]).optional(),
    'flood-color': z.string().optional(),
    'flood-opacity': z.union([z.number(), z.string()]).optional(),
    focusable: z.union([booleanishSchema, z.literal('auto')]).optional(),
    'font-family': z.string().optional(),
    'font-size': z.string().optional(),
    'font-size-adjust': z.string().optional(),
    'font-stretch': z.string().optional(),
    'font-style': z.string().optional(),
    'font-variant': z.string().optional(),
    'font-weight': z.string().optional(),
    fr: z.string().optional(),
    from: z.string().optional(),
    fx: z.string().optional(),
    fy: z.string().optional(),
    gradientTransform: z.string().optional(),
    gradientUnits: z.union([z.enum(['userSpaceOnUse', 'objectBoundingBox']), z.string()]).optional(),
    height: z.union([z.number(), z.string()]).optional(),
    href: z.string().optional(),
    id: z.union([z.string(), z.number()]).optional(),
    'image-rendering': z.union([z.enum(['auto', 'optimizeSpeed', 'optimizeQuality']), z.string()]).optional(),
    in: z
      .union([
        z.enum(['SourceGraphic', 'SourceAlpha', 'BackgroundImage', 'BackgroundAlpha', 'FillPaint', 'StrokePaint']),
        z.string(),
      ])
      .optional(),
    in2: z
      .union([
        z.enum(['SourceGraphic', 'SourceAlpha', 'BackgroundImage', 'BackgroundAlpha', 'FillPaint', 'StrokePaint']),
        z.string(),
      ])
      .optional(),
    intercept: z.union([z.number(), z.string()]).optional(),
    k1: z.union([z.number(), z.string()]).optional(),
    k2: z.union([z.number(), z.string()]).optional(),
    k3: z.union([z.number(), z.string()]).optional(),
    k4: z.union([z.number(), z.string()]).optional(),
    kernelMatrix: z.string().optional(),
    kernelUnitLength: z.string().optional(),
    keyPoints: z.string().optional(),
    keySplines: z.string().optional(),
    keyTimes: z.string().optional(),
    lang: z.string().optional(),
    lengthAdjust: z.union([z.enum(['spacing', 'spacingAndGlyphs']), z.string()]).optional(),
    'letter-spacing': z.union([z.number(), z.string()]).optional(),
    'lighting-color': z.string().optional(),
    limitingConeAngle: z.union([z.number(), z.string()]).optional(),
    'marker-end': z.string().optional(),
    'marker-mid': z.string().optional(),
    'marker-start': z.string().optional(),
    markerHeight: z.union([z.string(), z.number()]).optional(),
    markerUnits: z.union([z.enum(['userSpaceOnUse', 'strokeWidth']), z.string()]).optional(),
    markerWidth: z.union([z.string(), z.number()]).optional(),
    mask: z.string().optional(),
    maskContentUnits: z.union([z.enum(['userSpaceOnUse', 'objectBoundingBox']), z.string()]).optional(),
    maskUnits: z.union([z.enum(['userSpaceOnUse', 'objectBoundingBox']), z.string()]).optional(),
    max: z.string().optional(),
    media: z.string().optional(),
    method: z.enum(['align', 'stretch']).optional(),
    min: z.string().optional(),
    mode: z.string().optional(),
    numOctaves: z.union([z.number(), z.string()]).optional(),
    offset: z.string().optional(),
    opacity: z.union([z.number(), z.string()]).optional(),
    operator: z.string().optional(),
    order: z.union([z.number(), z.string()]).optional(),
    orient: z.union([z.number(), z.string()]).optional(),
    origin: z.string().optional(),
    overflow: z.union([z.enum(['visible', 'hidden', 'scroll', 'auto']), z.string()]).optional(),
    'overline-position': z.union([z.number(), z.string()]).optional(),
    'overline-thickness': z.union([z.number(), z.string()]).optional(),
    'paint-order': z.string().optional(),
    path: z.string().optional(),
    pathLength: z.union([z.number(), z.string()]).optional(),
    patternContentUnits: z.union([z.enum(['userSpaceOnUse', 'objectBoundingBox']), z.string()]).optional(),
    patternTransform: z.string().optional(),
    patternUnits: z.union([z.enum(['userSpaceOnUse', 'objectBoundingBox']), z.string()]).optional(),
    'pointer-events': z
      .union([
        z.enum([
          'bounding-box',
          'visiblePainted',
          'visibleFill',
          'visibleStroke',
          'visible',
          'painted',
          'fill',
          'stroke',
          'all',
          'none',
        ]),
        z.string(),
      ])
      .optional(),
    points: z.string().optional(),
    pointsAtX: z.union([z.number(), z.string()]).optional(),
    pointsAtY: z.union([z.number(), z.string()]).optional(),
    pointsAtZ: z.union([z.number(), z.string()]).optional(),
    preserveAlpha: z.enum(['true', 'false']).optional(),
    preserveAspectRatio: z.string().optional(),
    primitiveUnits: z.union([z.enum(['userSpaceOnUse', 'objectBoundingBox']), z.string()]).optional(),
    r: z.union([z.number(), z.string()]).optional(),
    radius: z.union([z.number(), z.string()]).optional(),
    referrerpolicy: z.string().optional(),
    refX: z.union([z.number(), z.string()]).optional(),
    refY: z.union([z.number(), z.string()]).optional(),
    repeatCount: z.union([z.enum(['indefinite']), z.number(), z.string()]).optional(),
    repeatDur: z.union([z.enum(['indefinite']), z.string()]).optional(),
    restart: z.union([z.enum(['always', 'whenNotActive', 'never']), z.string()]).optional(),
    result: z.string().optional(),
    rotate: z.union([z.enum(['auto', 'auto-reverse']), z.number(), z.string()]).optional(),
    rx: z.union([z.number(), z.string()]).optional(),
    ry: z.union([z.number(), z.string()]).optional(),
    scale: z.union([z.number(), z.string()]).optional(),
    seed: z.union([z.number(), z.string()]).optional(),
    'shape-rendering': z
      .union([z.enum(['auto', 'optimizeSpeed', 'crispEdges', 'geometricPrecision']), z.string()])
      .optional(),
    spacing: z.enum(['auto', 'exact']).optional(),
    specularConstant: z.union([z.number(), z.string()]).optional(),
    specularExponent: z.union([z.number(), z.string()]).optional(),
    spreadMethod: z.union([z.enum(['pad', 'reflect', 'repeat']), z.string()]).optional(),
    startOffset: z.union([z.number(), z.string()]).optional(),
    stdDeviation: z.union([z.number(), z.string()]).optional(),
    stitchTiles: z.union([z.enum(['noStitch', 'stitch']), z.string()]).optional(),
    'stop-color': z.string().optional(),
    'stop-opacity': z.union([z.number(), z.string()]).optional(),
    'strikethrough-position': z.union([z.number(), z.string()]).optional(),
    'strikethrough-thickness': z.union([z.number(), z.string()]).optional(),
    stroke: z.string().optional(),
    'stroke-dasharray': z.string().optional(),
    'stroke-dashoffset': z.union([z.number(), z.string()]).optional(),
    'stroke-linecap': z.union([z.enum(['butt', 'round', 'square', 'inherit']), z.string()]).optional(),
    'stroke-linejoin': z
      .union([z.enum(['arcs', 'bevel', 'miter', 'miter-clip', 'round', 'inherit']), z.string()])
      .optional(),
    'stroke-miterlimit': z.union([z.number(), z.string()]).optional(),
    'stroke-opacity': z.union([z.number(), z.string()]).optional(),
    'stroke-width': z.union([z.number(), z.string()]).optional(),
    surfaceScale: z.union([z.number(), z.string()]).optional(),
    systemLanguage: z.string().optional(),
    tableValues: z.string().optional(),
    targetX: z.union([z.number(), z.string()]).optional(),
    targetY: z.union([z.number(), z.string()]).optional(),
    'text-anchor': z.union([z.enum(['start', 'middle', 'end']), z.string()]).optional(),
    'text-decoration': z.string().optional(),
    'text-rendering': z
      .union([z.enum(['auto', 'optimizeSpeed', 'optimizeLegibility', 'geometricPrecision']), z.string()])
      .optional(),
    textLength: z.union([z.number(), z.string()]).optional(),
    to: z.union([z.number(), z.string()]).optional(),
    transform: z.string().optional(),
    'transform-origin': z.string().optional(),
    type: z.string().optional(),
    'underline-position': z.union([z.number(), z.string()]).optional(),
    'underline-thickness': z.union([z.number(), z.string()]).optional(),
    values: z.string().optional(),
    'vector-effect': z
      .union([z.enum(['none', 'non-scaling-stroke', 'non-scaling-size', 'non-rotation', 'fixed-position']), z.string()])
      .optional(),
    viewBox: z.string().optional(),
    visibility: z.union([z.enum(['visible', 'hidden', 'collapse']), z.string()]).optional(),
    width: z.union([z.number(), z.string()]).optional(),
    'word-spacing': z.union([z.number(), z.string()]).optional(),
    'writing-mode': z.union([z.enum(['horizontal-tb', 'vertical-rl', 'vertical-lr']), z.string()]).optional(),
    x: z.union([z.number(), z.string()]).optional(),
    x1: z.union([z.number(), z.string()]).optional(),
    x2: z.union([z.number(), z.string()]).optional(),
    xChannelSelector: z.union([z.enum(['R', 'G', 'B', 'A']), z.string()]).optional(),
    y: z.union([z.number(), z.string()]).optional(),
    y1: z.union([z.number(), z.string()]).optional(),
    y2: z.union([z.number(), z.string()]).optional(),
    yChannelSelector: z.union([z.enum(['R', 'G', 'B', 'A']), z.string()]).optional(),
    z: z.union([z.number(), z.string()]).optional(),
  }),
)

// ── Element attribute list ─────────────────────────────────────────────────

/**
 * Schema mapping element tag names to their attribute schemas.
 *
 * @public
 */
export const ElementAttributeListSchema = z
  .object({
    a: DetailedAnchorHTMLAttributesSchema,
    abbr: DetailedHTMLAttributesSchema,
    address: DetailedHTMLAttributesSchema,
    area: DetailedAreaHTMLAttributesSchema,
    article: DetailedHTMLAttributesSchema,
    aside: DetailedHTMLAttributesSchema,
    audio: DetailedAudioHTMLAttributesSchema,
    b: DetailedHTMLAttributesSchema,
    base: DetailedBaseHTMLAttributesSchema,
    bdi: DetailedHTMLAttributesSchema,
    bdo: DetailedHTMLAttributesSchema,
    big: DetailedHTMLAttributesSchema,
    blockquote: DetailedBlockquoteHTMLAttributesSchema,
    body: DetailedHTMLAttributesSchema,
    br: DetailedHTMLAttributesSchema,
    button: DetailedButtonHTMLAttributesSchema,
    canvas: DetailedCanvasHTMLAttributesSchema,
    caption: DetailedHTMLAttributesSchema,
    cite: DetailedHTMLAttributesSchema,
    code: DetailedHTMLAttributesSchema,
    col: DetailedColHTMLAttributesSchema,
    colgroup: DetailedColgroupHTMLAttributesSchema,
    data: DetailedDataHTMLAttributesSchema,
    datalist: DetailedHTMLAttributesSchema,
    dd: DetailedHTMLAttributesSchema,
    del: DetailedDelHTMLAttributesSchema,
    details: DetailedDetailsHTMLAttributesSchema,
    dfn: DetailedHTMLAttributesSchema,
    dialog: DetailedDialogHTMLAttributesSchema,
    div: DetailedHTMLAttributesSchema,
    dl: DetailedHTMLAttributesSchema,
    dt: DetailedHTMLAttributesSchema,
    em: DetailedHTMLAttributesSchema,
    embed: DetailedEmbedHTMLAttributesSchema,
    fieldset: DetailedFieldsetHTMLAttributesSchema,
    figcaption: DetailedHTMLAttributesSchema,
    figure: DetailedHTMLAttributesSchema,
    footer: DetailedHTMLAttributesSchema,
    form: DetailedFormHTMLAttributesSchema,
    h1: DetailedHTMLAttributesSchema,
    h2: DetailedHTMLAttributesSchema,
    h3: DetailedHTMLAttributesSchema,
    h4: DetailedHTMLAttributesSchema,
    h5: DetailedHTMLAttributesSchema,
    h6: DetailedHTMLAttributesSchema,
    head: DetailedHTMLAttributesSchema,
    header: DetailedHTMLAttributesSchema,
    hgroup: DetailedHTMLAttributesSchema,
    hr: DetailedHTMLAttributesSchema,
    html: DetailedHTMLHTMLAttributesSchema,
    i: DetailedHTMLAttributesSchema,
    iframe: DetailedIframeHTMLAttributesSchema,
    img: DetailedImgHTMLAttributesSchema,
    input: DetailedInputHTMLAttributesSchema,
    ins: DetailedInsHTMLAttributesSchema,
    kbd: DetailedHTMLAttributesSchema,
    label: DetailedLabelHTMLAttributesSchema,
    legend: DetailedHTMLAttributesSchema,
    li: DetailedLiHTMLAttributesSchema,
    link: DetailedLinkHTMLAttributesSchema,
    main: DetailedHTMLAttributesSchema,
    map: DetailedMapHTMLAttributesSchema,
    mark: DetailedHTMLAttributesSchema,
    menu: DetailedMenuHTMLAttributesSchema,
    menuitem: DetailedHTMLAttributesSchema,
    meta: DetailedMetaHTMLAttributesSchema,
    meter: DetailedMeterHTMLAttributesSchema,
    nav: DetailedHTMLAttributesSchema,
    noscript: DetailedHTMLAttributesSchema,
    object: DetailedObjectHTMLAttributesSchema,
    ol: DetailedOlHTMLAttributesSchema,
    optgroup: DetailedOptgroupHTMLAttributesSchema,
    option: DetailedOptionHTMLAttributesSchema,
    output: DetailedOutputHTMLAttributesSchema,
    p: DetailedHTMLAttributesSchema,
    picture: DetailedHTMLAttributesSchema,
    pre: DetailedHTMLAttributesSchema,
    progress: DetailedProgressHTMLAttributesSchema,
    q: DetailedQuoteHTMLAttributesSchema,
    rp: DetailedHTMLAttributesSchema,
    rt: DetailedHTMLAttributesSchema,
    ruby: DetailedHTMLAttributesSchema,
    s: DetailedHTMLAttributesSchema,
    samp: DetailedHTMLAttributesSchema,
    script: DetailedScriptHTMLAttributesSchema,
    search: DetailedHTMLAttributesSchema,
    section: DetailedHTMLAttributesSchema,
    select: DetailedSelectHTMLAttributesSchema,
    slot: DetailedSlotHTMLAttributesSchema,
    small: DetailedHTMLAttributesSchema,
    source: DetailedSourceHTMLAttributesSchema,
    span: DetailedHTMLAttributesSchema,
    strong: DetailedHTMLAttributesSchema,
    style: DetailedStyleHTMLAttributesSchema,
    sub: DetailedHTMLAttributesSchema,
    summary: DetailedHTMLAttributesSchema,
    sup: DetailedHTMLAttributesSchema,
    table: DetailedTableHTMLAttributesSchema,
    template: DetailedTemplateHTMLAttributesSchema,
    tbody: DetailedHTMLAttributesSchema,
    td: DetailedTdHTMLAttributesSchema,
    textarea: DetailedTextareaHTMLAttributesSchema,
    tfoot: DetailedHTMLAttributesSchema,
    th: DetailedThHTMLAttributesSchema,
    thead: DetailedHTMLAttributesSchema,
    time: DetailedTimeHTMLAttributesSchema,
    title: DetailedHTMLAttributesSchema,
    tr: DetailedHTMLAttributesSchema,
    track: DetailedTrackHTMLAttributesSchema,
    u: DetailedHTMLAttributesSchema,
    ul: DetailedHTMLAttributesSchema,
    var: DetailedHTMLAttributesSchema,
    video: DetailedVideoHTMLAttributesSchema,
    wbr: DetailedHTMLAttributesSchema,
    webview: DetailedWebViewHTMLAttributesSchema,
    // SVG
    svg: DetailedSvgAttributesSchema,
    animate: DetailedSvgAttributesSchema,
    circle: DetailedSvgAttributesSchema,
    animateMotion: DetailedSvgAttributesSchema,
    animateTransform: DetailedSvgAttributesSchema,
    clipPath: DetailedSvgAttributesSchema,
    defs: DetailedSvgAttributesSchema,
    desc: DetailedSvgAttributesSchema,
    ellipse: DetailedSvgAttributesSchema,
    feBlend: DetailedSvgAttributesSchema,
    feColorMatrix: DetailedSvgAttributesSchema,
    feComponentTransfer: DetailedSvgAttributesSchema,
    feComposite: DetailedSvgAttributesSchema,
    feConvolveMatrix: DetailedSvgAttributesSchema,
    feDiffuseLighting: DetailedSvgAttributesSchema,
    feDisplacementMap: DetailedSvgAttributesSchema,
    feDistantLight: DetailedSvgAttributesSchema,
    feDropShadow: DetailedSvgAttributesSchema,
    feFlood: DetailedSvgAttributesSchema,
    feFuncA: DetailedSvgAttributesSchema,
    feFuncB: DetailedSvgAttributesSchema,
    feFuncG: DetailedSvgAttributesSchema,
    feFuncR: DetailedSvgAttributesSchema,
    feGaussianBlur: DetailedSvgAttributesSchema,
    feImage: DetailedSvgAttributesSchema,
    feMerge: DetailedSvgAttributesSchema,
    feMergeNode: DetailedSvgAttributesSchema,
    feMorphology: DetailedSvgAttributesSchema,
    feOffset: DetailedSvgAttributesSchema,
    fePointLight: DetailedSvgAttributesSchema,
    feSpecularLighting: DetailedSvgAttributesSchema,
    feSpotLight: DetailedSvgAttributesSchema,
    feTile: DetailedSvgAttributesSchema,
    feTurbulence: DetailedSvgAttributesSchema,
    filter: DetailedSvgAttributesSchema,
    foreignObject: DetailedSvgAttributesSchema,
    g: DetailedSvgAttributesSchema,
    image: DetailedSvgAttributesSchema,
    line: DetailedSvgAttributesSchema,
    linearGradient: DetailedSvgAttributesSchema,
    marker: DetailedSvgAttributesSchema,
    mask: DetailedSvgAttributesSchema,
    metadata: DetailedSvgAttributesSchema,
    mpath: DetailedSvgAttributesSchema,
    path: DetailedSvgAttributesSchema,
    pattern: DetailedSvgAttributesSchema,
    polygon: DetailedSvgAttributesSchema,
    polyline: DetailedSvgAttributesSchema,
    radialGradient: DetailedSvgAttributesSchema,
    rect: DetailedSvgAttributesSchema,
    set: DetailedSvgAttributesSchema,
    stop: DetailedSvgAttributesSchema,
    switch: DetailedSvgAttributesSchema,
    symbol: DetailedSvgAttributesSchema,
    text: DetailedSvgAttributesSchema,
    textPath: DetailedSvgAttributesSchema,
    tspan: DetailedSvgAttributesSchema,
    use: DetailedSvgAttributesSchema,
    view: DetailedSvgAttributesSchema,
  })
  .catchall(DetailedHTMLAttributesSchema)

/** @public */
export type ElementAttributeList = z.output<typeof ElementAttributeListSchema>

// // ── Component catalog schemas ────────────────────────────────

// /**
//  * Schema for a `$styleRef` reference — a closed-enum discriminated ref
//  * that appears only within a component's `style[]` array.
//  *
//  * @internal
//  */
// const styleRefSchema = z.object({ $styleRef: z.string() })

// /**
//  * Schema for a `$bind` reference — a closed-enum discriminated ref
//  * that appears only in `text`/content values or inside `attrs` values.
//  *
//  * @internal
//  */
// const bindSchema = z.object({ $bind: z.string() })

// /** @internal */
// type Bind = z.output<typeof bindSchema>

// /**
//  * Schema for a single component entry in the flat component catalog.
//  *
//  * @remarks
//  * Components are flat adjacency-list nodes (not nested trees):
//  * - `id` — globally unique identifier used as the ref path in `children`
//  * - `tag` — intrinsic HTML/SVG tag name or custom element tag
//  * - `attrs` — plain HTML attributes (including `data-*`, `p-trigger`, etc.)
//  * - `style` — array of `$styleRef` references (position-constrained)
//  * - `children` — array of component `id` refs (resolved by the assembler)
//  * - `text` — literal string/number content or a `$bind` reference
//  *
//  * Position constraints (structural, not superRefine):
//  * - `$styleRef` is only legal as an element of `style[]`
//  * - `$bind` is only legal in `text` or `attrs` values
//  *
//  * Cross-catalog id existence is NOT validated here (resolver's job).
//  *
//  * @internal
//  */
// const componentEntrySchema = z.object({
//   id: z.string(),
//   tag: z.union([ElementAttributeListSchema.keyof(), customElementTagSchema]),
//   attrs: DetailedHTMLAttributesSchema.optional(),
//   style: z.array(styleRefSchema).optional(),
//   children: z.array(z.union([z.string(), z.number()])).optional(),
//   text: z.union([z.string(), z.number(), bindSchema]).optional(),
// })

// /** @internal */
// type ComponentEntry = z.output<typeof componentEntrySchema>

// /**
//  * Schema for a complete component catalog — an ordered array of
//  * flat adjacency-list component entries.
//  *
//  * @internal
//  */
// const componentCatalogSchema = z.array(componentEntrySchema)

// /** @internal */
// type ComponentCatalog = z.output<typeof componentCatalogSchema>
