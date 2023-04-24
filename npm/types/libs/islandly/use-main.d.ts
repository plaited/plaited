import { Trigger, TriggerArgs } from '../behavioral/mod.ts';
import { Disconnect } from './types.ts';
type Send = (recipient: string, detail: TriggerArgs) => void;
/** is a hook to allow us to send and receive messages from the main thread in a worker */
export declare const useMain: (context: Window & typeof globalThis, trigger: Trigger) => readonly [Send, Disconnect];
export {};
