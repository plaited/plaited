/// <reference lib="dom.iterable" />
import { ISLElementConstructor, ISLElementOptions } from './types.ts';
export declare const matchAllEvents: (str: string) => string[];
export declare const getTriggerKey: (e: Event, context: HTMLElement | SVGElement) => string;
export declare const canUseSlot: (node: HTMLSlotElement) => boolean;
/**
 * A typescript function for instantiating Plaited Island Elements
 */
export declare const isle: ({ mode, delegatesFocus, tag, ...bProgramOptions }: ISLElementOptions, mixin?: (base: ISLElementConstructor) => ISLElementConstructor) => {
    (): void;
    template<T extends Record<string, any> = Record<string, any>>(props: T): import("./create-template.ts").Template;
};
