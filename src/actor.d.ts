import { baseDynamics, Trigger, ValueOf } from '@plaited/behavioral'
export function broadcast(address: string, message: {
  eventName: string;
  payload?: any;
  baseDynamic?: ValueOf<typeof baseDynamics>;
}, bcc?: string): void
export function connect(recipient: string, trigger: Trigger, bcc?: string): () => void