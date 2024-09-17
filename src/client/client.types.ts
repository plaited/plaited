import type { Trigger } from '../behavioral.js'

export type Disconnect = () => void

export type SubscribeToPublisher = (eventType: string, trigger: Trigger, getLVC?: boolean) => Disconnect
