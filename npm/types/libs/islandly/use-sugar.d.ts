import { Template } from './create-template.ts';
/**
 * Inspired by blingblingjs
 * (c) Adam Argyle - MIT
 * {@see https://github.com/argyleink/blingblingjs}
 */
type Position = 'beforebegin' | 'afterbegin' | 'beforeend' | 'afterend';
export declare const sugar: {
    readonly render: ({ stylesheets, content }: Template, position?: Position) => HTMLElement | SVGElement;
    readonly replace: ({ stylesheets, content }: Template) => void;
    readonly attr: (attr: string, val?: string) => string | HTMLElement | SVGElement;
};
export type SugaredElement<T extends HTMLElement | SVGElement = HTMLElement | SVGElement> = T & typeof sugar;
export declare const sugarForEach: {
    render(template: Template[], position?: Position): SugaredElement<HTMLElement | SVGElement>[];
    replace(template: Template[]): SugaredElement<HTMLElement | SVGElement>[];
    attr(attrs: string | Record<string, string>, val?: string): SugaredElement<HTMLElement | SVGElement>[];
};
export declare const useSugar: (element: HTMLElement | SVGElement) => SugaredElement;
export {};
