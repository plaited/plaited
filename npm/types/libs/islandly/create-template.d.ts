export type Template = {
    content: string;
    stylesheets: Set<string>;
};
type Children = (string | Template)[] | (string | Template);
export type PlaitedElement<T extends Record<string, any> = Record<string, any>> = (attrs: Attrs<T>) => Template;
export type BaseAttrs = {
    class?: string;
    children?: Children;
    'data-target'?: string | number;
    'data-trigger'?: Record<string, string>;
    for?: string;
    key?: string;
    shadowrootmode?: 'open' | 'closed';
    shadowrootdelegatesfocus?: boolean;
    stylesheet?: string;
    /** setting trusted to true will disable all escaping security policy measures for this element template */
    trusted?: boolean;
    slots?: Children;
    style?: Record<string, string>;
};
export type Attrs<T extends Record<string, any> = Record<string, any>> = BaseAttrs & T;
type Tag = string | `${string}-${string}` | PlaitedElement;
export interface CreateTemplate {
    <T extends Record<string, any>>(tag: Tag, attrs: Attrs<T>): Template;
}
/** createTemplate function used for ssr */
export declare const createTemplate: CreateTemplate;
export { createTemplate as h };
export declare function Fragment({ children }: Attrs): {
    content: string;
    stylesheets: Set<string>;
};
