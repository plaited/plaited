/* eslint-disable @typescript-eslint/no-explicit-any */
import { bProgram, Detail, DevCallback, Strategy, Trigger, TriggerArgs } from '@plaited/behavioral'

export type TemplateObject = {
  client: string[]
  server: string[]
  stylesheets: Set<string>
  registry: Set<PlaitedComponentConstructor>
}

export type Child = string | TemplateObject

export type Children = Child[] | Child

type StringPropertiesOf<T> = {
  [P in keyof T]: T[P] extends string ? P : never
}[keyof T]

export type StyleType = {
  // Include all string properties from CSSStyleDeclaration as optional
  [P in StringPropertiesOf<CSSStyleDeclaration>]?: CSSStyleDeclaration[P]
} & {
  // Allow any property starting with `--`
  [key: string]: string
}

export type BaseAttrs = {
  class?: never
  ['data-address']?: string
  ['data-target']?: string
  ['data-trigger']?: Record<string, string>
  className?: string
  children?: Children
  key?: string
  stylesheet?: string | string[]
  /** setting trusted to true will disable all escaping security policy measures for this element template */
  trusted?: boolean
  style?: StyleType
}

type StringOrNullOrBooleanOrNumber = string | null | boolean | number

// Exclude properties starting with 'on'
type ExcludeEventHandlers<T> = {
  [P in keyof T as P extends `on${infer _}` ? never : P]: T[P]
}

// Filter attributes to include only string, null, boolean, or number types
type FilterAttributes<T> = {
  [P in keyof T]?: T[P] extends StringOrNullOrBooleanOrNumber ? T[P] : never
}

// Combine both filters
type HTMLAttributes<T extends HTMLElement | SVGElement> = Omit<
  FilterAttributes<ExcludeEventHandlers<T>>,
  keyof BaseAttrs
> &
  BaseAttrs

type AllSVGAttributes = {
  'accent-height'?: string
  accumulate?: string
  additive?: string
  'alignment-baseline'?: string
  amplitude?: string
  'arabic-form'?: string
  ascent?: string
  attributeName?: string
  attributeType?: string
  azimuth?: string
  baseFrequency?: string
  'baseline-shift'?: string
  baseProfile?: string
  bbox?: string
  begin?: string
  bias?: string
  by?: string
  calcMode?: string
  'cap-height'?: string
  class?: string
  clip?: string
  'clip-path'?: string
  'clip-rule'?: string
  clipPathUnits?: string
  color?: string
  'color-interpolation'?: string
  'color-interpolation-filters'?: string
  'color-profile'?: string
  contentScriptType?: string
  contentStyleType?: string
  cursor?: string
  cx?: string
  cy?: string
  d?: string
  'data-*'?: string
  decoding?: string
  descent?: string
  diffuseConstant?: string
  direction?: string
  display?: string
  divisor?: string
  'dominant-baseline'?: string
  dur?: string
  dx?: string
  dy?: string
  edgeMode?: string
  elevation?: string
  'enable-background'?: string
  end?: string
  exponent?: string
  fill?: string
  'fill-opacity'?: string
  'fill-rule'?: string
  filter?: string
  filterRes?: string
  filterUnits?: string
  'flood-color'?: string
  'flood-opacity'?: string
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
  g1?: string
  g2?: string
  'glyph-name'?: string
  'glyph-orientation-horizontal'?: string
  'glyph-orientation-vertical'?: string
  gradientTransform?: string
  gradientUnits?: string
  hanging?: string
  height?: string
  'horiz-adv-x'?: string
  'horiz-origin-x'?: string
  'horiz-origin-y'?: string
  href?: string
  id?: string
  ideographic?: string
  'image-rendering'?: string
  in?: string
  in2?: string
  intercept?: string
  k?: string
  k1?: string
  k2?: string
  k3?: string
  k4?: string
  kernelMatrix?: string
  kernelUnitLength?: string
  kerning?: string
  keyPoints?: string
  keySplines?: string
  keyTimes?: string
  lang?: string
  lengthAdjust?: string
  'letter-spacing'?: string
  'lighting-color'?: string
  limitingConeAngle?: string
  'marker-end'?: string
  'marker-mid'?: string
  'marker-start'?: string
  markerHeight?: string
  markerUnits?: string
  markerWidth?: string
  mask?: string
  maskContentUnits?: string
  maskUnits?: string
  mathematical?: string
  max?: string
  media?: string
  method?: string
  min?: string
  mode?: string
  name?: string
  numOctaves?: string
  offset?: string
  opacity?: string
  operator?: string
  order?: string
  orient?: string
  orientation?: string
  origin?: string
  overflow?: string
  'overline-position'?: string
  'overline-thickness'?: string
  'paint-order'?: string
  'panose-1'?: string
  path?: string
  pathLength?: string
  patternContentUnits?: string
  patternTransform?: string
  patternUnits?: string
  ping?: string
  'pointer-events'?: string
  points?: string
  pointsAtX?: string
  pointsAtY?: string
  pointsAtZ?: string
  preserveAlpha?: string
  preserveAspectRatio?: string
  primitiveUnits?: string
  r?: string
  radius?: string
  referrerPolicy?: string
  refX?: string
  refY?: string
  rel?: string
  'rendering-intent'?: string
  repeatCount?: string
  repeatDur?: string
  requiredExtensions?: string
  requiredFeatures?: string
  restart?: string
  result?: string
  rotate?: string
  rx?: string
  ry?: string
  scale?: string
  seed?: string
  'shape-rendering'?: string
  slope?: string
  spacing?: string
  specularConstant?: string
  specularExponent?: string
  speed?: string
  spreadMethod?: string
  startOffset?: string
  stdDeviation?: string
  stemh?: string
  stemv?: string
  stitchTiles?: string
  'stop-color'?: string
  'stop-opacity'?: string
  'strikethrough-position'?: string
  'strikethrough-thickness'?: string
  string?: string
  stroke?: string
  'stroke-dasharray'?: string
  'stroke-dashoffset'?: string
  'stroke-linecap'?: string
  'stroke-linejoin'?: string
  'stroke-miterlimit'?: string
  'stroke-opacity'?: string
  'stroke-width'?: string
  style?: string
  surfaceScale?: string
  systemLanguage?: string
  tabindex?: string
  tableValues?: string
  target?: string
  targetX?: string
  targetY?: string
  'text-anchor'?: string
  'text-decoration'?: string
  'text-rendering'?: string
  textLength?: string
  to?: string
  transform?: string
  'transform-origin'?: string
  type?: string
  u1?: string
  u2?: string
  'underline-position'?: string
  'underline-thickness'?: string
  unicode?: string
  'unicode-bidi'?: string
  'unicode-range'?: string
  'units-per-em'?: string
  'v-alphabetic'?: string
  'v-hanging'?: string
  'v-ideographic'?: string
  'v-mathematical'?: string
  values?: string
  'vector-effect'?: string
  version?: string
  'vert-adv-y'?: string
  'vert-origin-x'?: string
  'vert-origin-y'?: string
  viewBox?: string
  viewTarget?: string
  visibility?: string
  width?: string
  widths?: string
  'word-spacing'?: string
  'writing-mode'?: string
  x?: string
  'x-height'?: string
  x1?: string
  x2?: string
  xChannelSelector?: string
  'xlink:actuate'?: string
  'xlink:arcrole'?: string
  'xlink:href'?: string
  'xlink:role'?: string
  'xlink:show'?: string
  'xlink:title'?: string
  'xlink:type'?: string
  'xml:base'?: string
  'xml:lang'?: string
  'xml:space'?: string
  y?: string
  y1?: string
  y2?: string
  yChannelSelector?: string
  z?: string
  zoomAndPan?: string
}
// Utility type to extract the keys from a type
type Keys<T> = keyof T

// Utility type to generate attribute types based on an SVG Element type
type SVGAttributes<T extends SVGElement> = Partial<{
  [P in Keys<AllSVGAttributes> & Keys<T>]: AllSVGAttributes[P]
}>

export type ElementTags = {
  a: HTMLAttributes<HTMLAnchorElement>
  abbr: HTMLAttributes<HTMLElement>
  address: HTMLAttributes<HTMLElement>
  area: HTMLAttributes<HTMLAreaElement>
  article: HTMLAttributes<HTMLElement>
  aside: HTMLAttributes<HTMLElement>
  audio: HTMLAttributes<HTMLAudioElement>
  b: HTMLAttributes<HTMLElement>
  base: HTMLAttributes<HTMLBaseElement>
  bdi: HTMLAttributes<HTMLElement>
  bdo: HTMLAttributes<HTMLElement>
  big: HTMLAttributes<HTMLElement>
  blockquote: HTMLAttributes<HTMLQuoteElement>
  body: HTMLAttributes<HTMLBodyElement>
  br: HTMLAttributes<HTMLBRElement>
  button: HTMLAttributes<HTMLButtonElement>
  canvas: HTMLAttributes<HTMLCanvasElement>
  caption: HTMLAttributes<HTMLTableCaptionElement>
  cite: HTMLAttributes<HTMLElement>
  code: HTMLAttributes<HTMLElement>
  col: HTMLAttributes<HTMLTableColElement>
  colgroup: HTMLAttributes<HTMLTableColElement>
  data: HTMLAttributes<HTMLDataElement>
  datalist: HTMLAttributes<HTMLDataListElement>
  dd: HTMLAttributes<HTMLElement>
  del: HTMLAttributes<HTMLModElement>
  details: HTMLAttributes<HTMLDetailsElement>
  dfn: HTMLAttributes<HTMLElement>
  dialog: HTMLAttributes<HTMLDialogElement>
  div: HTMLAttributes<HTMLDivElement>
  dl: HTMLAttributes<HTMLDListElement>
  dt: HTMLAttributes<HTMLElement>
  em: HTMLAttributes<HTMLElement>
  embed: HTMLAttributes<HTMLEmbedElement>
  fieldset: HTMLAttributes<HTMLFieldSetElement>
  figcaption: HTMLAttributes<HTMLElement>
  figure: HTMLAttributes<HTMLElement>
  footer: HTMLAttributes<HTMLElement>
  form: HTMLAttributes<HTMLFormElement>
  h1: HTMLAttributes<HTMLHeadingElement>
  h2: HTMLAttributes<HTMLHeadingElement>
  h3: HTMLAttributes<HTMLHeadingElement>
  h4: HTMLAttributes<HTMLHeadingElement>
  h5: HTMLAttributes<HTMLHeadingElement>
  h6: HTMLAttributes<HTMLHeadingElement>
  head: HTMLAttributes<HTMLHeadElement>
  header: HTMLAttributes<HTMLElement>
  hgroup: HTMLAttributes<HTMLElement>
  hr: HTMLAttributes<HTMLHRElement>
  html: HTMLAttributes<HTMLHtmlElement>
  i: HTMLAttributes<HTMLElement>
  iframe: HTMLAttributes<HTMLIFrameElement>
  img: HTMLAttributes<HTMLImageElement>
  input: HTMLAttributes<HTMLInputElement>
  ins: HTMLAttributes<HTMLModElement>
  kbd: HTMLAttributes<HTMLElement>
  keygen: HTMLAttributes<HTMLUnknownElement>
  label: Omit<HTMLAttributes<HTMLLabelElement>, 'for'> & { for?: never; htmlFor?: string }
  legend: HTMLAttributes<HTMLLegendElement>
  li: HTMLAttributes<HTMLLIElement>
  link: HTMLAttributes<HTMLLinkElement>
  main: HTMLAttributes<HTMLElement>
  map: HTMLAttributes<HTMLMapElement>
  mark: HTMLAttributes<HTMLElement>
  marquee: HTMLAttributes<HTMLMarqueeElement>
  menu: HTMLAttributes<HTMLMenuElement>
  menuitem: HTMLAttributes<HTMLUnknownElement>
  meta: HTMLAttributes<HTMLMetaElement>
  meter: HTMLAttributes<HTMLMeterElement>
  nav: HTMLAttributes<HTMLElement>
  noscript: HTMLAttributes<HTMLElement>
  object: HTMLAttributes<HTMLObjectElement>
  ol: HTMLAttributes<HTMLOListElement>
  optgroup: HTMLAttributes<HTMLOptGroupElement>
  option: HTMLAttributes<HTMLOptionElement>
  output: Omit<HTMLAttributes<HTMLOutputElement>, 'for'> & { for?: never; htmlFor?: string }
  p: HTMLAttributes<HTMLParagraphElement>
  param: HTMLAttributes<HTMLParamElement>
  picture: HTMLAttributes<HTMLPictureElement>
  pre: HTMLAttributes<HTMLPreElement>
  progress: HTMLAttributes<HTMLProgressElement>
  q: HTMLAttributes<HTMLQuoteElement>
  rp: HTMLAttributes<HTMLElement>
  rt: HTMLAttributes<HTMLElement>
  ruby: HTMLAttributes<HTMLElement>
  s: HTMLAttributes<HTMLElement>
  samp: HTMLAttributes<HTMLElement>
  script: HTMLAttributes<HTMLScriptElement>
  search: HTMLAttributes<HTMLElement>
  section: HTMLAttributes<HTMLElement>
  select: HTMLAttributes<HTMLSelectElement>
  slot: HTMLAttributes<HTMLSlotElement>
  small: HTMLAttributes<HTMLElement>
  source: HTMLAttributes<HTMLSourceElement>
  span: HTMLAttributes<HTMLSpanElement>
  strong: HTMLAttributes<HTMLElement>
  style: HTMLAttributes<HTMLStyleElement>
  sub: HTMLAttributes<HTMLElement>
  summary: HTMLAttributes<HTMLElement>
  sup: HTMLAttributes<HTMLElement>
  table: HTMLAttributes<HTMLTableElement>
  template: HTMLAttributes<HTMLTemplateElement> & {
    shadowrootmode?: 'open' | 'closed'
    shadowrootdelegatesfocus?: boolean
  }
  tbody: HTMLAttributes<HTMLTableSectionElement>
  td: HTMLAttributes<HTMLTableCellElement>
  textarea: HTMLAttributes<HTMLTextAreaElement>
  tfoot: HTMLAttributes<HTMLTableSectionElement>
  th: HTMLAttributes<HTMLTableCellElement>
  thead: HTMLAttributes<HTMLTableSectionElement>
  time: HTMLAttributes<HTMLTimeElement>
  title: HTMLAttributes<HTMLTitleElement>
  tr: HTMLAttributes<HTMLTableRowElement>
  track: HTMLAttributes<HTMLTrackElement>
  u: HTMLAttributes<HTMLElement>
  ul: HTMLAttributes<HTMLUListElement>
  var: HTMLAttributes<HTMLElement>
  video: HTMLAttributes<HTMLVideoElement>
  wbr: HTMLAttributes<HTMLElement>

  //SVG
  svg: SVGAttributes<SVGSVGElement> & HTMLAttributes<HTMLElement>
  animate: SVGAttributes<SVGAnimateElement> & HTMLAttributes<HTMLElement>
  circle: SVGAttributes<SVGCircleElement> & HTMLAttributes<HTMLElement>
  animateMotion: SVGAttributes<SVGAnimateMotionElement> & HTMLAttributes<HTMLElement>
  animateTransform: SVGAttributes<SVGAnimateTransformElement> & HTMLAttributes<HTMLElement>
  clipPath: SVGAttributes<SVGClipPathElement> & HTMLAttributes<HTMLElement>
  defs: SVGAttributes<SVGDefsElement> & HTMLAttributes<HTMLElement>
  desc: SVGAttributes<SVGDescElement> & HTMLAttributes<HTMLElement>
  ellipse: SVGAttributes<SVGEllipseElement> & HTMLAttributes<HTMLElement>
  feBlend: SVGAttributes<SVGFEBlendElement> & HTMLAttributes<HTMLElement>
  feColorMatrix: SVGAttributes<SVGFEColorMatrixElement> & HTMLAttributes<HTMLElement>
  feComponentTransfer: SVGAttributes<SVGFEComponentTransferElement> & HTMLAttributes<HTMLElement>
  feComposite: SVGAttributes<SVGFECompositeElement> & HTMLAttributes<HTMLElement>
  feConvolveMatrix: SVGAttributes<SVGFEConvolveMatrixElement> & HTMLAttributes<HTMLElement>
  feDiffuseLighting: SVGAttributes<SVGFEDiffuseLightingElement> & HTMLAttributes<HTMLElement>
  feDisplacementMap: SVGAttributes<SVGFEDisplacementMapElement> & HTMLAttributes<HTMLElement>
  feDistantLight: SVGAttributes<SVGFEDistantLightElement> & HTMLAttributes<HTMLElement>
  feDropShadow: SVGAttributes<SVGFEDropShadowElement> & HTMLAttributes<HTMLElement>
  feFlood: SVGAttributes<SVGFEFloodElement> & HTMLAttributes<HTMLElement>
  feFuncA: SVGAttributes<SVGFEFuncAElement> & HTMLAttributes<HTMLElement>
  feFuncB: SVGAttributes<SVGFEFuncBElement> & HTMLAttributes<HTMLElement>
  feFuncG: SVGAttributes<SVGFEFuncGElement> & HTMLAttributes<HTMLElement>
  feFuncR: SVGAttributes<SVGFEFuncRElement> & HTMLAttributes<HTMLElement>
  feGaussianBlur: SVGAttributes<SVGFEGaussianBlurElement> & HTMLAttributes<HTMLElement>
  feImage: SVGAttributes<SVGFEImageElement> & HTMLAttributes<HTMLElement>
  feMerge: SVGAttributes<SVGFEMergeElement> & HTMLAttributes<HTMLElement>
  feMergeNode: SVGAttributes<SVGFEMergeNodeElement> & HTMLAttributes<HTMLElement>
  feMorphology: SVGAttributes<SVGFEMorphologyElement> & HTMLAttributes<HTMLElement>
  feOffset: SVGAttributes<SVGFEOffsetElement> & HTMLAttributes<HTMLElement>
  fePointLight: SVGAttributes<SVGFEPointLightElement> & HTMLAttributes<HTMLElement>
  feSpecularLighting: SVGAttributes<SVGFESpecularLightingElement> & HTMLAttributes<HTMLElement>
  feSpotLight: SVGAttributes<SVGFESpotLightElement> & HTMLAttributes<HTMLElement>
  feTile: SVGAttributes<SVGFETileElement> & HTMLAttributes<HTMLElement>
  feTurbulence: SVGAttributes<SVGFETurbulenceElement> & HTMLAttributes<HTMLElement>
  filter: SVGAttributes<SVGFilterElement> & HTMLAttributes<HTMLElement>
  foreignObject: SVGAttributes<SVGForeignObjectElement> & HTMLAttributes<HTMLElement>
  g: SVGAttributes<SVGGElement> & HTMLAttributes<HTMLElement>
  image: SVGAttributes<SVGImageElement> & HTMLAttributes<HTMLElement>
  line: SVGAttributes<SVGLineElement> & HTMLAttributes<HTMLElement>
  linearGradient: SVGAttributes<SVGLinearGradientElement> & HTMLAttributes<HTMLElement>
  marker: SVGAttributes<SVGMarkerElement> & HTMLAttributes<HTMLElement>
  mask: SVGAttributes<SVGMaskElement> & HTMLAttributes<HTMLElement>
  metadata: SVGAttributes<SVGMetadataElement> & HTMLAttributes<HTMLElement>
  mpath: SVGAttributes<SVGMPathElement> & HTMLAttributes<HTMLElement>
  path: SVGAttributes<SVGPathElement> & HTMLAttributes<HTMLElement>
  pattern: SVGAttributes<SVGPatternElement> & HTMLAttributes<HTMLElement>
  polygon: SVGAttributes<SVGPolygonElement> & HTMLAttributes<HTMLElement>
  polyline: SVGAttributes<SVGPolylineElement>
  radialGradient: SVGAttributes<SVGRadialGradientElement> & HTMLAttributes<HTMLElement>
  rect: SVGAttributes<SVGRectElement> & HTMLAttributes<HTMLElement>
  set: SVGAttributes<SVGSetElement> & HTMLAttributes<HTMLElement>
  stop: SVGAttributes<SVGStopElement> & HTMLAttributes<HTMLElement>
  switch: SVGAttributes<SVGSwitchElement> & HTMLAttributes<HTMLElement>
  symbol: SVGAttributes<SVGSymbolElement> & HTMLAttributes<HTMLElement>
  text: SVGAttributes<SVGTextElement> & HTMLAttributes<HTMLElement>
  textPath: SVGAttributes<SVGTextPathElement> & HTMLAttributes<HTMLElement>
  tspan: SVGAttributes<SVGTSpanElement> & HTMLAttributes<HTMLElement>
  use: SVGAttributes<SVGUseElement> & HTMLAttributes<HTMLElement>
  view: SVGAttributes<SVGViewElement> & HTMLAttributes<HTMLElement>
}

export type VoidTags =
  | 'area'
  | 'base'
  | 'basefont'
  | 'bgsound'
  | 'br'
  | 'col'
  | 'command'
  | 'embed'
  | 'frame'
  | 'hr'
  | 'img'
  | 'isindex'
  | 'input'
  | 'keygen'
  | 'link'
  | 'menuitem'
  | 'meta'
  | 'nextid'
  | 'param'
  | 'source'
  | 'track'
  | 'wbr'
  | 'circle'
  | 'ellipse'
  | 'line'
  | 'path'
  | 'polygon'
  | 'polyline'
  | 'rect'
  | 'stop'
  | 'use'

export type Attrs<T extends Record<string, any> = Record<string, any>> = BaseAttrs & T

export type FunctionTemplate<T extends Record<string, any> = Record<string, any>> = (
  attrs: T & BaseAttrs,
) => TemplateObject

export type FT<
  //Alias for FunctionTemplate
  T extends Record<string, any> = Record<string, any>,
> = FunctionTemplate<T>

type InferAttrs<T extends Tag> =
  T extends keyof ElementTags ? ElementTags[T]
  : T extends FT ? Parameters<T>[0]
  : T extends PlaitedComponentConstructor ? Parameters<T['template']>[0]
  : T extends `${string}-${string}` ? HTMLAttributes<HTMLHtmlElement>
  : Attrs

type ExcludeChildrenForVoidTags<T extends Tag, Attrs> = T extends VoidTags ? Omit<Attrs, 'children'> : Attrs

export type Tag = string | `${string}-${string}` | FT | PlaitedComponentConstructor

export interface CreateTemplate {
  <T extends Tag>(tag: T, attrs:  ExcludeChildrenForVoidTags<T, InferAttrs<T>>): TemplateObject
}

export type Send = (recipient: string, detail: TriggerArgs) => void

export interface Messenger extends Send {
  connect: (recipient: string, trigger: Trigger | Worker) => undefined | (() => void)
  has: (recipient: string) => boolean
}

export type Message = {
  recipient: string
  detail: TriggerArgs
}

export type Position = 'beforebegin' | 'afterbegin' | 'beforeend' | 'afterend'

export type SelectorMatch = '=' | '~=' | '|=' | '^=' | '$=' | '*='

export interface QuerySelector {
  <T extends HTMLElement | SVGElement = HTMLElement | SVGElement>(
    target: string,
    /** This options enables querySelectorAll and modified the attribute selector for data-target{@default {all: false, mod: "=" } } {@link https://developer.mozilla.org/en-US/docs/Web/CSS/Attribute_selectors#syntax}*/
    match?: SelectorMatch,
  ): SugaredElement<T>[]
}

export type Sugar = {
  render(this: HTMLElement | SVGElement, ...content: (TemplateObject | Node | string)[]): void
  insert(this: HTMLElement | SVGElement, position: Position, ...content: (TemplateObject | Node | string)[]): void
  replace(this: HTMLElement | SVGElement, ...content: (TemplateObject | Node | string)[]): void
  attr(this: HTMLElement | SVGElement, attr: Record<string, string | null | number | boolean>, val?: never): void
  attr(this: HTMLElement | SVGElement, attr: string, val?: string | null | number | boolean): string | null | void
  clone<T>(
    this: HTMLElement | SVGElement,
    cb: ($: QuerySelector, data: T) => void,
  ): (data: T) => HTMLElement | SVGElement | DocumentFragment
}

export type SugaredElement<T extends HTMLElement | SVGElement = HTMLElement | SVGElement> = T & Sugar

export type Emit = (
  args: TriggerArgs & {
    bubbles?: boolean
    cancelable?: boolean
    composed?: boolean
  },
) => void

export type Publisher<T extends TriggerArgs = TriggerArgs> = {
  (value: T): void
  subscribe(listener: (msg: T) => void): () => boolean
}

export type PlaitProps = {
  /** query for elements with the data-target attribute in the Island's shadowDom and slots */
  $: QuerySelector
  /** The DOM node context allowing easy light & shadow dom access
   * @example
   * // returns the div element inside
   * // the shadowRoot of the element instance
   * const shadowEl = host.shadowRoot.querySelector('div')
   */
  host: PlaitedElement
  emit: Emit
  connect: (comm: Publisher | Messenger) => () => void
} & ReturnType<typeof bProgram>

export interface PlaitedElement extends HTMLElement {
  internals_: ElementInternals
  plait?(props: PlaitProps): void | Promise<void>
  trigger: Trigger
  $: QuerySelector
  connectedCallback?(): void
  attributeChangedCallback?(name: string, oldValue: string | null, newValue: string | null): void
  disconnectedCallback?(): void
  adoptedCallback?(): void
  formAssociatedCallback?(form: HTMLFormElement): void
  formDisabledCallback?(disabled: boolean): void
  formResetCallback?(): void
  formStateRestoreCallback?(state: unknown, reason: 'autocomplete' | 'restore'): void
}

export interface PlaitedComponentConstructor {
  stylesheets: Set<string>
  tag: string
  template: FunctionTemplate
  registry: Set<PlaitedComponentConstructor>
  new (): PlaitedElement
}

HTMLAnchorElement.prototype.href
export type ComponentTypes = {
  observedTriggers: {
    [key: string]: Detail
  }
  observedAttributes: {
    [key: string]: Detail
  }
  emit: {
    [key: string]: {
      deatil?: Detail
      bubbles?: boolean
      cancelable?: boolean
      composed?: boolean
    }
  }
}

export type ComponentFunction = (args: {
  /** PlaitedComponent tag name */
  tag: `${string}-${string}`
  /** Optional Plaited Component shadow dom template*/
  template: TemplateObject
  /** define wether island's custom element is open or closed. @defaultValue 'open'*/
  mode?: 'open' | 'closed'
  /** configure whether to delegate focus or not @defaultValue 'true' */
  delegatesFocus?: boolean
  /** logger function to receive messages from behavioral program react streams */
  dev?: true | DevCallback
  /** event selection strategy callback from behavioral library */
  strategy?: Strategy
  /** Triggers that can be fired from outside component by invoking trigger method directly, via messenger, or via publisher */
  observedTriggers?: Array<string>
}) => PlaitedComponentConstructor

export type TriggerElement = (HTMLElement | SVGElement) & {
  dataset: {
    trigger: string
  }
}
