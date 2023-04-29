/**
 * @description a function for returning an unique enough id when you need it
 */
export declare const ueid: (prefix?: string) => string;
/** For when you need id but are cool with just bumping a global counter */
export declare const generateId: (prefix?: string) => string;
/** reset or set the global idCounter */
export declare const setIdCounter: (num: number) => void;
