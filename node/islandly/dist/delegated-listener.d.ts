export declare const delegatedListener: Readonly<{
    set: (context: Node, callback: (ev: Event) => void) => void;
    get: (context: Node) => any;
    has: (context: Node) => boolean;
}>;
