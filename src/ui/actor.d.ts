import { ValueOf } from '../utils/types'
import { Trigger } from '../behavioral/types'
import { baseDynamics } from '../behavioral/constants'
export type ActorMessage = [string, {
  eventName: string;
  payload?: any;
  baseDynamic?: ValueOf<typeof baseDynamics>;
}]
export function broadcast(address: string, message: ActorMessage, bcc?: string): void
export function connect(recipient: string, trigger: Trigger, bcc?: string): () => void