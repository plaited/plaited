export declare const publisher: <T>() => {
    (value: T): void;
    subscribe(listener: (msg: T) => void): () => boolean;
};
