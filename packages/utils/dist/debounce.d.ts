export declare const debounce: <F extends (...args: Parameters<F>) => ReturnType<F>>(func: F, waitFor: number) => (...args: Parameters<F>) => void;
