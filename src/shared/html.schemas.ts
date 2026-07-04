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
import { cssPropertySchema } from './css.schemas.ts'
import {
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
  UNKNOWN_TAG_PATTERN,
  VOID_TAGS,
} from './html.constants.ts'
import { FLAT_NODE_KINDS } from './shared.constants.ts'
import { JsonObjectSchema, RefSchema } from './shared.schemas.ts'

// ── Internal helper schemas (not exported) ────────────────────────────────

/**
 * Booleanish — `boolean | 'true' | 'false'`.
 * @internal
 */
const BooleanishSchema = z.union([z.boolean(), z.enum(['true', 'false'])])

/**
 * Cross-origin attribute value.
 * @internal
 */
const CrossOriginSchema = z.enum(['anonymous', 'use-credentials', ''])

/**
 * Anchor target attribute values.
 * @internal
 */
const AnchorTargetSchema = z.enum(['_self', '_blank', '_parent', '_top'])

/**
 * Referrer policy attribute values.
 * @internal
 */
const ReferrerPolicySchema = z.enum([
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
const InputTypeSchema = z.enum([
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
 * Minimal schema for a resolved StylesObject — classNames + stylesheets.
 * @internal
 */
const StylesObjectSchema = z.object({
  classNames: z.array(z.string()).optional(),
  stylesheets: z.array(z.string()),
})

export const ChildSchema = z.union([RefSchema, z.number(), z.string()])

// ── ARIA ───────────────────────────────────────────────────────────────────

const AriaAttributesSchema = z.object({
  'aria-activedescendant': z.union([z.string(), RefSchema]).optional(),
  'aria-atomic': z.union([BooleanishSchema, RefSchema]).optional(),
  'aria-autocomplete': z.union([z.enum(['none', 'inline', 'list', 'both']), RefSchema]).optional(),
  'aria-braillelabel': z.union([z.string(), RefSchema]).optional(),
  'aria-brailleroledescription': z.union([z.string(), RefSchema]).optional(),
  'aria-busy': z.union([BooleanishSchema, RefSchema]).optional(),
  'aria-checked': z.union([z.union([z.boolean(), z.enum(['false', 'mixed', 'true'])]), RefSchema]).optional(),
  'aria-colcount': z.union([z.number(), RefSchema]).optional(),
  'aria-colindex': z.union([z.number(), RefSchema]).optional(),
  'aria-colindextext': z.union([z.string(), RefSchema]).optional(),
  'aria-colspan': z.union([z.number(), RefSchema]).optional(),
  'aria-controls': z.union([z.string(), RefSchema]).optional(),
  'aria-current': z
    .union([z.union([z.boolean(), z.enum(['false', 'true', 'page', 'step', 'location', 'date', 'time'])]), RefSchema])
    .optional(),
  'aria-describedby': z.union([z.string(), RefSchema]).optional(),
  'aria-description': z.union([z.string(), RefSchema]).optional(),
  'aria-details': z.union([z.string(), RefSchema]).optional(),
  'aria-disabled': z.union([BooleanishSchema, RefSchema]).optional(),
  'aria-errormessage': z.union([z.string(), RefSchema]).optional(),
  'aria-expanded': z.union([BooleanishSchema, RefSchema]).optional(),
  'aria-flowto': z.union([z.string(), RefSchema]).optional(),
  'aria-haspopup': z
    .union([z.union([z.boolean(), z.enum(['false', 'true', 'menu', 'listbox', 'tree', 'grid', 'dialog'])]), RefSchema])
    .optional(),
  'aria-hidden': z.union([BooleanishSchema, RefSchema]).optional(),
  'aria-invalid': z
    .union([z.union([z.boolean(), z.enum(['false', 'true', 'grammar', 'spelling'])]), RefSchema])
    .optional(),
  'aria-keyshortcuts': z.union([z.string(), RefSchema]).optional(),
  'aria-label': z.union([z.string(), RefSchema]).optional(),
  'aria-labelledby': z.union([z.string(), RefSchema]).optional(),
  'aria-level': z.union([z.number(), RefSchema]).optional(),
  'aria-live': z.union([z.enum(['off', 'assertive', 'polite']), RefSchema]).optional(),
  'aria-modal': z.union([BooleanishSchema, RefSchema]).optional(),
  'aria-multiline': z.union([BooleanishSchema, RefSchema]).optional(),
  'aria-multiselectable': z.union([BooleanishSchema, RefSchema]).optional(),
  'aria-orientation': z.union([z.enum(['horizontal', 'vertical']), RefSchema]).optional(),
  'aria-owns': z.union([z.string(), RefSchema]).optional(),
  'aria-placeholder': z.union([z.string(), RefSchema]).optional(),
  'aria-posinset': z.union([z.number(), RefSchema]).optional(),
  'aria-pressed': z.union([z.union([z.boolean(), z.enum(['false', 'mixed', 'true'])]), RefSchema]).optional(),
  'aria-readonly': z.union([BooleanishSchema, RefSchema]).optional(),
  'aria-relevant': z
    .union([
      z.enum([
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
      ]),
      RefSchema,
    ])
    .optional(),
  'aria-required': z.union([BooleanishSchema, RefSchema]).optional(),
  'aria-roledescription': z.union([z.string(), RefSchema]).optional(),
  'aria-rowcount': z.union([z.number(), RefSchema]).optional(),
  'aria-rowindex': z.union([z.number(), RefSchema]).optional(),
  'aria-rowindextext': z.union([z.string(), RefSchema]).optional(),
  'aria-rowspan': z.union([z.number(), RefSchema]).optional(),
  'aria-selected': z.union([BooleanishSchema, RefSchema]).optional(),
  'aria-setsize': z.union([z.number(), RefSchema]).optional(),
  'aria-sort': z.union([z.enum(['none', 'ascending', 'descending', 'other']), RefSchema]).optional(),
  'aria-valuemax': z.union([z.number(), RefSchema]).optional(),
  'aria-valuemin': z.union([z.number(), RefSchema]).optional(),
  'aria-valuenow': z.union([z.number(), RefSchema]).optional(),
  'aria-valuetext': z.union([z.string(), RefSchema]).optional(),
})

const AriaRoleSchema = z.enum([
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

export const TemplateObjectSchema = z.object({
  html: z.array(z.string()),
  stylesheets: z.array(z.string()),
  scale: z.literal(Object.values(SCALE)),
  $: z.literal(TEMPLATE_OBJECT_IDENTIFIER),
})

/**
 * Represents the internal structure produced by Plaited's hyperscript factory (`h`).
 * This object contains the processed HTML strings and associated metadata needed for rendering.
 *
 * @property html - An array of string fragments representing the HTML structure.
 * @property stylesheets - CSS stylesheets collected from this template and its children.
 * @property $ - A unique symbol (`TEMPLATE_OBJECT_IDENTIFIER`) used as a type guard to identify Plaited template objects.
 */
export type TemplateObject = z.output<typeof TemplateObjectSchema>

export const ChildrenSchema = z.array(ChildSchema)

/**
 * Represents the children prop in hyperscript. It can be a single valid child (`Child`) or an array of children.
 */
export type Children = z.output<typeof ChildrenSchema>

export const PlaitedAttributesSchema = z.object({
  [CLASS]: z.union([z.string(), RefSchema]).optional(),
  [P_SCALE]: z.union([z.enum(Object.values(SCALE)), RefSchema]).optional(),
  [P_TARGET]: z.union([z.union([z.string(), z.number()]), RefSchema]).optional(),
  [P_TRIGGER]: z.union([z.record(z.string(), z.string()), RefSchema]).optional(),
  [STYLE]: z.union([cssPropertySchema, RefSchema]).optional(),
  [STYLES]: z.union([z.array(StylesObjectSchema), RefSchema]).optional(),
})

export const ASchema = z.object({
  [CLASS]: z.string().optional(),
  [P_SCALE]: z.enum(Object.values(SCALE)).optional(),
  [P_TARGET]: z.union([z.union([z.string(), z.number()])]).optional(),
  [P_TRIGGER]: z.record(z.string(), z.string()).optional(),
  [STYLE]: cssPropertySchema.optional(),
  [STYLES]: StylesObjectSchema.optional(),
})

function unionFromObjectAndSchema<T extends z.ZodRawShape, A extends z.ZodTypeAny>(
  zodObject: z.ZodObject<T>,
  appendSchema: A,
) {
  // 1. Extract individual schemas from the object properties
  const shapeSchemas = Object.values(zodObject.shape) as z.ZodTypeAny[]

  // 2. Combine the object shape schemas with the extra schema
  const allSchemas = [...shapeSchemas, appendSchema] as const

  // 3. Zod requires a tuple with at least two elements for z.union()
  if (allSchemas.length < 2) {
    throw new Error('Union requires at least 2 schemas.')
  }

  // Type assertion ensures TypeScript infers the exact union array types
  return z.union(allSchemas as unknown as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]) as z.ZodUnion<
    [...{ [K in keyof T]: T[K] }, A]
  >
}
const BSchema = unionFromObjectAndSchema(ASchema, RefSchema)

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
    accesskey: z.union([z.string(), RefSchema]).optional(),
    autofocus: z.union([z.boolean(), RefSchema]).optional(),
    contenteditable: z
      .union([z.union([BooleanishSchema, z.enum(['inherit', 'plaintext-only'])]), RefSchema])
      .optional(),
    dir: z.union([z.string(), RefSchema]).optional(),
    draggable: z.union([BooleanishSchema, RefSchema]).optional(),
    hidden: z.union([z.boolean(), RefSchema]).optional(),
    id: z.union([z.union([z.string(), z.number()]), RefSchema]).optional(),
    lang: z.union([z.string(), RefSchema]).optional(),
    nonce: z.union([z.string(), RefSchema]).optional(),
    placeholder: z.union([z.string(), RefSchema]).optional(),
    slot: z.union([z.string(), RefSchema]).optional(),
    spellcheck: z.union([BooleanishSchema, RefSchema]).optional(),
    tabindex: z.union([z.number(), RefSchema]).optional(),
    title: z.union([z.string(), RefSchema]).optional(),
    translate: z.union([z.enum(['yes', 'no']), RefSchema]).optional(),

    // WAI-ARIA
    role: z.union([AriaRoleSchema, RefSchema]).optional(),

    // RDFa Attributes
    about: z.union([z.string(), RefSchema]).optional(),
    content: z.union([z.string(), RefSchema]).optional(),
    datatype: z.union([z.string(), RefSchema]).optional(),
    prefix: z.union([z.string(), RefSchema]).optional(),
    property: z.union([z.string(), RefSchema]).optional(),
    rel: z.union([z.string(), RefSchema]).optional(),
    resource: z.union([z.string(), RefSchema]).optional(),
    rev: z.union([z.string(), RefSchema]).optional(),
    typeof: z.union([z.string(), RefSchema]).optional(),
    vocab: z.union([z.string(), RefSchema]).optional(),

    // Non-standard Attributes
    autocapitalize: z.union([z.enum(['off', 'none', 'on', 'sentences', 'words', 'characters']), RefSchema]).optional(),
    autocorrect: z.union([z.enum(['on', 'off']), RefSchema]).optional(),
    autosave: z.union([z.string(), RefSchema]).optional(),
    itemprop: z.union([z.string(), RefSchema]).optional(),
    itemscope: z.union([z.boolean(), RefSchema]).optional(),
    itemtype: z.union([z.string(), RefSchema]).optional(),
    itemid: z.union([z.string(), RefSchema]).optional(),
    itemref: z.union([z.string(), RefSchema]).optional(),
    results: z.union([z.number(), RefSchema]).optional(),
    security: z.union([z.string(), RefSchema]).optional(),

    // Standard HTML attributes not covered above
    for: z.union([z.string(), RefSchema]).optional(),

    // Living Standard
    inputmode: z
      .union([z.enum(['none', 'text', 'tel', 'url', 'email', 'numeric', 'decimal', 'search']), RefSchema])
      .optional(),
    is: z.union([z.string(), RefSchema]).optional(),
  })
  .catchall(z.union([z.string(), z.number(), z.boolean(), RefSchema]))

export type DetailedHTMLAttributes = z.output<typeof DetailedHTMLAttributesSchema>

// ── Element nodes ─────────────────────────────────────────────────────────

// HTML elements with tag-specific attributes

const DetailedAnchorHTMLAttributesSchema = z.object({
  ...DetailedHTMLAttributesSchema.shape,
  download: z.union([z.boolean(), RefSchema]).optional(),
  href: z.union([z.string(), RefSchema]).optional(),
  hreflang: z.union([z.string(), RefSchema]).optional(),
  media: z.union([z.string(), RefSchema]).optional(),
  ping: z.union([z.string(), RefSchema]).optional(),
  target: z.union([AnchorTargetSchema, RefSchema]).optional(),
  type: z.union([z.string(), RefSchema]).optional(),
  referrerpolicy: z.union([ReferrerPolicySchema, RefSchema]).optional(),
})

const DetailedAreaHTMLAttributesSchema = z.object({
  ...DetailedHTMLAttributesSchema.shape,
  alt: z.union([z.string(), RefSchema]).optional(),
  coords: z.union([z.string(), RefSchema]).optional(),
  download: z.union([z.boolean(), RefSchema]).optional(),
  href: z.union([z.string(), RefSchema]).optional(),
  hreflang: z.union([z.string(), RefSchema]).optional(),
  media: z.union([z.string(), RefSchema]).optional(),
  referrerpolicy: z.union([ReferrerPolicySchema, RefSchema]).optional(),
  shape: z.union([z.string(), RefSchema]).optional(),
  target: z.union([z.string(), RefSchema]).optional(),
})

const DetailedBaseHTMLAttributesSchema = z.object({
  ...DetailedHTMLAttributesSchema.shape,
  href: z.union([z.string(), RefSchema]).optional(),
  target: z.union([z.string(), RefSchema]).optional(),
})

const DetailedBlockquoteHTMLAttributesSchema = z.object({
  ...DetailedHTMLAttributesSchema.shape,
  cite: z.union([z.string(), RefSchema]).optional(),
})

const DetailedButtonHTMLAttributesSchema = z.object({
  ...DetailedHTMLAttributesSchema.shape,
  disabled: z.union([z.boolean(), RefSchema]).optional(),
  form: z.union([z.string(), RefSchema]).optional(),
  formaction: z.union([z.string(), RefSchema]).optional(),
  formenctype: z.union([z.string(), RefSchema]).optional(),
  formmethod: z.union([z.string(), RefSchema]).optional(),
  formnovalidate: z.union([z.boolean(), RefSchema]).optional(),
  formtarget: z.union([z.string(), RefSchema]).optional(),
  name: z.union([z.string(), RefSchema]).optional(),
  type: z.union([z.enum(['submit', 'reset', 'button']), RefSchema]).optional(),
  value: z.union([z.union([z.string(), z.number()]), RefSchema]).optional(),
})

const DetailedCanvasHTMLAttributesSchema = z.object({
  ...DetailedHTMLAttributesSchema.shape,
  height: z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  width: z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
})

const DetailedColHTMLAttributesSchema = z.object({
  ...DetailedHTMLAttributesSchema.shape,
  span: z.union([z.number(), RefSchema]).optional(),
  width: z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
})

const DetailedColgroupHTMLAttributesSchema = z.object({
  ...DetailedHTMLAttributesSchema.shape,
  span: z.union([z.number(), RefSchema]).optional(),
})

const DetailedDataHTMLAttributesSchema = z.object({
  ...DetailedHTMLAttributesSchema.shape,
  value: z.union([z.union([z.string(), z.number()]), RefSchema]).optional(),
})

const DetailedDetailsHTMLAttributesSchema = z.object({
  ...DetailedHTMLAttributesSchema.shape,
  open: z.union([z.boolean(), RefSchema]).optional(),
})

const DetailedDelHTMLAttributesSchema = z.object({
  ...DetailedHTMLAttributesSchema.shape,
  cite: z.union([z.string(), RefSchema]).optional(),
  datetime: z.union([z.string(), RefSchema]).optional(),
})

const DetailedDialogHTMLAttributesSchema = z.object({
  ...DetailedHTMLAttributesSchema.shape,
  open: z.union([z.boolean(), RefSchema]).optional(),
})

const DetailedEmbedHTMLAttributesSchema = z.object({
  ...DetailedHTMLAttributesSchema.shape,
  height: z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  src: z.union([z.string(), RefSchema]).optional(),
  type: z.union([z.string(), RefSchema]).optional(),
  width: z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
})

const DetailedFieldsetHTMLAttributesSchema = z.object({
  ...DetailedHTMLAttributesSchema.shape,
  disabled: z.union([z.boolean(), RefSchema]).optional(),
  form: z.union([z.string(), RefSchema]).optional(),
  name: z.union([z.string(), RefSchema]).optional(),
})

const DetailedFormHTMLAttributesSchema = z.object({
  ...DetailedHTMLAttributesSchema.shape,
  'accept-charset': z.union([z.string(), RefSchema]).optional(),
  action: z.never().optional(),
  autocomplete: z.union([z.string(), RefSchema]).optional(),
  enctype: z.union([z.string(), RefSchema]).optional(),
  method: z.union([z.string(), RefSchema]).optional(),
  name: z.union([z.string(), RefSchema]).optional(),
  novalidate: z.union([z.boolean(), RefSchema]).optional(),
  target: z.union([z.string(), RefSchema]).optional(),
  [P_TRIGGER]: z.never().optional(),
  [P_FORM]: z.union([z.string(), RefSchema]),
})

const DetailedHtmlHTMLAttributesSchema = z.object({
  ...DetailedHTMLAttributesSchema.shape,
  manifest: z.union([z.string(), RefSchema]).optional(),
})

const DetailedIframeHTMLAttributesSchema = z.object({
  ...DetailedHTMLAttributesSchema.shape,
  allow: z.union([z.string(), RefSchema]).optional(),
  height: z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  loading: z.union([z.enum(['eager', 'lazy']), RefSchema]).optional(),
  name: z.union([z.string(), RefSchema]).optional(),
  referrerpolicy: z.union([ReferrerPolicySchema, RefSchema]).optional(),
  sandbox: z.union([z.string(), RefSchema]).optional(),
  seamless: z.union([z.boolean(), RefSchema]).optional(),
  src: z.union([z.string(), RefSchema]).optional(),
  srcdoc: z.union([z.string(), RefSchema]).optional(),
  width: z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
})

const DetailedImgHTMLAttributesSchema = z.object({
  ...DetailedHTMLAttributesSchema.shape,
  alt: z.union([z.string(), RefSchema]).optional(),
  crossorigin: z.union([CrossOriginSchema, RefSchema]).optional(),
  decoding: z.union([z.enum(['async', 'auto', 'sync']), RefSchema]).optional(),
  height: z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  loading: z.union([z.enum(['eager', 'lazy']), RefSchema]).optional(),
  referrerpolicy: z.union([ReferrerPolicySchema, RefSchema]).optional(),
  sizes: z.union([z.string(), RefSchema]).optional(),
  src: z.union([z.string(), RefSchema]).optional(),
  srcset: z.union([z.string(), RefSchema]).optional(),
  usemap: z.union([z.string(), RefSchema]).optional(),
  width: z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
})

const DetailedInputHTMLAttributesSchema = z.object({
  ...DetailedHTMLAttributesSchema.shape,
  accept: z.union([z.string(), RefSchema]).optional(),
  alt: z.union([z.string(), RefSchema]).optional(),
  autocomplete: z.union([z.string(), RefSchema]).optional(),
  capture: z.union([z.union([z.boolean(), z.enum(['user', 'environment'])]), RefSchema]).optional(),
  checked: z.union([z.boolean(), RefSchema]).optional(),
  disabled: z.union([z.boolean(), RefSchema]).optional(),
  enterkeyhint: z.union([z.enum(['enter', 'done', 'go', 'next', 'previous', 'search', 'send']), RefSchema]).optional(),
  form: z.union([z.string(), RefSchema]).optional(),
  formaction: z.union([z.string(), RefSchema]).optional(),
  formenctype: z.union([z.string(), RefSchema]).optional(),
  formmethod: z.union([z.string(), RefSchema]).optional(),
  formnovalidate: z.union([z.boolean(), RefSchema]).optional(),
  formtarget: z.union([z.string(), RefSchema]).optional(),
  height: z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  list: z.union([z.string(), RefSchema]).optional(),
  max: z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  maxlength: z.union([z.number(), RefSchema]).optional(),
  min: z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  minlength: z.union([z.number(), RefSchema]).optional(),
  multiple: z.union([z.boolean(), RefSchema]).optional(),
  name: z.union([z.string(), RefSchema]).optional(),
  pattern: z.union([z.string(), RefSchema]).optional(),
  placeholder: z.union([z.string(), RefSchema]).optional(),
  readonly: z.union([z.boolean(), RefSchema]).optional(),
  required: z.union([z.boolean(), RefSchema]).optional(),
  size: z.union([z.number(), RefSchema]).optional(),
  src: z.union([z.string(), RefSchema]).optional(),
  step: z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  type: z.union([InputTypeSchema, RefSchema]).optional(),
  value: z.union([z.union([z.string(), z.number()]), RefSchema]).optional(),
  width: z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
})

const DetailedInsHTMLAttributesSchema = z.object({
  ...DetailedHTMLAttributesSchema.shape,
  cite: z.union([z.string(), RefSchema]).optional(),
  datetime: z.union([z.string(), RefSchema]).optional(),
})

const DetailedLabelHTMLAttributesSchema = z.object({
  ...DetailedHTMLAttributesSchema.shape,
  form: z.union([z.string(), RefSchema]).optional(),
  for: z.union([z.string(), RefSchema]).optional(),
})

const DetailedLiHTMLAttributesSchema = z.object({
  ...DetailedHTMLAttributesSchema.shape,
  value: z.union([z.union([z.string(), z.number()]), RefSchema]).optional(),
})

const DetailedLinkHTMLAttributesSchema = z.object({
  ...DetailedHTMLAttributesSchema.shape,
  as: z.union([z.string(), RefSchema]).optional(),
  crossorigin: z.union([CrossOriginSchema, RefSchema]).optional(),
  fetchPriority: z.union([z.enum(['high', 'low', 'auto']), RefSchema]).optional(),
  href: z.union([z.string(), RefSchema]).optional(),
  hreflang: z.union([z.string(), RefSchema]).optional(),
  integrity: z.union([z.string(), RefSchema]).optional(),
  media: z.union([z.string(), RefSchema]).optional(),
  imagesrcset: z.union([z.string(), RefSchema]).optional(),
  imagesizes: z.union([z.string(), RefSchema]).optional(),
  referrerpolicy: z.union([ReferrerPolicySchema, RefSchema]).optional(),
  sizes: z.union([z.string(), RefSchema]).optional(),
  type: z.union([z.string(), RefSchema]).optional(),
  charSet: z.union([z.string(), RefSchema]).optional(),
})

const DetailedMapHTMLAttributesSchema = z.object({
  ...DetailedHTMLAttributesSchema.shape,
  name: z.union([z.string(), RefSchema]).optional(),
})

const DetailedMenuHTMLAttributesSchema = z.object({
  ...DetailedHTMLAttributesSchema.shape,
  type: z.union([z.string(), RefSchema]).optional(),
})

const DetailedMetaHTMLAttributesSchema = z.object({
  ...DetailedHTMLAttributesSchema.shape,
  charset: z.union([z.string(), RefSchema]).optional(),
  'http-equiv': z.union([z.string(), RefSchema]).optional(),
  name: z.union([z.string(), RefSchema]).optional(),
  media: z.union([z.string(), RefSchema]).optional(),
  content: z.union([z.string(), RefSchema]).optional(),
})

const DetailedMeterHTMLAttributesSchema = z.object({
  ...DetailedHTMLAttributesSchema.shape,
  form: z.union([z.string(), RefSchema]).optional(),
  high: z.union([z.number(), RefSchema]).optional(),
  low: z.union([z.number(), RefSchema]).optional(),
  max: z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  min: z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  optimum: z.union([z.number(), RefSchema]).optional(),
  value: z.union([z.union([z.string(), z.number()]), RefSchema]).optional(),
})

const DetailedObjectHTMLAttributesSchema = z.object({
  ...DetailedHTMLAttributesSchema.shape,
  classid: z.union([z.string(), RefSchema]).optional(),
  data: z.union([z.string(), RefSchema]).optional(),
  form: z.union([z.string(), RefSchema]).optional(),
  height: z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  name: z.union([z.string(), RefSchema]).optional(),
  type: z.union([z.string(), RefSchema]).optional(),
  usemap: z.union([z.string(), RefSchema]).optional(),
  width: z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
})

const DetailedOlHTMLAttributesSchema = z.object({
  ...DetailedHTMLAttributesSchema.shape,
  reversed: z.union([z.boolean(), RefSchema]).optional(),
  start: z.union([z.number(), RefSchema]).optional(),
  type: z.union([z.enum(['1', 'a', 'A', 'i', 'I']), RefSchema]).optional(),
})

const DetailedOptgroupHTMLAttributesSchema = z.object({
  ...DetailedHTMLAttributesSchema.shape,
  disabled: z.union([z.boolean(), RefSchema]).optional(),
  label: z.union([z.string(), RefSchema]).optional(),
})

const DetailedOptionHTMLAttributesSchema = z.object({
  ...DetailedHTMLAttributesSchema.shape,
  disabled: z.union([z.boolean(), RefSchema]).optional(),
  label: z.union([z.string(), RefSchema]).optional(),
  selected: z.union([z.boolean(), RefSchema]).optional(),
  value: z.union([z.union([z.string(), z.number()]), RefSchema]).optional(),
})

const DetailedOutputHTMLAttributesSchema = z.object({
  ...DetailedHTMLAttributesSchema.shape,
  form: z.union([z.string(), RefSchema]).optional(),
  for: z.union([z.string(), RefSchema]).optional(),
  name: z.union([z.string(), RefSchema]).optional(),
})

const DetailedProgressHTMLAttributesSchema = z.object({
  ...DetailedHTMLAttributesSchema.shape,
  max: z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  value: z.union([z.union([z.string(), z.number()]), RefSchema]).optional(),
})

const DetailedQuoteHTMLAttributesSchema = z.object({
  ...DetailedHTMLAttributesSchema.shape,
  cite: z.union([z.string(), RefSchema]).optional(),
})

const DetailedSlotHTMLAttributesSchema = z.object({
  ...DetailedHTMLAttributesSchema.shape,
  name: z.union([z.string(), RefSchema]).optional(),
})

const DetailedScriptHTMLAttributesSchema = z.object({
  ...DetailedHTMLAttributesSchema.shape,
  async: z.union([z.boolean(), RefSchema]).optional(),
  crossorigin: z.union([CrossOriginSchema, RefSchema]).optional(),
  defer: z.union([z.boolean(), RefSchema]).optional(),
  integrity: z.union([z.string(), RefSchema]).optional(),
  nomodule: z.union([z.boolean(), RefSchema]).optional(),
  referrerpolicy: z.union([ReferrerPolicySchema, RefSchema]).optional(),
  src: z.union([z.string(), RefSchema]).optional(),
  type: z.union([z.string(), RefSchema]).optional(),
})

const DetailedSelectHTMLAttributesSchema = z.object({
  ...DetailedHTMLAttributesSchema.shape,
  autocomplete: z.union([z.string(), RefSchema]).optional(),
  disabled: z.union([z.boolean(), RefSchema]).optional(),
  form: z.union([z.string(), RefSchema]).optional(),
  multiple: z.union([z.boolean(), RefSchema]).optional(),
  name: z.union([z.string(), RefSchema]).optional(),
  required: z.union([z.boolean(), RefSchema]).optional(),
  size: z.union([z.number(), RefSchema]).optional(),
  value: z.union([z.union([z.string(), z.number()]), RefSchema]).optional(),
})

const DetailedSourceHTMLAttributesSchema = z.object({
  ...DetailedHTMLAttributesSchema.shape,
  height: z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  media: z.union([z.string(), RefSchema]).optional(),
  sizes: z.union([z.string(), RefSchema]).optional(),
  src: z.union([z.string(), RefSchema]).optional(),
  srcset: z.union([z.string(), RefSchema]).optional(),
  type: z.union([z.string(), RefSchema]).optional(),
  width: z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
})

const DetailedStyleHTMLAttributesSchema = z.object({
  ...DetailedHTMLAttributesSchema.shape,
  media: z.union([z.string(), RefSchema]).optional(),
})

const DetailedTableHTMLAttributesSchema = z.object({
  ...DetailedHTMLAttributesSchema.shape,
  align: z.union([z.enum(['left', 'center', 'right']), RefSchema]).optional(),
  bgcolor: z.union([z.string(), RefSchema]).optional(),
  border: z.union([z.number(), RefSchema]).optional(),
  cellpadding: z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  cellspacing: z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  frame: z.union([z.boolean(), RefSchema]).optional(),
  rules: z.union([z.enum(['none', 'groups', 'rows', 'columns', 'all']), RefSchema]).optional(),
  summary: z.union([z.string(), RefSchema]).optional(),
  width: z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
})

const DetailedTemplateHTMLAttributesSchema = z.object({
  ...DetailedHTMLAttributesSchema.shape,
  shadowrootmode: z.union([z.enum(['open', 'closed']), RefSchema]).optional(),
  shadowrootdelegatesfocus: z.union([z.boolean(), RefSchema]).optional(),
  shadowrootclonable: z.union([z.boolean(), RefSchema]).optional(),
})

const DetailedTextareaHTMLAttributesSchema = z.object({
  ...DetailedHTMLAttributesSchema.shape,
  autocomplete: z.union([z.string(), RefSchema]).optional(),
  cols: z.union([z.number(), RefSchema]).optional(),
  dirname: z.union([z.string(), RefSchema]).optional(),
  disabled: z.union([z.boolean(), RefSchema]).optional(),
  form: z.union([z.string(), RefSchema]).optional(),
  maxlength: z.union([z.number(), RefSchema]).optional(),
  minlength: z.union([z.number(), RefSchema]).optional(),
  name: z.union([z.string(), RefSchema]).optional(),
  placeholder: z.union([z.string(), RefSchema]).optional(),
  readonly: z.union([z.boolean(), RefSchema]).optional(),
  required: z.union([z.boolean(), RefSchema]).optional(),
  rows: z.union([z.number(), RefSchema]).optional(),
  value: z.union([z.union([z.string(), z.number()]), RefSchema]).optional(),
  wrap: z.union([z.string(), RefSchema]).optional(),
})

const DetailedTdHTMLAttributesSchema = z.object({
  ...DetailedHTMLAttributesSchema.shape,
  align: z.union([z.enum(['left', 'center', 'right', 'justify', 'char']), RefSchema]).optional(),
  colspan: z.union([z.number(), RefSchema]).optional(),
  headers: z.union([z.string(), RefSchema]).optional(),
  rowspan: z.union([z.number(), RefSchema]).optional(),
  scope: z.union([z.string(), RefSchema]).optional(),
  abbr: z.union([z.string(), RefSchema]).optional(),
  height: z.union([z.string(), RefSchema]).optional(),
  width: z.union([z.string(), RefSchema]).optional(),
  valign: z.union([z.enum(['top', 'middle', 'bottom', 'baseline']), RefSchema]).optional(),
})

const DetailedThHTMLAttributesSchema = z.object({
  ...DetailedHTMLAttributesSchema.shape,
  align: z.union([z.enum(['left', 'center', 'right', 'justify', 'char']), RefSchema]).optional(),
  colspan: z.union([z.number(), RefSchema]).optional(),
  headers: z.union([z.string(), RefSchema]).optional(),
  rowspan: z.union([z.number(), RefSchema]).optional(),
  scope: z.union([z.string(), RefSchema]).optional(),
  abbr: z.union([z.string(), RefSchema]).optional(),
})

const DetailedTimeHTMLAttributesSchema = z.object({
  ...DetailedHTMLAttributesSchema.shape,
  datetime: z.union([z.string(), RefSchema]).optional(),
})

const DetailedTrackHTMLAttributesSchema = z.object({
  ...DetailedHTMLAttributesSchema.shape,
  default: z.union([z.boolean(), RefSchema]).optional(),
  kind: z.union([z.enum(['subtitles', 'captions', 'descriptions', 'chapters', 'metadata']), RefSchema]).optional(),
  label: z.union([z.string(), RefSchema]).optional(),
  src: z.union([z.string(), RefSchema]).optional(),
  srclang: z.union([z.string(), RefSchema]).optional(),
})

// Media-based elements

const DetailedAudioHTMLAttributesSchema = z.object({
  ...DetailedHTMLAttributesSchema.shape,
  autoplay: z.union([z.boolean(), RefSchema]).optional(),
  controls: z.union([z.boolean(), RefSchema]).optional(),
  controlslist: z.union([z.string(), RefSchema]).optional(),
  crossorigin: z.union([CrossOriginSchema, RefSchema]).optional(),
  loop: z.union([z.boolean(), RefSchema]).optional(),
  mediagroup: z.union([z.string(), RefSchema]).optional(),
  muted: z.union([z.boolean(), RefSchema]).optional(),
  playsinline: z.union([z.boolean(), RefSchema]).optional(),
  preload: z.union([z.string(), RefSchema]).optional(),
  src: z.union([z.string(), RefSchema]).optional(),
})

const DetailedVideoHTMLAttributesSchema = z.object({
  ...DetailedAudioHTMLAttributesSchema.shape,
  height: z.union([z.string(), RefSchema]).optional(),
  playsinline: z.union([z.boolean(), RefSchema]).optional(),
  poster: z.union([z.string(), RefSchema]).optional(),
  width: z.union([z.string(), RefSchema]).optional(),
  disablepictureinpicture: z.union([z.boolean(), RefSchema]).optional(),
  disableremoteplayback: z.union([z.boolean(), RefSchema]).optional(),
})

// ── SVG Attributes ─────────────────────────────────────────────────────────

const DetailedSVGAttributesSchema = z.object({
  ...DetailedHTMLAttributesSchema.shape,
  'accent-height': z.union([z.number(), RefSchema]).optional(),
  accumulate: z.union([z.union([z.enum(['none', 'sum']), z.string()]), RefSchema]).optional(),
  additive: z.union([z.union([z.enum(['replace', 'sum']), z.string()]), RefSchema]).optional(),
  'alignment-baseline': z
    .union([
      z.union([
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
      ]),
      RefSchema,
    ])
    .optional(),
  allowReorder: z.union([z.union([z.enum(['no', 'yes']), z.string()]), RefSchema]).optional(),
  amplitude: z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  attributeName: z.union([z.string(), RefSchema]).optional(),
  attributeType: z.union([z.string(), RefSchema]).optional(),
  autoReverse: z.union([BooleanishSchema, RefSchema]).optional(),
  azimuth: z.union([z.number(), RefSchema]).optional(),
  baseFrequency: z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  'baseline-shift': z.union([z.union([z.enum(['sub', 'super']), z.number(), z.string()]), RefSchema]).optional(),
  baseProfile: z.union([z.string(), RefSchema]).optional(),
  begin: z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  bias: z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  by: z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  calcMode: z.union([z.union([z.enum(['discrete', 'linear', 'paced', 'spline']), z.string()]), RefSchema]).optional(),
  'clip-path': z.union([z.string(), RefSchema]).optional(),
  'clip-rule': z.union([z.union([z.enum(['nonzero', 'evenodd', 'inherit']), z.string()]), RefSchema]).optional(),
  clipPathUnits: z
    .union([z.union([z.enum(['userSpaceOnUse', 'objectBoundingBox']), z.string()]), RefSchema])
    .optional(),
  color: z.union([z.string(), RefSchema]).optional(),
  'color-interpolation': z
    .union([z.union([z.enum(['auto', 'sRGB', 'linearRGB', 'inherit']), z.string()]), RefSchema])
    .optional(),
  'color-interpolation-filters': z.union([z.string(), RefSchema]).optional(),
  'color-rendering': z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  contentScriptType: z.union([z.string(), RefSchema]).optional(),
  contentStyleType: z.union([z.string(), RefSchema]).optional(),
  cursor: z.union([z.string(), RefSchema]).optional(),
  cx: z.union([z.string(), RefSchema]).optional(),
  cy: z.union([z.string(), RefSchema]).optional(),
  d: z.union([z.string(), RefSchema]).optional(),
  decoding: z.union([z.union([z.enum(['sync', 'async', 'auto']), z.string()]), RefSchema]).optional(),
  diffuseConstant: z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  direction: z.union([z.union([z.enum(['ltr', 'rtl']), z.string()]), RefSchema]).optional(),
  display: z.union([z.string(), RefSchema]).optional(),
  divisor: z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  'dominant-baseline': z
    .union([
      z.union([
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
      ]),
      RefSchema,
    ])
    .optional(),
  dur: z.union([z.union([z.enum(['media', 'indefinite']), z.number(), z.string()]), RefSchema]).optional(),
  dx: z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  dy: z.union([z.union([z.number(), z.number(), z.string()]), RefSchema]).optional(),
  edgeMode: z.union([z.string(), RefSchema]).optional(),
  elevation: z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  end: z.union([z.string(), RefSchema]).optional(),
  exponent: z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  fill: z.union([z.string(), RefSchema]).optional(),
  'fill-opacity': z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  'fill-rule': z.union([z.union([z.enum(['nonzero', 'evenodd', 'inherit']), z.string()]), RefSchema]).optional(),
  filter: z.union([z.string(), RefSchema]).optional(),
  filterRes: z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  filterUnits: z.union([z.union([z.enum(['userSpaceOnUse', 'objectBoundingBox']), z.string()]), RefSchema]).optional(),
  'flood-color': z.union([z.string(), RefSchema]).optional(),
  'flood-opacity': z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  focusable: z.union([z.union([BooleanishSchema, z.literal('auto')]), RefSchema]).optional(),
  'font-family': z.union([z.string(), RefSchema]).optional(),
  'font-size': z.union([z.string(), RefSchema]).optional(),
  'font-size-adjust': z.union([z.string(), RefSchema]).optional(),
  'font-stretch': z.union([z.string(), RefSchema]).optional(),
  'font-style': z.union([z.string(), RefSchema]).optional(),
  'font-variant': z.union([z.string(), RefSchema]).optional(),
  'font-weight': z.union([z.string(), RefSchema]).optional(),
  fr: z.union([z.string(), RefSchema]).optional(),
  from: z.union([z.string(), RefSchema]).optional(),
  fx: z.union([z.string(), RefSchema]).optional(),
  fy: z.union([z.string(), RefSchema]).optional(),
  gradientTransform: z.union([z.string(), RefSchema]).optional(),
  gradientUnits: z
    .union([z.union([z.enum(['userSpaceOnUse', 'objectBoundingBox']), z.string()]), RefSchema])
    .optional(),
  href: z.union([z.string(), RefSchema]).optional(),
  'image-rendering': z
    .union([z.union([z.enum(['auto', 'optimizeSpeed', 'optimizeQuality']), z.string()]), RefSchema])
    .optional(),
  in: z
    .union([
      z.union([
        z.enum(['SourceGraphic', 'SourceAlpha', 'BackgroundImage', 'BackgroundAlpha', 'FillPaint', 'StrokePaint']),
        z.string(),
      ]),
      RefSchema,
    ])
    .optional(),
  in2: z
    .union([
      z.union([
        z.enum(['SourceGraphic', 'SourceAlpha', 'BackgroundImage', 'BackgroundAlpha', 'FillPaint', 'StrokePaint']),
        z.string(),
      ]),
      RefSchema,
    ])
    .optional(),
  intercept: z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  k1: z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  k2: z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  k3: z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  k4: z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  kernelMatrix: z.union([z.string(), RefSchema]).optional(),
  kernelUnitLength: z.union([z.string(), RefSchema]).optional(),
  keyPoints: z.union([z.string(), RefSchema]).optional(),
  keySplines: z.union([z.string(), RefSchema]).optional(),
  keyTimes: z.union([z.string(), RefSchema]).optional(),
  lengthAdjust: z.union([z.union([z.enum(['spacing', 'spacingAndGlyphs']), z.string()]), RefSchema]).optional(),
  'letter-spacing': z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  'lighting-color': z.union([z.string(), RefSchema]).optional(),
  limitingConeAngle: z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  'marker-end': z.union([z.string(), RefSchema]).optional(),
  'marker-mid': z.union([z.string(), RefSchema]).optional(),
  'marker-start': z.union([z.string(), RefSchema]).optional(),
  markerHeight: z.union([z.union([z.string(), z.number()]), RefSchema]).optional(),
  markerUnits: z.union([z.union([z.enum(['userSpaceOnUse', 'strokeWidth']), z.string()]), RefSchema]).optional(),
  markerWidth: z.union([z.union([z.string(), z.number()]), RefSchema]).optional(),
  mask: z.union([z.string(), RefSchema]).optional(),
  maskContentUnits: z
    .union([z.union([z.enum(['userSpaceOnUse', 'objectBoundingBox']), z.string()]), RefSchema])
    .optional(),
  maskUnits: z.union([z.union([z.enum(['userSpaceOnUse', 'objectBoundingBox']), z.string()]), RefSchema]).optional(),
  method: z.union([z.enum(['align', 'stretch']), RefSchema]).optional(),
  mode: z.union([z.string(), RefSchema]).optional(),
  numOctaves: z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  offset: z.union([z.string(), RefSchema]).optional(),
  opacity: z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  operator: z.union([z.string(), RefSchema]).optional(),
  order: z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  orient: z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  origin: z.union([z.string(), RefSchema]).optional(),
  overflow: z.union([z.union([z.enum(['visible', 'hidden', 'scroll', 'auto']), z.string()]), RefSchema]).optional(),
  'overline-position': z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  'overline-thickness': z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  'paint-order': z.union([z.string(), RefSchema]).optional(),
  path: z.union([z.string(), RefSchema]).optional(),
  pathLength: z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  patternContentUnits: z
    .union([z.union([z.enum(['userSpaceOnUse', 'objectBoundingBox']), z.string()]), RefSchema])
    .optional(),
  patternTransform: z.union([z.string(), RefSchema]).optional(),
  patternUnits: z.union([z.union([z.enum(['userSpaceOnUse', 'objectBoundingBox']), z.string()]), RefSchema]).optional(),
  'pointer-events': z
    .union([
      z.union([
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
      ]),
      RefSchema,
    ])
    .optional(),
  points: z.union([z.string(), RefSchema]).optional(),
  pointsAtX: z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  pointsAtY: z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  pointsAtZ: z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  preserveAlpha: z.union([z.enum(['true', 'false']), RefSchema]).optional(),
  preserveAspectRatio: z.union([z.string(), RefSchema]).optional(),
  primitiveUnits: z
    .union([z.union([z.enum(['userSpaceOnUse', 'objectBoundingBox']), z.string()]), RefSchema])
    .optional(),
  r: z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  radius: z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  refX: z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  refY: z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  repeatCount: z.union([z.union([z.enum(['indefinite']), z.number(), z.string()]), RefSchema]).optional(),
  repeatDur: z.union([z.union([z.enum(['indefinite']), z.string()]), RefSchema]).optional(),
  restart: z.union([z.union([z.enum(['always', 'whenNotActive', 'never']), z.string()]), RefSchema]).optional(),
  result: z.union([z.string(), RefSchema]).optional(),
  rotate: z.union([z.union([z.enum(['auto', 'auto-reverse']), z.number(), z.string()]), RefSchema]).optional(),
  rx: z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  ry: z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  scale: z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  seed: z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  'shape-rendering': z
    .union([z.union([z.enum(['auto', 'optimizeSpeed', 'crispEdges', 'geometricPrecision']), z.string()]), RefSchema])
    .optional(),
  spacing: z.union([z.enum(['auto', 'exact']), RefSchema]).optional(),
  specularConstant: z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  specularExponent: z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  spreadMethod: z.union([z.union([z.enum(['pad', 'reflect', 'repeat']), z.string()]), RefSchema]).optional(),
  startOffset: z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  stdDeviation: z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  stitchTiles: z.union([z.union([z.enum(['noStitch', 'stitch']), z.string()]), RefSchema]).optional(),
  'stop-color': z.union([z.string(), RefSchema]).optional(),
  'stop-opacity': z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  'strikethrough-position': z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  'strikethrough-thickness': z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  stroke: z.union([z.string(), RefSchema]).optional(),
  'stroke-dasharray': z.union([z.string(), RefSchema]).optional(),
  'stroke-dashoffset': z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  'stroke-linecap': z
    .union([z.union([z.enum(['butt', 'round', 'square', 'inherit']), z.string()]), RefSchema])
    .optional(),
  'stroke-linejoin': z
    .union([z.union([z.enum(['arcs', 'bevel', 'miter', 'miter-clip', 'round', 'inherit']), z.string()]), RefSchema])
    .optional(),
  'stroke-miterlimit': z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  'stroke-opacity': z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  'stroke-width': z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  surfaceScale: z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  systemLanguage: z.union([z.string(), RefSchema]).optional(),
  tableValues: z.union([z.string(), RefSchema]).optional(),
  targetX: z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  targetY: z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  'text-anchor': z.union([z.union([z.enum(['start', 'middle', 'end']), z.string()]), RefSchema]).optional(),
  'text-decoration': z.union([z.string(), RefSchema]).optional(),
  'text-rendering': z
    .union([
      z.union([z.enum(['auto', 'optimizeSpeed', 'optimizeLegibility', 'geometricPrecision']), z.string()]),
      RefSchema,
    ])
    .optional(),
  textLength: z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  to: z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  transform: z.union([z.string(), RefSchema]).optional(),
  'transform-origin': z.union([z.string(), RefSchema]).optional(),
  'underline-position': z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  'underline-thickness': z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  values: z.union([z.string(), RefSchema]).optional(),
  'vector-effect': z
    .union([
      z.union([
        z.enum(['none', 'non-scaling-stroke', 'non-scaling-size', 'non-rotation', 'fixed-position']),
        z.string(),
      ]),
      RefSchema,
    ])
    .optional(),
  viewBox: z.union([z.string(), RefSchema]).optional(),
  visibility: z.union([z.union([z.enum(['visible', 'hidden', 'collapse']), z.string()]), RefSchema]).optional(),
  'word-spacing': z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  'writing-mode': z
    .union([z.union([z.enum(['horizontal-tb', 'vertical-rl', 'vertical-lr']), z.string()]), RefSchema])
    .optional(),
  x: z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  x1: z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  x2: z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  xChannelSelector: z.union([z.union([z.enum(['R', 'G', 'B', 'A']), z.string()]), RefSchema]).optional(),
  y: z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  y1: z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  y2: z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
  yChannelSelector: z.union([z.union([z.enum(['R', 'G', 'B', 'A']), z.string()]), RefSchema]).optional(),
  z: z.union([z.union([z.number(), z.string()]), RefSchema]).optional(),
})

export const ElementAttributeListSchema = z.object({
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
  html: DetailedHtmlHTMLAttributesSchema,
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
  //SVG
  svg: DetailedSVGAttributesSchema,
  animate: DetailedSVGAttributesSchema,
  circle: DetailedSVGAttributesSchema,
  animateMotion: DetailedSVGAttributesSchema,
  animateTransform: DetailedSVGAttributesSchema,
  clipPath: DetailedSVGAttributesSchema,
  defs: DetailedSVGAttributesSchema,
  desc: DetailedSVGAttributesSchema,
  ellipse: DetailedSVGAttributesSchema,
  feBlend: DetailedSVGAttributesSchema,
  feColorMatrix: DetailedSVGAttributesSchema,
  feComponentTransfer: DetailedSVGAttributesSchema,
  feComposite: DetailedSVGAttributesSchema,
  feConvolveMatrix: DetailedSVGAttributesSchema,
  feDiffuseLighting: DetailedSVGAttributesSchema,
  feDisplacementMap: DetailedSVGAttributesSchema,
  feDistantLight: DetailedSVGAttributesSchema,
  feDropShadow: DetailedSVGAttributesSchema,
  feFlood: DetailedSVGAttributesSchema,
  feFuncA: DetailedSVGAttributesSchema,
  feFuncB: DetailedSVGAttributesSchema,
  feFuncG: DetailedSVGAttributesSchema,
  feFuncR: DetailedSVGAttributesSchema,
  feGaussianBlur: DetailedSVGAttributesSchema,
  feImage: DetailedSVGAttributesSchema,
  feMerge: DetailedSVGAttributesSchema,
  feMergeNode: DetailedSVGAttributesSchema,
  feMorphology: DetailedSVGAttributesSchema,
  feOffset: DetailedSVGAttributesSchema,
  fePointLight: DetailedSVGAttributesSchema,
  feSpecularLighting: DetailedSVGAttributesSchema,
  feSpotLight: DetailedSVGAttributesSchema,
  feTile: DetailedSVGAttributesSchema,
  feTurbulence: DetailedSVGAttributesSchema,
  filter: DetailedSVGAttributesSchema,
  foreignObject: DetailedSVGAttributesSchema,
  g: DetailedSVGAttributesSchema,
  image: DetailedSVGAttributesSchema,
  line: DetailedSVGAttributesSchema,
  linearGradient: DetailedSVGAttributesSchema,
  marker: DetailedSVGAttributesSchema,
  mask: DetailedSVGAttributesSchema,
  metadata: DetailedSVGAttributesSchema,
  mpath: DetailedSVGAttributesSchema,
  path: DetailedSVGAttributesSchema,
  pattern: DetailedSVGAttributesSchema,
  polygon: DetailedSVGAttributesSchema,
  polyline: DetailedSVGAttributesSchema,
  radialGradient: DetailedSVGAttributesSchema,
  rect: DetailedSVGAttributesSchema,
  set: DetailedSVGAttributesSchema,
  stop: DetailedSVGAttributesSchema,
  switch: DetailedSVGAttributesSchema,
  symbol: DetailedSVGAttributesSchema,
  text: DetailedSVGAttributesSchema,
  textPath: DetailedSVGAttributesSchema,
  tspan: DetailedSVGAttributesSchema,
  use: DetailedSVGAttributesSchema,
  view: DetailedSVGAttributesSchema,
})

const ElementKeysSchema = ElementAttributeListSchema.keyof()

/**
 * Schema for custom element tag names (must match `${string}-${string}` pattern).
 *
 * @public
 */
export const CustomElementTagSchema = z.string().regex(CUSTOM_ELEMENT_TAG_PATTERN)

/** @public */
export type CustomElementTag = `${string}-${string}`

/**
 * Schema for custom element tag names (must match `${string}-${string}` pattern).
 *
 * @public
 */
const UnknownElementTagSchema = z.string().regex(UNKNOWN_TAG_PATTERN)

export const ElementNodeSchema = z.object({
  kind: z.literal(FLAT_NODE_KINDS.element),
  tag: z.union([CustomElementTagSchema, UnknownElementTagSchema]),
  children: ChildrenSchema.optional(),
  attributes: DetailedHTMLAttributesSchema.optional(),
  meta: JsonObjectSchema.optional(),
})

export type ElementNode = z.output<typeof ElementNodeSchema>

export const getNodeSchema = (tag: string) => {
  const result = ElementKeysSchema.safeParse(tag)
  if (result.success) {
    const knownTag = result.data
    return z.object({
      ...ElementNodeSchema.shape,
      tag: z.literal(knownTag),
      ...(VOID_TAGS.has(knownTag) ? { children: z.never().optional() } : {}),
      attributes: ElementAttributeListSchema.shape[knownTag].optional(),
    })
  } else {
    return ElementNodeSchema
  }
}
