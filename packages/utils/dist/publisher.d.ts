export type Publisher<T> = () => {
    (value: T): void;
    subscribe(listener: (msg: T) => void): () => boolean;
};
export declare const publisher: <T>() => {
    (value: T): void;
    subscribe(listener: (msg: T) => void): () => boolean;
};
