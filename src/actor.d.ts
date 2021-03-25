import { baseDynamics, Trigger, ValueOf } from '@plaited/behavioral'
export type ActorMessage = [string, {
  eventName: string;
  payload?: any;
  baseDynamic?: ValueOf<typeof baseDynamics>;
}]
export function broadcast(address: string, message: ActorMessage, bcc?: string): void
export function connect(recipient: string, trigger: Trigger, bcc?: string): () => void