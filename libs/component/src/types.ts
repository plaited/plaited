import {
  bProgram,
  DevCallback,
  Strategy,
  Trigger,
  TriggerArgs,
} from '@plaited/behavioral'
import { SugaredElement } from './sugar.js'
import { Template } from '@plaited/jsx'

export type Plait = (props: PlaitProps) => void | Promise<void>

export type PlaitedElementOptions = {
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
export interface PlaitedElement extends HTMLElement {
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
export type SelectorMod = '=' | '~=' | '|=' | '^=' | '$=' | '*='
export type PlaitProps = {
  /** query for elements with the data-target attribute in the Island's shadowDom and slots */
  $<T extends HTMLElement | SVGElement = HTMLElement | SVGElement>(
    target: string,
    opts?: {
      all?: false;
      mod?: SelectorMod;
    }
  ): SugaredElement<T> | undefined;
  $<T extends HTMLElement | SVGElement = HTMLElement | SVGElement>(
    target: string,
    /** This options enables querySelectorAll and modified the attribute selector for data-target{@default {all: false, mod: "=" } } {@link https://developer.mozilla.org/en-US/docs/Web/CSS/Attribute_selectors#syntax}*/
    opts?: {
      all: true;
      mod?: SelectorMod;
    },
  ): SugaredElement<T>[];
  /** The DOM node context allowing easy light & shadow dom access
   * @example
   * // returns the div element inside
   * // the shadowRoot of the element instance
   * const shadowEl = host.shadowRoot.querySelector('div')
   */
  host: PlaitedElement;
} & ReturnType<typeof bProgram>;

export interface PlaitedElementConstructor {
  template?: Template;
  observedTriggers?: Record<string, string>
  new (): PlaitedElement;
}

export type SendMessage = (recipient: string, detail: TriggerArgs) => void;
export type BroadcastMessage = (recipient: TriggerArgs) => void;


export type Position = 'beforebegin' | 'afterbegin' | 'beforeend' | 'afterend';

export type PlaitedComponent = {
  (): void;
  tag: string;
}

export type CreateComponent =  ({
  mode,
  delegatesFocus,
  tag,
  ...bProgramOptions
}: PlaitedElementOptions, mixin?: (base: PlaitedElementConstructor) => PlaitedElementConstructor) => PlaitedComponent
