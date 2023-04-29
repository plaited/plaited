/** Call all function passed in with the same arguments when invoked */
export declare const callAll: <
  F extends (...args: Parameters<F>) => ReturnType<F>,
>(...fns: F[]) => (...args: Parameters<F>) => void;
