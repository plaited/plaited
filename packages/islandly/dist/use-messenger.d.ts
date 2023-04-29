import { Trigger, TriggerArgs } from "@plaited/behavioral";
import { Disconnect } from "./types.js";
interface Connect {
  (recipient: string, trigger: Trigger): Disconnect;
  worker: (id: string, worker: Worker) => Disconnect;
}
type Send = (recipient: string, detail: TriggerArgs) => void;
/** Enables communication between agents in a web app.
 * Agents can be Islands, workers, or behavioral program running in the main thread.
 * This allows for execution of the one-way message exchange pattern (aka
 * fire and forget).
 * @returns readonly {}
 *   connect: (recipient: string, trigger: {@link Trigger}) => {@link Disconnect},
 *   send: (recipient: string, detail: {@link TriggerArgs}) => void
 *   worker: (id: string, url: string) =>  {@link Disconnect}
 * }
 */
export declare const useMessenger: () => readonly [Connect, Send];
export {};
