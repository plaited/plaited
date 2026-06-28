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
import { CUSTOM_ELEMENT_TAG_PATTERN, P_FORM, P_SCALE, P_TARGET, P_TRIGGER } from './template.constants.ts'

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

// ── ARIA ───────────────────────────────────────────────────────────────────

/**
 * Schema for WAI-ARIA attributes.
 *
 * @public
 */
export const AriaAttributesSchema = z.object({
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

/** @public */
export type AriaAttributes = z.output<typeof AriaAttributesSchema>

// ── ARIA role ──────────────────────────────────────────────────────────────

/**
 * Schema for the ARIA `role` attribute.
 *
 * @public
 */
export const ariaRoleSchema = z.enum([
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

/** @public */
export type AriaRole = z.output<typeof ariaRoleSchema>

// ── Custom element tag ─────────────────────────────────────────────────────

/**
 * Schema for custom element tag names (must match `${string}-${string}` pattern).
 *
 * @public
 */
export const customElementTagSchema = z.string().regex(CUSTOM_ELEMENT_TAG_PATTERN)

/** @public */
export type CustomElementTag = z.output<typeof customElementTagSchema>

// ── Children (id-ref form for catalog JSON) ────────────────────────────────

/**
 * Schema for a child reference in the component catalog.
 * Children are either a single string/number ID ref or an array of ID refs.
 *
 * @public
 */
export const childRefSchema = z.union([z.string(), z.number()])

/** @public */
export type ChildRef = z.output<typeof childRefSchema>

/**
 * Schema for a collection of child references.
 *
 * @public
 */
export const childrenRefsSchema = z.union([childRefSchema, z.array(childRefSchema)])

/** @public */
export type ChildrenRefs = z.output<typeof childrenRefsSchema>

// ── Plaited-specific attributes ────────────────────────────────────────────

/**
 * Schema for Plaited-specific extension attributes (p-target, p-trigger, etc.).
 *
 * @public
 */
export const PlaitedAttributesSchema = z.object({
  class: z.string().optional(),
  children: z.any().optional(),
  [P_TARGET]: z.union([z.string(), z.number()]).optional(),
  [P_TRIGGER]: z.record(z.string(), z.string()).optional(),
  [P_SCALE]: z.enum(['s1', 's2', 's3', 's4', 's5', 's6', 'rel']).optional(),
  [P_FORM]: z.string().optional(),
  stylesheets: z.array(z.string()).optional(),
  classNames: z.array(z.string()).optional(),
  style: cssPropertiesSchema.optional(),
})

/** @public */
export type PlaitedAttributes = z.output<typeof PlaitedAttributesSchema>

// ── Standard HTML attributes ───────────────────────────────────────────────

/**
 * Schema for standard HTML attributes combined with ARIA and Plaited attributes.
 *
 * @public
 */
export const HtmlAttributesSchema = AriaAttributesSchema.merge(PlaitedAttributesSchema).merge(
  z.object({
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
  }),
)

/** @public */
export type HtmlAttributes = z.output<typeof HtmlAttributesSchema>

// ── Detailed HTML attributes ──

/**
 * Schema extending `HtmlAttributesSchema` with a catchall for `data-*` and
 * arbitrary custom attributes.
 *
 * The catchall uses `z.any()` to match the runtime `Record<string, any>`
 * escape hatch — at validation time, extra keys are accepted without
 * narrowing their values (since runtime properties like `classNames`,
 * `style`, `p-trigger` carry non-primitive types that would conflict with
 * a `string | number | boolean` index signature).
 *
 * Catalog-json validation can add a tighter constraint via `.pipe()` or
 * `.catchall(z.union([z.string(), z.number(), z.boolean()]))`.
 *
 * @public
 */
export const DetailedHtmlAttributesSchema = HtmlAttributesSchema.catchall(z.any())

/** @public */
export type DetailedHtmlAttributes = z.output<typeof DetailedHtmlAttributesSchema>

// ── Element-specific attribute schemas ─────────────────────────────────────

/** @public */
export const detailedAnchorHtmlAttributesSchema = DetailedHtmlAttributesSchema.and(
  z.object({
    download: z.boolean().optional(),
    href: z.string().optional(),
    hreflang: z.string().optional(),
    media: z.string().optional(),
    ping: z.string().optional(),
    target: anchorTargetSchema.optional(),
    type: z.string().optional(),
    referrerpolicy: referrerPolicySchema.optional(),
  }),
)

/** @public */
export type DetailedAnchorHtmlAttributes = z.output<typeof detailedAnchorHtmlAttributesSchema>

/**
 * Schema for media element attributes (used by audio, video).
 *
 * @public
 */
export const DetailedMediaHtmlAttributesSchema = DetailedHtmlAttributesSchema.and(
  z.object({
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
  }),
)

/** @public */
export type DetailedMediaHtmlAttributes = z.output<typeof DetailedMediaHtmlAttributesSchema>

/** @public */
export const detailedAreaHtmlAttributesSchema = DetailedHtmlAttributesSchema.and(
  z.object({
    alt: z.string().optional(),
    coords: z.string().optional(),
    download: z.boolean().optional(),
    href: z.string().optional(),
    hreflang: z.string().optional(),
    media: z.string().optional(),
    referrerpolicy: referrerPolicySchema.optional(),
    shape: z.string().optional(),
    target: z.string().optional(),
  }),
)

/** @public */
export type DetailedAreaHtmlAttributes = z.output<typeof detailedAreaHtmlAttributesSchema>

/** @public */
export const detailedBaseHtmlAttributesSchema = DetailedHtmlAttributesSchema.and(
  z.object({
    href: z.string().optional(),
    target: z.string().optional(),
  }),
)

/** @public */
export type DetailedBaseHtmlAttributes = z.output<typeof detailedBaseHtmlAttributesSchema>

/** @public */
export const detailedBlockquoteHtmlAttributesSchema = DetailedHtmlAttributesSchema.and(
  z.object({
    cite: z.string().optional(),
  }),
)

/** @public */
export type DetailedBlockquoteHtmlAttributes = z.output<typeof detailedBlockquoteHtmlAttributesSchema>

/** @public */
export const detailedButtonHtmlAttributesSchema = DetailedHtmlAttributesSchema.and(
  z.object({
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
  }),
)

/** @public */
export type DetailedButtonHtmlAttributes = z.output<typeof detailedButtonHtmlAttributesSchema>

/** @public */
export const detailedCanvasHtmlAttributesSchema = DetailedHtmlAttributesSchema.and(
  z.object({
    height: z.union([z.number(), z.string()]).optional(),
    width: z.union([z.number(), z.string()]).optional(),
  }),
)

/** @public */
export type DetailedCanvasHtmlAttributes = z.output<typeof detailedCanvasHtmlAttributesSchema>

/** @public */
export const detailedColHtmlAttributesSchema = DetailedHtmlAttributesSchema.and(
  z.object({
    span: z.number().optional(),
    width: z.union([z.number(), z.string()]).optional(),
  }),
)

/** @public */
export type DetailedColHtmlAttributes = z.output<typeof detailedColHtmlAttributesSchema>

/** @public */
export const detailedColgroupHtmlAttributesSchema = DetailedHtmlAttributesSchema.and(
  z.object({
    span: z.number().optional(),
  }),
)

/** @public */
export type DetailedColgroupHtmlAttributes = z.output<typeof detailedColgroupHtmlAttributesSchema>

/** @public */
export const detailedDataHtmlAttributesSchema = DetailedHtmlAttributesSchema.and(
  z.object({
    value: z.union([z.string(), z.number()]).optional(),
  }),
)

/** @public */
export type DetailedDataHtmlAttributes = z.output<typeof detailedDataHtmlAttributesSchema>

/** @public */
export const detailedDetailsHtmlAttributesSchema = DetailedHtmlAttributesSchema.and(
  z.object({
    open: z.boolean().optional(),
  }),
)

/** @public */
export type DetailedDetailsHtmlAttributes = z.output<typeof detailedDetailsHtmlAttributesSchema>

/** @public */
export const detailedDelHtmlAttributesSchema = DetailedHtmlAttributesSchema.and(
  z.object({
    cite: z.string().optional(),
    datetime: z.string().optional(),
  }),
)

/** @public */
export type DetailedDelHtmlAttributes = z.output<typeof detailedDelHtmlAttributesSchema>

/** @public */
export const detailedDialogHtmlAttributesSchema = DetailedHtmlAttributesSchema.and(
  z.object({
    open: z.boolean().optional(),
  }),
)

/** @public */
export type DetailedDialogHtmlAttributes = z.output<typeof detailedDialogHtmlAttributesSchema>

/** @public */
export const detailedEmbedHtmlAttributesSchema = DetailedHtmlAttributesSchema.and(
  z.object({
    height: z.union([z.number(), z.string()]).optional(),
    src: z.string().optional(),
    type: z.string().optional(),
    width: z.union([z.number(), z.string()]).optional(),
  }),
)

/** @public */
export type DetailedEmbedHtmlAttributes = z.output<typeof detailedEmbedHtmlAttributesSchema>

/** @public */
export const detailedFieldsetHtmlAttributesSchema = DetailedHtmlAttributesSchema.and(
  z.object({
    disabled: z.boolean().optional(),
    form: z.string().optional(),
    name: z.string().optional(),
  }),
)

/** @public */
export type DetailedFieldsetHtmlAttributes = z.output<typeof detailedFieldsetHtmlAttributesSchema>

/** @public */
export const detailedFormHtmlAttributesSchema = DetailedHtmlAttributesSchema.and(
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

/** @public */
export type DetailedFormHtmlAttributes = z.output<typeof detailedFormHtmlAttributesSchema>

/** @public */
export const detailedHtmlHtmlAttributesSchema = DetailedHtmlAttributesSchema.and(
  z.object({
    manifest: z.string().optional(),
  }),
)

/** @public */
export type DetailedHtmlHtmlAttributes = z.output<typeof detailedHtmlHtmlAttributesSchema>

/** @public */
export const detailedIframeHtmlAttributesSchema = DetailedHtmlAttributesSchema.and(
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

/** @public */
export type DetailedIframeHtmlAttributes = z.output<typeof detailedIframeHtmlAttributesSchema>

/** @public */
export const detailedImgHtmlAttributesSchema = DetailedHtmlAttributesSchema.and(
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

/** @public */
export type DetailedImgHtmlAttributes = z.output<typeof detailedImgHtmlAttributesSchema>

/** @public */
export const detailedInsHtmlAttributesSchema = DetailedHtmlAttributesSchema.and(
  z.object({
    cite: z.string().optional(),
    datetime: z.string().optional(),
  }),
)

/** @public */
export type DetailedInsHtmlAttributes = z.output<typeof detailedInsHtmlAttributesSchema>

/** @public */
export const detailedInputHtmlAttributesSchema = DetailedHtmlAttributesSchema.and(
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

/** @public */
export type DetailedInputHtmlAttributes = z.output<typeof detailedInputHtmlAttributesSchema>

/** @public */
export const detailedLabelHtmlAttributesSchema = DetailedHtmlAttributesSchema.and(
  z.object({
    form: z.string().optional(),
    for: z.string().optional(),
  }),
)

/** @public */
export type DetailedLabelHtmlAttributes = z.output<typeof detailedLabelHtmlAttributesSchema>

/** @public */
export const detailedLiHtmlAttributesSchema = DetailedHtmlAttributesSchema.and(
  z.object({
    value: z.union([z.string(), z.number()]).optional(),
  }),
)

/** @public */
export type DetailedLiHtmlAttributes = z.output<typeof detailedLiHtmlAttributesSchema>

/** @public */
export const detailedLinkHtmlAttributesSchema = DetailedHtmlAttributesSchema.and(
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

/** @public */
export type DetailedLinkHtmlAttributes = z.output<typeof detailedLinkHtmlAttributesSchema>

/** @public */
export const detailedMapHtmlAttributesSchema = DetailedHtmlAttributesSchema.and(
  z.object({
    name: z.string().optional(),
  }),
)

/** @public */
export type DetailedMapHtmlAttributes = z.output<typeof detailedMapHtmlAttributesSchema>

/** @public */
export const detailedMenuHtmlAttributesSchema = DetailedHtmlAttributesSchema.and(
  z.object({
    type: z.string().optional(),
  }),
)

/** @public */
export type DetailedMenuHtmlAttributes = z.output<typeof detailedMenuHtmlAttributesSchema>

// Audio is DetailedMediaHTMLAttributes
/** @public */
export const detailedAudioHtmlAttributesSchema = DetailedMediaHtmlAttributesSchema

/** @public */
export type DetailedAudioHtmlAttributes = z.output<typeof detailedAudioHtmlAttributesSchema>

/** @public */
export const detailedMetaHtmlAttributesSchema = DetailedHtmlAttributesSchema.and(
  z.object({
    charset: z.string().optional(),
    'http-equiv': z.string().optional(),
    name: z.string().optional(),
    media: z.string().optional(),
    content: z.string().optional(),
  }),
)

/** @public */
export type DetailedMetaHtmlAttributes = z.output<typeof detailedMetaHtmlAttributesSchema>

/** @public */
export const detailedMeterHtmlAttributesSchema = DetailedHtmlAttributesSchema.and(
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

/** @public */
export type DetailedMeterHtmlAttributes = z.output<typeof detailedMeterHtmlAttributesSchema>

/** @public */
export const detailedQuoteHtmlAttributesSchema = DetailedHtmlAttributesSchema.and(
  z.object({
    cite: z.string().optional(),
  }),
)

/** @public */
export type DetailedQuoteHtmlAttributes = z.output<typeof detailedQuoteHtmlAttributesSchema>

/** @public */
export const detailedObjectHtmlAttributesSchema = DetailedHtmlAttributesSchema.and(
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

/** @public */
export type DetailedObjectHtmlAttributes = z.output<typeof detailedObjectHtmlAttributesSchema>

/** @public */
export const detailedOlHtmlAttributesSchema = DetailedHtmlAttributesSchema.and(
  z.object({
    reversed: z.boolean().optional(),
    start: z.number().optional(),
    type: z.enum(['1', 'a', 'A', 'i', 'I']).optional(),
  }),
)

/** @public */
export type DetailedOlHtmlAttributes = z.output<typeof detailedOlHtmlAttributesSchema>

/** @public */
export const detailedOptgroupHtmlAttributesSchema = DetailedHtmlAttributesSchema.and(
  z.object({
    disabled: z.boolean().optional(),
    label: z.string().optional(),
  }),
)

/** @public */
export type DetailedOptgroupHtmlAttributes = z.output<typeof detailedOptgroupHtmlAttributesSchema>

/** @public */
export const detailedOptionHtmlAttributesSchema = DetailedHtmlAttributesSchema.and(
  z.object({
    disabled: z.boolean().optional(),
    label: z.string().optional(),
    selected: z.boolean().optional(),
    value: z.union([z.string(), z.number()]).optional(),
  }),
)

/** @public */
export type DetailedOptionHtmlAttributes = z.output<typeof detailedOptionHtmlAttributesSchema>

/** @public */
export const detailedOutputHtmlAttributesSchema = DetailedHtmlAttributesSchema.and(
  z.object({
    form: z.string().optional(),
    for: z.string().optional(),
    name: z.string().optional(),
  }),
)

/** @public */
export type DetailedOutputHtmlAttributes = z.output<typeof detailedOutputHtmlAttributesSchema>

/** @public */
export const detailedProgressHtmlAttributesSchema = DetailedHtmlAttributesSchema.and(
  z.object({
    max: z.union([z.number(), z.string()]).optional(),
    value: z.union([z.string(), z.number()]).optional(),
  }),
)

/** @public */
export type DetailedProgressHtmlAttributes = z.output<typeof detailedProgressHtmlAttributesSchema>

/** @public */
export const detailedSlotHtmlAttributesSchema = DetailedHtmlAttributesSchema.and(
  z.object({
    name: z.string().optional(),
  }),
)

/** @public */
export type DetailedSlotHtmlAttributes = z.output<typeof detailedSlotHtmlAttributesSchema>

/** @public */
export const detailedScriptHtmlAttributesSchema = DetailedHtmlAttributesSchema.and(
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

/** @public */
export type DetailedScriptHtmlAttributes = z.output<typeof detailedScriptHtmlAttributesSchema>

/** @public */
export const detailedSelectHtmlAttributesSchema = DetailedHtmlAttributesSchema.and(
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

/** @public */
export type DetailedSelectHtmlAttributes = z.output<typeof detailedSelectHtmlAttributesSchema>

/** @public */
export const detailedSourceHtmlAttributesSchema = DetailedHtmlAttributesSchema.and(
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

/** @public */
export type DetailedSourceHtmlAttributes = z.output<typeof detailedSourceHtmlAttributesSchema>

/** @public */
export const detailedStyleHtmlAttributesSchema = DetailedHtmlAttributesSchema.and(
  z.object({
    media: z.string().optional(),
  }),
)

/** @public */
export type DetailedStyleHtmlAttributes = z.output<typeof detailedStyleHtmlAttributesSchema>

/** @public */
export const detailedTableHtmlAttributesSchema = DetailedHtmlAttributesSchema.and(
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

/** @public */
export type DetailedTableHtmlAttributes = z.output<typeof detailedTableHtmlAttributesSchema>

/** @public */
export const detailedTemplateHtmlAttributesSchema = DetailedHtmlAttributesSchema.and(
  z.object({
    shadowrootmode: z.enum(['open', 'closed']).optional(),
    shadowrootdelegatesfocus: z.boolean().optional(),
    shadowrootclonable: z.boolean().optional(),
  }),
)

/** @public */
export type DetailedTemplateHtmlAttributes = z.output<typeof detailedTemplateHtmlAttributesSchema>

/** @public */
export const detailedTextareaHtmlAttributesSchema = DetailedHtmlAttributesSchema.and(
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

/** @public */
export type DetailedTextareaHtmlAttributes = z.output<typeof detailedTextareaHtmlAttributesSchema>

/** @public */
export const detailedTdHtmlAttributesSchema = DetailedHtmlAttributesSchema.and(
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

/** @public */
export type DetailedTdHtmlAttributes = z.output<typeof detailedTdHtmlAttributesSchema>

/** @public */
export const detailedThHtmlAttributesSchema = DetailedHtmlAttributesSchema.and(
  z.object({
    align: z.enum(['left', 'center', 'right', 'justify', 'char']).optional(),
    colspan: z.number().optional(),
    headers: z.string().optional(),
    rowspan: z.number().optional(),
    scope: z.string().optional(),
    abbr: z.string().optional(),
  }),
)

/** @public */
export type DetailedThHtmlAttributes = z.output<typeof detailedThHtmlAttributesSchema>

/** @public */
export const detailedTimeHtmlAttributesSchema = DetailedHtmlAttributesSchema.and(
  z.object({
    datetime: z.string().optional(),
  }),
)

/** @public */
export type DetailedTimeHtmlAttributes = z.output<typeof detailedTimeHtmlAttributesSchema>

/** @public */
export const detailedTrackHtmlAttributesSchema = DetailedHtmlAttributesSchema.and(
  z.object({
    default: z.boolean().optional(),
    kind: z.enum(['subtitles', 'captions', 'descriptions', 'chapters', 'metadata']).optional(),
    label: z.string().optional(),
    src: z.string().optional(),
    srclang: z.string().optional(),
  }),
)

/** @public */
export type DetailedTrackHtmlAttributes = z.output<typeof detailedTrackHtmlAttributesSchema>

/** @public */
export const detailedVideoHtmlAttributesSchema = DetailedMediaHtmlAttributesSchema.and(
  z.object({
    height: z.string().optional(),
    playsinline: z.boolean().optional(),
    poster: z.string().optional(),
    width: z.string().optional(),
    disablepictureinpicture: z.boolean().optional(),
    disableremoteplayback: z.boolean().optional(),
  }),
)

/** @public */
export type DetailedVideoHtmlAttributes = z.output<typeof detailedVideoHtmlAttributesSchema>

/** @public */
export const detailedWebViewHtmlAttributesSchema = DetailedHtmlAttributesSchema.and(
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

/** @public */
export type DetailedWebViewHtmlAttributes = z.output<typeof detailedWebViewHtmlAttributesSchema>

// ── SVG attributes ─────────────────────────────────────────────────────────

/**
 * Schema for SVG element attributes, extending detailed HTML attributes.
 *
 * @public
 */
export const DetailedSvgAttributesSchema = DetailedHtmlAttributesSchema.and(
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

/** @public */
export type DetailedSvgAttributes = z.output<typeof DetailedSvgAttributesSchema>

// ── Element attribute list ─────────────────────────────────────────────────

/**
 * Schema mapping element tag names to their attribute schemas.
 *
 * @public
 */
export const ElementAttributeListSchema = z
  .object({
    a: detailedAnchorHtmlAttributesSchema,
    abbr: DetailedHtmlAttributesSchema,
    address: DetailedHtmlAttributesSchema,
    area: detailedAreaHtmlAttributesSchema,
    article: DetailedHtmlAttributesSchema,
    aside: DetailedHtmlAttributesSchema,
    audio: detailedAudioHtmlAttributesSchema,
    b: DetailedHtmlAttributesSchema,
    base: detailedBaseHtmlAttributesSchema,
    bdi: DetailedHtmlAttributesSchema,
    bdo: DetailedHtmlAttributesSchema,
    big: DetailedHtmlAttributesSchema,
    blockquote: detailedBlockquoteHtmlAttributesSchema,
    body: DetailedHtmlAttributesSchema,
    br: DetailedHtmlAttributesSchema,
    button: detailedButtonHtmlAttributesSchema,
    canvas: detailedCanvasHtmlAttributesSchema,
    caption: DetailedHtmlAttributesSchema,
    cite: DetailedHtmlAttributesSchema,
    code: DetailedHtmlAttributesSchema,
    col: detailedColHtmlAttributesSchema,
    colgroup: detailedColgroupHtmlAttributesSchema,
    data: detailedDataHtmlAttributesSchema,
    datalist: DetailedHtmlAttributesSchema,
    dd: DetailedHtmlAttributesSchema,
    del: detailedDelHtmlAttributesSchema,
    details: detailedDetailsHtmlAttributesSchema,
    dfn: DetailedHtmlAttributesSchema,
    dialog: detailedDialogHtmlAttributesSchema,
    div: DetailedHtmlAttributesSchema,
    dl: DetailedHtmlAttributesSchema,
    dt: DetailedHtmlAttributesSchema,
    em: DetailedHtmlAttributesSchema,
    embed: detailedEmbedHtmlAttributesSchema,
    fieldset: detailedFieldsetHtmlAttributesSchema,
    figcaption: DetailedHtmlAttributesSchema,
    figure: DetailedHtmlAttributesSchema,
    footer: DetailedHtmlAttributesSchema,
    form: detailedFormHtmlAttributesSchema,
    h1: DetailedHtmlAttributesSchema,
    h2: DetailedHtmlAttributesSchema,
    h3: DetailedHtmlAttributesSchema,
    h4: DetailedHtmlAttributesSchema,
    h5: DetailedHtmlAttributesSchema,
    h6: DetailedHtmlAttributesSchema,
    head: DetailedHtmlAttributesSchema,
    header: DetailedHtmlAttributesSchema,
    hgroup: DetailedHtmlAttributesSchema,
    hr: DetailedHtmlAttributesSchema,
    html: detailedHtmlHtmlAttributesSchema,
    i: DetailedHtmlAttributesSchema,
    iframe: detailedIframeHtmlAttributesSchema,
    img: detailedImgHtmlAttributesSchema,
    input: detailedInputHtmlAttributesSchema,
    ins: detailedInsHtmlAttributesSchema,
    kbd: DetailedHtmlAttributesSchema,
    label: detailedLabelHtmlAttributesSchema,
    legend: DetailedHtmlAttributesSchema,
    li: detailedLiHtmlAttributesSchema,
    link: detailedLinkHtmlAttributesSchema,
    main: DetailedHtmlAttributesSchema,
    map: detailedMapHtmlAttributesSchema,
    mark: DetailedHtmlAttributesSchema,
    menu: detailedMenuHtmlAttributesSchema,
    menuitem: DetailedHtmlAttributesSchema,
    meta: detailedMetaHtmlAttributesSchema,
    meter: detailedMeterHtmlAttributesSchema,
    nav: DetailedHtmlAttributesSchema,
    noscript: DetailedHtmlAttributesSchema,
    object: detailedObjectHtmlAttributesSchema,
    ol: detailedOlHtmlAttributesSchema,
    optgroup: detailedOptgroupHtmlAttributesSchema,
    option: detailedOptionHtmlAttributesSchema,
    output: detailedOutputHtmlAttributesSchema,
    p: DetailedHtmlAttributesSchema,
    picture: DetailedHtmlAttributesSchema,
    pre: DetailedHtmlAttributesSchema,
    progress: detailedProgressHtmlAttributesSchema,
    q: detailedQuoteHtmlAttributesSchema,
    rp: DetailedHtmlAttributesSchema,
    rt: DetailedHtmlAttributesSchema,
    ruby: DetailedHtmlAttributesSchema,
    s: DetailedHtmlAttributesSchema,
    samp: DetailedHtmlAttributesSchema,
    script: detailedScriptHtmlAttributesSchema,
    search: DetailedHtmlAttributesSchema,
    section: DetailedHtmlAttributesSchema,
    select: detailedSelectHtmlAttributesSchema,
    slot: detailedSlotHtmlAttributesSchema,
    small: DetailedHtmlAttributesSchema,
    source: detailedSourceHtmlAttributesSchema,
    span: DetailedHtmlAttributesSchema,
    strong: DetailedHtmlAttributesSchema,
    style: detailedStyleHtmlAttributesSchema,
    sub: DetailedHtmlAttributesSchema,
    summary: DetailedHtmlAttributesSchema,
    sup: DetailedHtmlAttributesSchema,
    table: detailedTableHtmlAttributesSchema,
    template: detailedTemplateHtmlAttributesSchema,
    tbody: DetailedHtmlAttributesSchema,
    td: detailedTdHtmlAttributesSchema,
    textarea: detailedTextareaHtmlAttributesSchema,
    tfoot: DetailedHtmlAttributesSchema,
    th: detailedThHtmlAttributesSchema,
    thead: DetailedHtmlAttributesSchema,
    time: detailedTimeHtmlAttributesSchema,
    title: DetailedHtmlAttributesSchema,
    tr: DetailedHtmlAttributesSchema,
    track: detailedTrackHtmlAttributesSchema,
    u: DetailedHtmlAttributesSchema,
    ul: DetailedHtmlAttributesSchema,
    var: DetailedHtmlAttributesSchema,
    video: detailedVideoHtmlAttributesSchema,
    wbr: DetailedHtmlAttributesSchema,
    webview: detailedWebViewHtmlAttributesSchema,
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
  .catchall(DetailedHtmlAttributesSchema)

/** @public */
export type ElementAttributeList = z.output<typeof ElementAttributeListSchema>
