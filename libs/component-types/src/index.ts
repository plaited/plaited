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
  [P in keyof T]: T[P] extends string ? P : never;
}[keyof T];

export type StyleType = {
  // Include all string properties from CSSStyleDeclaration as optional
  [P in StringPropertiesOf<CSSStyleDeclaration>]?: CSSStyleDeclaration[P];
} & {
  // Allow any property starting with `--`
  [key: string]: string;
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

type StringOrNullOrBooleanOrNumber = string | null | boolean | number;

// Exclude properties starting with 'on'
type ExcludeEventHandlers<T> = {
    [P in keyof T as P extends `on${infer _}` ? never : P]: T[P];
}

// Filter attributes to include only string, null, boolean, or number types
type FilterAttributes<T> = {
    [P in keyof T]: T[P] extends StringOrNullOrBooleanOrNumber ? T[P] : never;
}
export type Attrs<T extends Record<string, any> = Record<string, any>> = BaseAttrs & T
// Combine both filters
type ElementAttributes<T extends HTMLElement | SVGElement> = Partial<FilterAttributes<ExcludeEventHandlers<T>>> & BaseAttrs;

export type ElementTags  = {
  a: ElementAttributes<HTMLAnchorElement>;
  abbr: ElementAttributes<HTMLElement>;
  address: ElementAttributes<HTMLElement>;
  area: ElementAttributes<HTMLAreaElement>;
  article: ElementAttributes<HTMLElement>;
  aside: ElementAttributes<HTMLElement>;
  audio: ElementAttributes<HTMLAudioElement>;
  b: ElementAttributes<HTMLElement>;
  base: ElementAttributes<HTMLBaseElement>;
  bdi: ElementAttributes<HTMLElement>;
  bdo: ElementAttributes<HTMLElement>;
  big: ElementAttributes<HTMLElement>;
  blockquote: ElementAttributes<HTMLQuoteElement>;
  body: ElementAttributes<HTMLBodyElement>;
  br: ElementAttributes<HTMLBRElement>;
  button: ElementAttributes<HTMLButtonElement>;
  canvas: ElementAttributes<HTMLCanvasElement>;
  caption: ElementAttributes<HTMLTableCaptionElement>;
  cite: ElementAttributes<HTMLElement>;
  code: ElementAttributes<HTMLElement>;
  col: ElementAttributes<HTMLTableColElement>;
  colgroup: ElementAttributes<HTMLTableColElement>;
  data: ElementAttributes<HTMLDataElement>;
  datalist: ElementAttributes<HTMLDataListElement>;
  dd: ElementAttributes<HTMLElement>;
  del: ElementAttributes<HTMLModElement>;
  details: ElementAttributes<HTMLDetailsElement>;
  dfn: ElementAttributes<HTMLElement>;
  dialog: ElementAttributes<HTMLDialogElement>;
  div: ElementAttributes<HTMLDivElement>;
  dl: ElementAttributes<HTMLDListElement>;
  dt: ElementAttributes<HTMLElement>;
  em: ElementAttributes<HTMLElement>;
  embed: ElementAttributes<HTMLEmbedElement>;
  fieldset: ElementAttributes<HTMLFieldSetElement>;
  figcaption: ElementAttributes<HTMLElement>;
  figure: ElementAttributes<HTMLElement>;
  footer: ElementAttributes<HTMLElement>;
  form: ElementAttributes<HTMLFormElement>;
  h1: ElementAttributes<HTMLHeadingElement>;
  h2: ElementAttributes<HTMLHeadingElement>;
  h3: ElementAttributes<HTMLHeadingElement>;
  h4: ElementAttributes<HTMLHeadingElement>;
  h5: ElementAttributes<HTMLHeadingElement>;
  h6: ElementAttributes<HTMLHeadingElement>;
  head: ElementAttributes<HTMLHeadElement>;
  header: ElementAttributes<HTMLElement>;
  hgroup: ElementAttributes<HTMLElement>;
  hr: ElementAttributes<HTMLHRElement>;
  html: ElementAttributes<HTMLHtmlElement>;
  i: ElementAttributes<HTMLElement>;
  iframe: ElementAttributes<HTMLIFrameElement>;
  img: ElementAttributes<HTMLImageElement>;
  input: ElementAttributes<HTMLInputElement>;
  ins: ElementAttributes<HTMLModElement>;
  kbd: ElementAttributes<HTMLElement>;
  keygen: ElementAttributes<HTMLUnknownElement>;
  label: Omit<ElementAttributes<HTMLLabelElement>, 'for'> & {for?: never; htmlFor?: string};
  legend: ElementAttributes<HTMLLegendElement>;
  li: ElementAttributes<HTMLLIElement>;
  link: ElementAttributes<HTMLLinkElement>;
  main: ElementAttributes<HTMLElement>;
  map: ElementAttributes<HTMLMapElement>;
  mark: ElementAttributes<HTMLElement>;
  marquee: ElementAttributes<HTMLMarqueeElement>;
  menu: ElementAttributes<HTMLMenuElement>;
  menuitem: ElementAttributes<HTMLUnknownElement>;
  meta: ElementAttributes<HTMLMetaElement>;
  meter: ElementAttributes<HTMLMeterElement>;
  nav: ElementAttributes<HTMLElement>;
  noscript: ElementAttributes<HTMLElement>;
  object: ElementAttributes<HTMLObjectElement>;
  ol: ElementAttributes<HTMLOListElement>;
  optgroup: ElementAttributes<HTMLOptGroupElement>;
  option: ElementAttributes<HTMLOptionElement>;
  output: Omit<ElementAttributes<HTMLOutputElement>, 'for'> & {for?: never; htmlFor?: string};
  p: ElementAttributes<HTMLParagraphElement>;
  param: ElementAttributes<HTMLParamElement>;
  picture: ElementAttributes<HTMLPictureElement>;
  pre: ElementAttributes<HTMLPreElement>;
  progress: ElementAttributes<HTMLProgressElement>;
  q: ElementAttributes<HTMLQuoteElement>;
  rp: ElementAttributes<HTMLElement>;
  rt: ElementAttributes<HTMLElement>;
  ruby: ElementAttributes<HTMLElement>;
  s: ElementAttributes<HTMLElement>;
  samp: ElementAttributes<HTMLElement>;
  script: ElementAttributes<HTMLScriptElement>;
  search: ElementAttributes<HTMLElement>;
  section: ElementAttributes<HTMLElement>;
  select: ElementAttributes<HTMLSelectElement>;
  slot: ElementAttributes<HTMLSlotElement>;
  small: ElementAttributes<HTMLElement>;
  source: ElementAttributes<HTMLSourceElement>;
  span: ElementAttributes<HTMLSpanElement>;
  strong: ElementAttributes<HTMLElement>;
  style: ElementAttributes<HTMLStyleElement>;
  sub: ElementAttributes<HTMLElement>;
  summary: ElementAttributes<HTMLElement>;
  sup: ElementAttributes<HTMLElement>;
  table: ElementAttributes<HTMLTableElement>;
  template: ElementAttributes<HTMLTemplateElement> &  {shadowrootmode?: 'open' | 'closed'; shadowrootdelegatesfocus?: boolean};
  tbody: ElementAttributes<HTMLTableSectionElement>;
  td: ElementAttributes<HTMLTableCellElement>;
  textarea: ElementAttributes<HTMLTextAreaElement>;
  tfoot: ElementAttributes<HTMLTableSectionElement>;
  th: ElementAttributes<HTMLTableCellElement>;
  thead: ElementAttributes<HTMLTableSectionElement>;
  time: ElementAttributes<HTMLTimeElement>;
  title: ElementAttributes<HTMLTitleElement>;
  tr: ElementAttributes<HTMLTableRowElement>;
  track: ElementAttributes<HTMLTrackElement>;
  u: ElementAttributes<HTMLElement>;
  ul: ElementAttributes<HTMLUListElement>;
  var: ElementAttributes<HTMLElement>;
  video: ElementAttributes<HTMLVideoElement>;
  wbr: ElementAttributes<HTMLElement>;

  //SVG
  svg: ElementAttributes<SVGSVGElement>;
  animate: ElementAttributes<SVGAnimateElement>;
  circle: ElementAttributes<SVGCircleElement>;
  animateMotion: ElementAttributes<SVGAnimateMotionElement>;
  animateTransform: ElementAttributes<SVGAnimateTransformElement>;
  clipPath: ElementAttributes<SVGClipPathElement>;
  defs: ElementAttributes<SVGDefsElement>;
  desc: ElementAttributes<SVGDescElement>;
  ellipse: ElementAttributes<SVGEllipseElement>;
  feBlend: ElementAttributes<SVGFEBlendElement>;
  feColorMatrix: ElementAttributes<SVGFEColorMatrixElement>;
  feComponentTransfer: ElementAttributes<SVGFEComponentTransferElement>;
  feComposite: ElementAttributes<SVGFECompositeElement>;
  feConvolveMatrix: ElementAttributes<SVGFEConvolveMatrixElement>;
  feDiffuseLighting: ElementAttributes<SVGFEDiffuseLightingElement>;
  feDisplacementMap: ElementAttributes<SVGFEDisplacementMapElement>;
  feDistantLight: ElementAttributes<SVGFEDistantLightElement>;
  feDropShadow: ElementAttributes<SVGFEDropShadowElement>;
  feFlood: ElementAttributes<SVGFEFloodElement>;
  feFuncA: ElementAttributes<SVGFEFuncAElement>;
  feFuncB: ElementAttributes<SVGFEFuncBElement>;
  feFuncG: ElementAttributes<SVGFEFuncGElement>;
  feFuncR: ElementAttributes<SVGFEFuncRElement>;
  feGaussianBlur: ElementAttributes<SVGFEGaussianBlurElement>;
  feImage: ElementAttributes<SVGFEImageElement>;
  feMerge: ElementAttributes<SVGFEMergeElement>;
  feMergeNode: ElementAttributes<SVGFEMergeNodeElement>;
  feMorphology: ElementAttributes<SVGFEMorphologyElement>;
  feOffset: ElementAttributes<SVGFEOffsetElement>;
  fePointLight: ElementAttributes<SVGFEPointLightElement>;
  feSpecularLighting: ElementAttributes<SVGFESpecularLightingElement>;
  feSpotLight: ElementAttributes<SVGFESpotLightElement>;
  feTile: ElementAttributes<SVGFETileElement>;
  feTurbulence: ElementAttributes<SVGFETurbulenceElement>;
  filter: ElementAttributes<SVGFilterElement>;
  foreignObject: ElementAttributes<SVGForeignObjectElement>;
  g: ElementAttributes<SVGGElement>;
  image: ElementAttributes<SVGImageElement>;
  line: ElementAttributes<SVGLineElement>;
  linearGradient: ElementAttributes<SVGLinearGradientElement>;
  marker: ElementAttributes<SVGMarkerElement>;
  mask: ElementAttributes<SVGMaskElement>;
  metadata: ElementAttributes<SVGMetadataElement>;
  mpath: ElementAttributes<SVGMPathElement>;
  path: ElementAttributes<SVGPathElement>;
  pattern: ElementAttributes<SVGPatternElement>;
  polygon: ElementAttributes<SVGPolygonElement>;
  polyline: ElementAttributes<SVGPolylineElement>;
  radialGradient: ElementAttributes<SVGRadialGradientElement>;
  rect: ElementAttributes<SVGRectElement>;
  set: ElementAttributes<SVGSetElement>;
  stop: ElementAttributes<SVGStopElement>;
  switch: ElementAttributes<SVGSwitchElement>;
  symbol: ElementAttributes<SVGSymbolElement>;
  text: ElementAttributes<SVGTextElement>;
  textPath: ElementAttributes<SVGTextPathElement>;
  tspan: ElementAttributes<SVGTSpanElement>;
  use: ElementAttributes<SVGUseElement>;
  view: ElementAttributes<SVGViewElement>;
}
		
export type VoidTags = 'area'|
'base'|
'basefont'|
'bgsound'|
'br'|
'col'|
'command'|
'embed'|
'frame'|
'hr'|
'img'|
'isindex'|
'input'|
'keygen'|
'link'|
'menuitem'|
'meta'|
'nextid'|
'param'|
'source'|
'track'|
'wbr'|
'circle'|
'ellipse'|
'line'|
'path'|
'polygon'|
'polyline'|
'rect'|
'stop'|
'use'

export type FunctionTemplate<T extends Record<string, any> = Record<string, any>> = (
  attrs: T & BaseAttrs,
) => TemplateObject


export type FT<
  //Alias for FunctionTemplate
  T extends Record<string, any> = Record<string, any>,
> = FunctionTemplate<T>

export type InferAttrs<T extends Tag> =
  T extends keyof ElementTags ? ElementTags[T] : 
  T extends FT ? Parameters<T>[0] :
  T extends PlaitedComponentConstructor ? Parameters<T['template']>[0] :
  T extends `${string}-${string}` ? ElementAttributes<HTMLHtmlElement> :
  Attrs;
  
export type Tag = string | `${string}-${string}` | FT | PlaitedComponentConstructor

export interface CreateTemplate {
  <
    T extends Tag,
    A extends InferAttrs<T>
  >(tag: T, attrs: A): TemplateObject;
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
  },
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
