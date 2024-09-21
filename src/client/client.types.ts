import type { Trigger } from '../behavioral/b-program.js'

export type Disconnect = () => void

export type SubscribeToPublisher = (eventType: string, trigger: Trigger, getLVC?: boolean) => Disconnect
