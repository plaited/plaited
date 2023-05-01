import { Attrs, CreateTemplate } from './types.js';
/** createTemplate function used for ssr */
export declare const createTemplate: CreateTemplate;
export { createTemplate as h };
export declare function Fragment({ children }: Attrs): {
    content: string;
    stylesheets: Set<string>;
};
