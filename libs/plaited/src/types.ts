import {
  bProgram,
  DevCallback,
  Strategy,
  Trigger,
  TriggerArgs,
} from '@plaited/behavioral'
import { SugaredElement } from './use-sugar.js'
import { Primitive, BaseAttrs } from '@plaited/jsx'

export type Disconnect = () => void;

export type ISLElementOptions = {
  /** define wether island's custom element is open or closed. @defaultValue 'open'*/
  mode?: 'open' | 'closed';
  /** configure whether to delegate focus or not @defaultValue 'true' */
  delegatesFocus?: boolean;
  /** logger function to receive messages from behavioral program react streams */
  dev?: DevCallback;
  /** event selection strategy callback from behavioral library */
  strategy?: Strategy;
  /** messenger connect callback */
  connect?: (recipient: string, trigger: Trigger) => () => void;
  /** set to true if we wish to use id when connecting to messenger to receive messages from other islands */
  id?: boolean;
  /** the element tag you want to use */
  tag: `${string}-${string}`;
};
export interface ISLElement extends HTMLElement {
  internals_: ElementInternals
  plait?(props: PlaitProps): void | Promise<void>;
  connectedCallback?(): void;
  attributeChangedCallback?(
    name: string,
    oldValue: string | null,
    newValue: string | null,
  ): void;
  disconnectedCallback?(): void;
  adoptedCallback?(): void;
  formAssociatedCallback?(form: HTMLFormElement): void;
  formDisabledCallback?(disabled: boolean): void;
  formResetCallback?(): void;
  formStateRestoreCallback?(
    state: unknown,
    reason: 'autocomplete' | 'restore',
  ): void;
}
export type PlaitProps = {
  /** query for elements with the data-target attribute in the Island's shadowDom and slots */
  $<T extends HTMLElement | SVGElement = HTMLElement | SVGElement>(
    target: string,
  ): SugaredElement<T> | undefined;
  $<T extends HTMLElement | SVGElement = HTMLElement | SVGElement>(
    target: string,
    /** This options enables querySelectorAll and modified the attribute selector for data-target{@default {all: false, mod: "=" } } {@link https://developer.mozilla.org/en-US/docs/Web/CSS/Attribute_selectors#syntax}*/
    opts?: { all: boolean; mod: '=' | '~=' | '|=' | '^=' | '$=' | '*=' },
  ): SugaredElement<T>[];
  /** The DOM node context allowing easy light & shadow dom access
   * @example
   * // returns the div element inside
   * // the shadowRoot of the element instance
   * const shadowEl = host.shadowRoot.querySelector('div')
   */
  host: ISLElement;
} & ReturnType<typeof bProgram>;

export interface ISLElementConstructor {
  new (): ISLElement;
}

export type SendMessage = (recipient: string, detail: TriggerArgs) => void;
export type BroadcastMessage = (recipient: TriggerArgs) => void;


export type Position = 'beforebegin' | 'afterbegin' | 'beforeend' | 'afterend';

type SDUIChildren = string | string[] | ElementData | ElementData[]

interface AdditionalAttrs {
  [key: string]: Primitive | SDUIChildren | Record<string, string>;
}

interface SDUIAttrs extends Omit<BaseAttrs, 'children' | 'slots'> {
  children?: SDUIChildren
  slots?: SDUIChildren
}
export type ElementData = {
  $tag: string,
  $attrs?:  SDUIAttrs & AdditionalAttrs
}

export type DataSlotPayload = {
  $position: Position
  $target: string
  $data: ElementData | ElementData[]
}
