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
  VOID_TAGS,
} from './html.constants.ts'
import { FLAT_NODE_KINDS } from './shared.constants.ts'
import { JsonObjectSchema } from './shared.schemas.ts'

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

export const RefSchema = z.object({ id: z.string(), path: z.string() })

export type Ref = z.output<typeof RefSchema>

export const ChildSchema = z.union([RefSchema, z.number(), z.string()])

/**
 * Represents the valid primitive types that can be rendered directly as children within hyperscript.
 * This includes numbers (which are converted to strings) and strings. TemplateObjects are also valid children for composition.
 */
export type Child = z.output<typeof ChildSchema>

export const ChildrenSchema = z.array(ChildSchema)

/**
 * Represents the children prop in hyperscript. It can be a single valid child (`Child`) or an array of children.
 */
export type Children = z.output<typeof ChildrenSchema>

const PlaitedAttributesSchema = z.object({
  [CLASS]: z.string().optional(),
  [P_FORM]: z.string().optional(),
  [P_SCALE]: z.enum(Object.values(SCALE)).optional(),
  [P_TARGET]: z.union([z.string(), z.number()]).optional(),
  [P_TRIGGER]: z.record(z.string(), z.string()).optional(),
  [STYLE]: cssPropertySchema.optional(),
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

export type DetailedHTMLAttributes = z.output<typeof DetailedHTMLAttributesSchema>

/**
 * Schema for custom element tag names (must match `${string}-${string}` pattern).
 *
 * @public
 */
export const CustomElementTagSchema = z.string().regex(CUSTOM_ELEMENT_TAG_PATTERN)

/** @public */
export type CustomElementTag = `${string}-${string}`

export const ElementNodeSchema = z.object({
  kind: z.literal(FLAT_NODE_KINDS.element),
  tag: z.string(),
  children: ChildrenSchema.optional(),
  attributes: DetailedHTMLAttributesSchema.optional(),
  meta: JsonObjectSchema.optional(),
})

export type ElementNode = z.output<typeof ElementNodeSchema>

const makeElementNode = (tag: string, attrs?: z.ZodObject) =>
  z.object({
    ...ElementNodeSchema.shape,
    tag: z.literal(tag),
    ...(VOID_TAGS.has(tag) ? { children: z.never().optional() } : {}),
    attributes: z
      .object({
        ...ElementNodeSchema.shape.attributes.unwrap().shape,
        ...attrs?.shape,
      })
      .optional(),
  })

// ── Shared attribute fragments ────────────────────────────────────────────

const mediaAttrs = z.object({
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

const svgAttrs = z.object({
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
  href: z.string().optional(),
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
  method: z.enum(['align', 'stretch']).optional(),
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
  'underline-position': z.union([z.number(), z.string()]).optional(),
  'underline-thickness': z.union([z.number(), z.string()]).optional(),
  values: z.string().optional(),
  'vector-effect': z
    .union([z.enum(['none', 'non-scaling-stroke', 'non-scaling-size', 'non-rotation', 'fixed-position']), z.string()])
    .optional(),
  viewBox: z.string().optional(),
  visibility: z.union([z.enum(['visible', 'hidden', 'collapse']), z.string()]).optional(),
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
})

// ── Element nodes ─────────────────────────────────────────────────────────

// HTML elements with tag-specific attributes

const AnchorNodeSchema = makeElementNode(
  'a',
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

const AreaNodeSchema = makeElementNode(
  'area',
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

const BaseNodeSchema = makeElementNode(
  'base',
  z.object({
    href: z.string().optional(),
    target: z.string().optional(),
  }),
)

const BlockquoteNodeSchema = makeElementNode(
  'blockquote',
  z.object({
    cite: z.string().optional(),
  }),
)

const ButtonNodeSchema = makeElementNode(
  'button',
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

const CanvasNodeSchema = makeElementNode(
  'canvas',
  z.object({
    height: z.union([z.number(), z.string()]).optional(),
    width: z.union([z.number(), z.string()]).optional(),
  }),
)

const ColNodeSchema = makeElementNode(
  'col',
  z.object({
    span: z.number().optional(),
    width: z.union([z.number(), z.string()]).optional(),
  }),
)

const ColgroupNodeSchema = makeElementNode(
  'colgroup',
  z.object({
    span: z.number().optional(),
  }),
)

const DataNodeSchema = makeElementNode(
  'data',
  z.object({
    value: z.union([z.string(), z.number()]).optional(),
  }),
)

const DetailsNodeSchema = makeElementNode(
  'details',
  z.object({
    open: z.boolean().optional(),
  }),
)

const DelNodeSchema = makeElementNode(
  'del',
  z.object({
    cite: z.string().optional(),
    datetime: z.string().optional(),
  }),
)

const DialogNodeSchema = makeElementNode(
  'dialog',
  z.object({
    open: z.boolean().optional(),
  }),
)

const EmbedNodeSchema = makeElementNode(
  'embed',
  z.object({
    height: z.union([z.number(), z.string()]).optional(),
    src: z.string().optional(),
    type: z.string().optional(),
    width: z.union([z.number(), z.string()]).optional(),
  }),
)

const FieldsetNodeSchema = makeElementNode(
  'fieldset',
  z.object({
    disabled: z.boolean().optional(),
    form: z.string().optional(),
    name: z.string().optional(),
  }),
)

const FormNodeSchema = makeElementNode(
  'form',
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

const HtmlNodeSchema = makeElementNode(
  'html',
  z.object({
    manifest: z.string().optional(),
  }),
)

const IframeNodeSchema = makeElementNode(
  'iframe',
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

const ImgNodeSchema = makeElementNode(
  'img',
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

const InputNodeSchema = makeElementNode(
  'input',
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

const InsNodeSchema = makeElementNode(
  'ins',
  z.object({
    cite: z.string().optional(),
    datetime: z.string().optional(),
  }),
)

const LabelNodeSchema = makeElementNode(
  'label',
  z.object({
    form: z.string().optional(),
    for: z.string().optional(),
  }),
)

const LiNodeSchema = makeElementNode(
  'li',
  z.object({
    value: z.union([z.string(), z.number()]).optional(),
  }),
)

const LinkNodeSchema = makeElementNode(
  'link',
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

const MapNodeSchema = makeElementNode(
  'map',
  z.object({
    name: z.string().optional(),
  }),
)

const MenuNodeSchema = makeElementNode(
  'menu',
  z.object({
    type: z.string().optional(),
  }),
)

const MetaNodeSchema = makeElementNode(
  'meta',
  z.object({
    charset: z.string().optional(),
    'http-equiv': z.string().optional(),
    name: z.string().optional(),
    media: z.string().optional(),
    content: z.string().optional(),
  }),
)

const MeterNodeSchema = makeElementNode(
  'meter',
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

const ObjectNodeSchema = makeElementNode(
  'object',
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

const OlNodeSchema = makeElementNode(
  'ol',
  z.object({
    reversed: z.boolean().optional(),
    start: z.number().optional(),
    type: z.enum(['1', 'a', 'A', 'i', 'I']).optional(),
  }),
)

const OptgroupNodeSchema = makeElementNode(
  'optgroup',
  z.object({
    disabled: z.boolean().optional(),
    label: z.string().optional(),
  }),
)

const OptionNodeSchema = makeElementNode(
  'option',
  z.object({
    disabled: z.boolean().optional(),
    label: z.string().optional(),
    selected: z.boolean().optional(),
    value: z.union([z.string(), z.number()]).optional(),
  }),
)

const OutputNodeSchema = makeElementNode(
  'output',
  z.object({
    form: z.string().optional(),
    for: z.string().optional(),
    name: z.string().optional(),
  }),
)

const ProgressNodeSchema = makeElementNode(
  'progress',
  z.object({
    max: z.union([z.number(), z.string()]).optional(),
    value: z.union([z.string(), z.number()]).optional(),
  }),
)

const QuoteNodeSchema = makeElementNode(
  'q',
  z.object({
    cite: z.string().optional(),
  }),
)

const SlotNodeSchema = makeElementNode(
  'slot',
  z.object({
    name: z.string().optional(),
  }),
)

const ScriptNodeSchema = makeElementNode(
  'script',
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

const SelectNodeSchema = makeElementNode(
  'select',
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

const SourceNodeSchema = makeElementNode(
  'source',
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

const StyleNodeSchema = makeElementNode(
  'style',
  z.object({
    media: z.string().optional(),
  }),
)

const TableNodeSchema = makeElementNode(
  'table',
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

const TemplateNodeSchema = makeElementNode(
  'template',
  z.object({
    shadowrootmode: z.enum(['open', 'closed']).optional(),
    shadowrootdelegatesfocus: z.boolean().optional(),
    shadowrootclonable: z.boolean().optional(),
  }),
)

const TextareaNodeSchema = makeElementNode(
  'textarea',
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

const TdNodeSchema = makeElementNode(
  'td',
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

const ThNodeSchema = makeElementNode(
  'th',
  z.object({
    align: z.enum(['left', 'center', 'right', 'justify', 'char']).optional(),
    colspan: z.number().optional(),
    headers: z.string().optional(),
    rowspan: z.number().optional(),
    scope: z.string().optional(),
    abbr: z.string().optional(),
  }),
)

const TimeNodeSchema = makeElementNode(
  'time',
  z.object({
    datetime: z.string().optional(),
  }),
)

const TrackNodeSchema = makeElementNode(
  'track',
  z.object({
    default: z.boolean().optional(),
    kind: z.enum(['subtitles', 'captions', 'descriptions', 'chapters', 'metadata']).optional(),
    label: z.string().optional(),
    src: z.string().optional(),
    srclang: z.string().optional(),
  }),
)

// Media-based elements

const AudioNodeSchema = makeElementNode('audio', mediaAttrs)

const VideoNodeSchema = makeElementNode(
  'video',
  z.object({
    ...mediaAttrs.shape,
    height: z.string().optional(),
    playsinline: z.boolean().optional(),
    poster: z.string().optional(),
    width: z.string().optional(),
    disablepictureinpicture: z.boolean().optional(),
    disableremoteplayback: z.boolean().optional(),
  }),
)

// HTML elements with no tag-specific attributes

const AbbrNodeSchema = makeElementNode('abbr')
const AddressNodeSchema = makeElementNode('address')
const ArticleNodeSchema = makeElementNode('article')
const AsideNodeSchema = makeElementNode('aside')
const BdiNodeSchema = makeElementNode('bdi')
const BdoNodeSchema = makeElementNode('bdo')
const BigNodeSchema = makeElementNode('big')
const BodyNodeSchema = makeElementNode('body')
const BrNodeSchema = makeElementNode('br')
const BNodeSchema = makeElementNode('b')
const CaptionNodeSchema = makeElementNode('caption')
const CiteNodeSchema = makeElementNode('cite')
const CodeNodeSchema = makeElementNode('code')
const DatalistNodeSchema = makeElementNode('datalist')
const DdNodeSchema = makeElementNode('dd')
const DfnNodeSchema = makeElementNode('dfn')
const DivNodeSchema = makeElementNode('div')
const DlNodeSchema = makeElementNode('dl')
const DtNodeSchema = makeElementNode('dt')
const EmNodeSchema = makeElementNode('em')
const FigcaptionNodeSchema = makeElementNode('figcaption')
const FigureNodeSchema = makeElementNode('figure')
const FooterNodeSchema = makeElementNode('footer')
const H1NodeSchema = makeElementNode('h1')
const H2NodeSchema = makeElementNode('h2')
const H3NodeSchema = makeElementNode('h3')
const H4NodeSchema = makeElementNode('h4')
const H5NodeSchema = makeElementNode('h5')
const H6NodeSchema = makeElementNode('h6')
const HeadNodeSchema = makeElementNode('head')
const HeaderNodeSchema = makeElementNode('header')
const HgroupNodeSchema = makeElementNode('hgroup')
const HrNodeSchema = makeElementNode('hr')
const INodeSchema = makeElementNode('i')
const KbdNodeSchema = makeElementNode('kbd')
const LegendNodeSchema = makeElementNode('legend')
const MainNodeSchema = makeElementNode('main')
const MarkNodeSchema = makeElementNode('mark')
const MenuitemNodeSchema = makeElementNode('menuitem')
const NavNodeSchema = makeElementNode('nav')
const NoscriptNodeSchema = makeElementNode('noscript')
const PNodeSchema = makeElementNode('p')
const PictureNodeSchema = makeElementNode('picture')
const PreNodeSchema = makeElementNode('pre')
const RpNodeSchema = makeElementNode('rp')
const RtNodeSchema = makeElementNode('rt')
const RubyNodeSchema = makeElementNode('ruby')
const SampNodeSchema = makeElementNode('samp')
const SearchNodeSchema = makeElementNode('search')
const SectionNodeSchema = makeElementNode('section')
const SmallNodeSchema = makeElementNode('small')
const SpanNodeSchema = makeElementNode('span')
const StrongNodeSchema = makeElementNode('strong')
const SNodeSchema = makeElementNode('s')
const SubNodeSchema = makeElementNode('sub')
const SummaryNodeSchema = makeElementNode('summary')
const SupNodeSchema = makeElementNode('sup')
const TbodyNodeSchema = makeElementNode('tbody')
const TfootNodeSchema = makeElementNode('tfoot')
const TheadNodeSchema = makeElementNode('thead')
const TitleNodeSchema = makeElementNode('title')
const TrNodeSchema = makeElementNode('tr')
const UNodeSchema = makeElementNode('u')
const UlNodeSchema = makeElementNode('ul')
const VarNodeSchema = makeElementNode('var')
const WbrNodeSchema = makeElementNode('wbr')

// SVG elements

const SvgNodeSchema = makeElementNode('svg', svgAttrs)
const AnimateNodeSchema = makeElementNode('animate', svgAttrs)
const CircleNodeSchema = makeElementNode('circle', svgAttrs)
const AnimateMotionNodeSchema = makeElementNode('animateMotion', svgAttrs)
const AnimateTransformNodeSchema = makeElementNode('animateTransform', svgAttrs)
const ClipPathNodeSchema = makeElementNode('clipPath', svgAttrs)
const DefsNodeSchema = makeElementNode('defs', svgAttrs)
const DescNodeSchema = makeElementNode('desc', svgAttrs)
const EllipseNodeSchema = makeElementNode('ellipse', svgAttrs)
const FeBlendNodeSchema = makeElementNode('feBlend', svgAttrs)
const FeColorMatrixNodeSchema = makeElementNode('feColorMatrix', svgAttrs)
const FeComponentTransferNodeSchema = makeElementNode('feComponentTransfer', svgAttrs)
const FeCompositeNodeSchema = makeElementNode('feComposite', svgAttrs)
const FeConvolveMatrixNodeSchema = makeElementNode('feConvolveMatrix', svgAttrs)
const FeDiffuseLightingNodeSchema = makeElementNode('feDiffuseLighting', svgAttrs)
const FeDisplacementMapNodeSchema = makeElementNode('feDisplacementMap', svgAttrs)
const FeDistantLightNodeSchema = makeElementNode('feDistantLight', svgAttrs)
const FeDropShadowNodeSchema = makeElementNode('feDropShadow', svgAttrs)
const FeFloodNodeSchema = makeElementNode('feFlood', svgAttrs)
const FeFuncANodeSchema = makeElementNode('feFuncA', svgAttrs)
const FeFuncBNodeSchema = makeElementNode('feFuncB', svgAttrs)
const FeFuncGNodeSchema = makeElementNode('feFuncG', svgAttrs)
const FeFuncRNodeSchema = makeElementNode('feFuncR', svgAttrs)
const FeGaussianBlurNodeSchema = makeElementNode('feGaussianBlur', svgAttrs)
const FeImageNodeSchema = makeElementNode('feImage', svgAttrs)
const FeMergeNodeSchema = makeElementNode('feMerge', svgAttrs)
const FeMergeNodeNodeSchema = makeElementNode('feMergeNode', svgAttrs)
const FeMorphologyNodeSchema = makeElementNode('feMorphology', svgAttrs)
const FeOffsetNodeSchema = makeElementNode('feOffset', svgAttrs)
const FePointLightNodeSchema = makeElementNode('fePointLight', svgAttrs)
const FeSpecularLightingNodeSchema = makeElementNode('feSpecularLighting', svgAttrs)
const FeSpotLightNodeSchema = makeElementNode('feSpotLight', svgAttrs)
const FeTileNodeSchema = makeElementNode('feTile', svgAttrs)
const FeTurbulenceNodeSchema = makeElementNode('feTurbulence', svgAttrs)
const FilterNodeSchema = makeElementNode('filter', svgAttrs)
const ForeignObjectNodeSchema = makeElementNode('foreignObject', svgAttrs)
const GNodeSchema = makeElementNode('g', svgAttrs)
const ImageNodeSchema = makeElementNode('image', svgAttrs)
const LineNodeSchema = makeElementNode('line', svgAttrs)
const LinearGradientNodeSchema = makeElementNode('linearGradient', svgAttrs)
const MarkerNodeSchema = makeElementNode('marker', svgAttrs)
const MaskNodeSchema = makeElementNode('mask', svgAttrs)
const MetadataNodeSchema = makeElementNode('metadata', svgAttrs)
const MpathNodeSchema = makeElementNode('mpath', svgAttrs)
const PathNodeSchema = makeElementNode('path', svgAttrs)
const PatternNodeSchema = makeElementNode('pattern', svgAttrs)
const PolygonNodeSchema = makeElementNode('polygon', svgAttrs)
const PolylineNodeSchema = makeElementNode('polyline', svgAttrs)
const RadialGradientNodeSchema = makeElementNode('radialGradient', svgAttrs)
const RectNodeSchema = makeElementNode('rect', svgAttrs)
const SetNodeSchema = makeElementNode('set', svgAttrs)
const StopNodeSchema = makeElementNode('stop', svgAttrs)
const SwitchNodeSchema = makeElementNode('switch', svgAttrs)
const SymbolNodeSchema = makeElementNode('symbol', svgAttrs)
const TextNodeSchema = makeElementNode('text', svgAttrs)
const TextPathNodeSchema = makeElementNode('textPath', svgAttrs)
const TspanNodeSchema = makeElementNode('tspan', svgAttrs)
const UseNodeSchema = makeElementNode('use', svgAttrs)
const ViewNodeSchema = makeElementNode('view', svgAttrs)

// ── Element schema registry ───────────────────────────────────────────────

export const getElemmentSchema = (tag: string) => {
  const schemas = new Map<string, z.ZodObject>([
    [AnchorNodeSchema.shape.tag.value, AnchorNodeSchema],
    [AreaNodeSchema.shape.tag.value, AreaNodeSchema],
    [BaseNodeSchema.shape.tag.value, BaseNodeSchema],
    [BlockquoteNodeSchema.shape.tag.value, BlockquoteNodeSchema],
    [ButtonNodeSchema.shape.tag.value, ButtonNodeSchema],
    [CanvasNodeSchema.shape.tag.value, CanvasNodeSchema],
    [ColNodeSchema.shape.tag.value, ColNodeSchema],
    [ColgroupNodeSchema.shape.tag.value, ColgroupNodeSchema],
    [DataNodeSchema.shape.tag.value, DataNodeSchema],
    [DetailsNodeSchema.shape.tag.value, DetailsNodeSchema],
    [DelNodeSchema.shape.tag.value, DelNodeSchema],
    [DialogNodeSchema.shape.tag.value, DialogNodeSchema],
    [EmbedNodeSchema.shape.tag.value, EmbedNodeSchema],
    [FieldsetNodeSchema.shape.tag.value, FieldsetNodeSchema],
    [FormNodeSchema.shape.tag.value, FormNodeSchema],
    [HtmlNodeSchema.shape.tag.value, HtmlNodeSchema],
    [IframeNodeSchema.shape.tag.value, IframeNodeSchema],
    [ImgNodeSchema.shape.tag.value, ImgNodeSchema],
    [InputNodeSchema.shape.tag.value, InputNodeSchema],
    [InsNodeSchema.shape.tag.value, InsNodeSchema],
    [LabelNodeSchema.shape.tag.value, LabelNodeSchema],
    [LiNodeSchema.shape.tag.value, LiNodeSchema],
    [LinkNodeSchema.shape.tag.value, LinkNodeSchema],
    [MapNodeSchema.shape.tag.value, MapNodeSchema],
    [MenuNodeSchema.shape.tag.value, MenuNodeSchema],
    [MetaNodeSchema.shape.tag.value, MetaNodeSchema],
    [MeterNodeSchema.shape.tag.value, MeterNodeSchema],
    [ObjectNodeSchema.shape.tag.value, ObjectNodeSchema],
    [OlNodeSchema.shape.tag.value, OlNodeSchema],
    [OptgroupNodeSchema.shape.tag.value, OptgroupNodeSchema],
    [OptionNodeSchema.shape.tag.value, OptionNodeSchema],
    [OutputNodeSchema.shape.tag.value, OutputNodeSchema],
    [ProgressNodeSchema.shape.tag.value, ProgressNodeSchema],
    [QuoteNodeSchema.shape.tag.value, QuoteNodeSchema],
    [SlotNodeSchema.shape.tag.value, SlotNodeSchema],
    [ScriptNodeSchema.shape.tag.value, ScriptNodeSchema],
    [SelectNodeSchema.shape.tag.value, SelectNodeSchema],
    [SourceNodeSchema.shape.tag.value, SourceNodeSchema],
    [StyleNodeSchema.shape.tag.value, StyleNodeSchema],
    [TableNodeSchema.shape.tag.value, TableNodeSchema],
    [TemplateNodeSchema.shape.tag.value, TemplateNodeSchema],
    [TextareaNodeSchema.shape.tag.value, TextareaNodeSchema],
    [TdNodeSchema.shape.tag.value, TdNodeSchema],
    [ThNodeSchema.shape.tag.value, ThNodeSchema],
    [TimeNodeSchema.shape.tag.value, TimeNodeSchema],
    [TrackNodeSchema.shape.tag.value, TrackNodeSchema],
    [AudioNodeSchema.shape.tag.value, AudioNodeSchema],
    [VideoNodeSchema.shape.tag.value, VideoNodeSchema],
    // HTML elements with no tag-specific attributes
    [AbbrNodeSchema.shape.tag.value, AbbrNodeSchema],
    [AddressNodeSchema.shape.tag.value, AddressNodeSchema],
    [ArticleNodeSchema.shape.tag.value, ArticleNodeSchema],
    [AsideNodeSchema.shape.tag.value, AsideNodeSchema],
    [BdiNodeSchema.shape.tag.value, BdiNodeSchema],
    [BdoNodeSchema.shape.tag.value, BdoNodeSchema],
    [BigNodeSchema.shape.tag.value, BigNodeSchema],
    [BodyNodeSchema.shape.tag.value, BodyNodeSchema],
    [BrNodeSchema.shape.tag.value, BrNodeSchema],
    [BNodeSchema.shape.tag.value, BNodeSchema],
    [CaptionNodeSchema.shape.tag.value, CaptionNodeSchema],
    [CiteNodeSchema.shape.tag.value, CiteNodeSchema],
    [CodeNodeSchema.shape.tag.value, CodeNodeSchema],
    [DatalistNodeSchema.shape.tag.value, DatalistNodeSchema],
    [DdNodeSchema.shape.tag.value, DdNodeSchema],
    [DfnNodeSchema.shape.tag.value, DfnNodeSchema],
    [DivNodeSchema.shape.tag.value, DivNodeSchema],
    [DlNodeSchema.shape.tag.value, DlNodeSchema],
    [DtNodeSchema.shape.tag.value, DtNodeSchema],
    [EmNodeSchema.shape.tag.value, EmNodeSchema],
    [FigcaptionNodeSchema.shape.tag.value, FigcaptionNodeSchema],
    [FigureNodeSchema.shape.tag.value, FigureNodeSchema],
    [FooterNodeSchema.shape.tag.value, FooterNodeSchema],
    [H1NodeSchema.shape.tag.value, H1NodeSchema],
    [H2NodeSchema.shape.tag.value, H2NodeSchema],
    [H3NodeSchema.shape.tag.value, H3NodeSchema],
    [H4NodeSchema.shape.tag.value, H4NodeSchema],
    [H5NodeSchema.shape.tag.value, H5NodeSchema],
    [H6NodeSchema.shape.tag.value, H6NodeSchema],
    [HeadNodeSchema.shape.tag.value, HeadNodeSchema],
    [HeaderNodeSchema.shape.tag.value, HeaderNodeSchema],
    [HgroupNodeSchema.shape.tag.value, HgroupNodeSchema],
    [HrNodeSchema.shape.tag.value, HrNodeSchema],
    [INodeSchema.shape.tag.value, INodeSchema],
    [KbdNodeSchema.shape.tag.value, KbdNodeSchema],
    [LegendNodeSchema.shape.tag.value, LegendNodeSchema],
    [MainNodeSchema.shape.tag.value, MainNodeSchema],
    [MarkNodeSchema.shape.tag.value, MarkNodeSchema],
    [MenuitemNodeSchema.shape.tag.value, MenuitemNodeSchema],
    [NavNodeSchema.shape.tag.value, NavNodeSchema],
    [NoscriptNodeSchema.shape.tag.value, NoscriptNodeSchema],
    [PNodeSchema.shape.tag.value, PNodeSchema],
    [PictureNodeSchema.shape.tag.value, PictureNodeSchema],
    [PreNodeSchema.shape.tag.value, PreNodeSchema],
    [RpNodeSchema.shape.tag.value, RpNodeSchema],
    [RtNodeSchema.shape.tag.value, RtNodeSchema],
    [RubyNodeSchema.shape.tag.value, RubyNodeSchema],
    [SampNodeSchema.shape.tag.value, SampNodeSchema],
    [SearchNodeSchema.shape.tag.value, SearchNodeSchema],
    [SectionNodeSchema.shape.tag.value, SectionNodeSchema],
    [SmallNodeSchema.shape.tag.value, SmallNodeSchema],
    [SpanNodeSchema.shape.tag.value, SpanNodeSchema],
    [StrongNodeSchema.shape.tag.value, StrongNodeSchema],
    [SNodeSchema.shape.tag.value, SNodeSchema],
    [SubNodeSchema.shape.tag.value, SubNodeSchema],
    [SummaryNodeSchema.shape.tag.value, SummaryNodeSchema],
    [SupNodeSchema.shape.tag.value, SupNodeSchema],
    [TbodyNodeSchema.shape.tag.value, TbodyNodeSchema],
    [TfootNodeSchema.shape.tag.value, TfootNodeSchema],
    [TheadNodeSchema.shape.tag.value, TheadNodeSchema],
    [TitleNodeSchema.shape.tag.value, TitleNodeSchema],
    [TrNodeSchema.shape.tag.value, TrNodeSchema],
    [UNodeSchema.shape.tag.value, UNodeSchema],
    [UlNodeSchema.shape.tag.value, UlNodeSchema],
    [VarNodeSchema.shape.tag.value, VarNodeSchema],
    [WbrNodeSchema.shape.tag.value, WbrNodeSchema],
    // SVG elements
    [SvgNodeSchema.shape.tag.value, SvgNodeSchema],
    [AnimateNodeSchema.shape.tag.value, AnimateNodeSchema],
    [CircleNodeSchema.shape.tag.value, CircleNodeSchema],
    [AnimateMotionNodeSchema.shape.tag.value, AnimateMotionNodeSchema],
    [AnimateTransformNodeSchema.shape.tag.value, AnimateTransformNodeSchema],
    [ClipPathNodeSchema.shape.tag.value, ClipPathNodeSchema],
    [DefsNodeSchema.shape.tag.value, DefsNodeSchema],
    [DescNodeSchema.shape.tag.value, DescNodeSchema],
    [EllipseNodeSchema.shape.tag.value, EllipseNodeSchema],
    [FeBlendNodeSchema.shape.tag.value, FeBlendNodeSchema],
    [FeColorMatrixNodeSchema.shape.tag.value, FeColorMatrixNodeSchema],
    [FeComponentTransferNodeSchema.shape.tag.value, FeComponentTransferNodeSchema],
    [FeCompositeNodeSchema.shape.tag.value, FeCompositeNodeSchema],
    [FeConvolveMatrixNodeSchema.shape.tag.value, FeConvolveMatrixNodeSchema],
    [FeDiffuseLightingNodeSchema.shape.tag.value, FeDiffuseLightingNodeSchema],
    [FeDisplacementMapNodeSchema.shape.tag.value, FeDisplacementMapNodeSchema],
    [FeDistantLightNodeSchema.shape.tag.value, FeDistantLightNodeSchema],
    [FeDropShadowNodeSchema.shape.tag.value, FeDropShadowNodeSchema],
    [FeFloodNodeSchema.shape.tag.value, FeFloodNodeSchema],
    [FeFuncANodeSchema.shape.tag.value, FeFuncANodeSchema],
    [FeFuncBNodeSchema.shape.tag.value, FeFuncBNodeSchema],
    [FeFuncGNodeSchema.shape.tag.value, FeFuncGNodeSchema],
    [FeFuncRNodeSchema.shape.tag.value, FeFuncRNodeSchema],
    [FeGaussianBlurNodeSchema.shape.tag.value, FeGaussianBlurNodeSchema],
    [FeImageNodeSchema.shape.tag.value, FeImageNodeSchema],
    [FeMergeNodeSchema.shape.tag.value, FeMergeNodeSchema],
    [FeMergeNodeNodeSchema.shape.tag.value, FeMergeNodeNodeSchema],
    [FeMorphologyNodeSchema.shape.tag.value, FeMorphologyNodeSchema],
    [FeOffsetNodeSchema.shape.tag.value, FeOffsetNodeSchema],
    [FePointLightNodeSchema.shape.tag.value, FePointLightNodeSchema],
    [FeSpecularLightingNodeSchema.shape.tag.value, FeSpecularLightingNodeSchema],
    [FeSpotLightNodeSchema.shape.tag.value, FeSpotLightNodeSchema],
    [FeTileNodeSchema.shape.tag.value, FeTileNodeSchema],
    [FeTurbulenceNodeSchema.shape.tag.value, FeTurbulenceNodeSchema],
    [FilterNodeSchema.shape.tag.value, FilterNodeSchema],
    [ForeignObjectNodeSchema.shape.tag.value, ForeignObjectNodeSchema],
    [GNodeSchema.shape.tag.value, GNodeSchema],
    [ImageNodeSchema.shape.tag.value, ImageNodeSchema],
    [LineNodeSchema.shape.tag.value, LineNodeSchema],
    [LinearGradientNodeSchema.shape.tag.value, LinearGradientNodeSchema],
    [MarkerNodeSchema.shape.tag.value, MarkerNodeSchema],
    [MaskNodeSchema.shape.tag.value, MaskNodeSchema],
    [MetadataNodeSchema.shape.tag.value, MetadataNodeSchema],
    [MpathNodeSchema.shape.tag.value, MpathNodeSchema],
    [PathNodeSchema.shape.tag.value, PathNodeSchema],
    [PatternNodeSchema.shape.tag.value, PatternNodeSchema],
    [PolygonNodeSchema.shape.tag.value, PolygonNodeSchema],
    [PolylineNodeSchema.shape.tag.value, PolylineNodeSchema],
    [RadialGradientNodeSchema.shape.tag.value, RadialGradientNodeSchema],
    [RectNodeSchema.shape.tag.value, RectNodeSchema],
    [SetNodeSchema.shape.tag.value, SetNodeSchema],
    [StopNodeSchema.shape.tag.value, StopNodeSchema],
    [SwitchNodeSchema.shape.tag.value, SwitchNodeSchema],
    [SymbolNodeSchema.shape.tag.value, SymbolNodeSchema],
    [TextNodeSchema.shape.tag.value, TextNodeSchema],
    [TextPathNodeSchema.shape.tag.value, TextPathNodeSchema],
    [TspanNodeSchema.shape.tag.value, TspanNodeSchema],
    [UseNodeSchema.shape.tag.value, UseNodeSchema],
    [ViewNodeSchema.shape.tag.value, ViewNodeSchema],
  ])
  return schemas.get(tag) ?? ElementNodeSchema
}
