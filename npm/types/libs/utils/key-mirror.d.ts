export type KeyMirror<Keys extends string[]> = {
    readonly [K in Keys[number]]: K;
};
/** create an object who's keys and values are the same by simply passing in the keys as arguments */
export declare const keyMirror: <Keys extends string[]>(...inputs: Keys) => Readonly<KeyMirror<Keys>>;
