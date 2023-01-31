declare const connect: (recipient: string, cb: import("@plaited/island").TriggerFunc) => () => void, send: (recipient: string, detail: import("@plaited/island").TriggerArgs) => void;
export { connect, send };
