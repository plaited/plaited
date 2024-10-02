import type { Trigger, Disconnect } from '../behavioral/b-program.js'

export type PlaitedTrigger = Trigger & {
  addDisconnectCallback: (disconnect: Disconnect) => void
}

export type Effect = (eventType: string, trigger: Trigger | PlaitedTrigger, getLVC?: boolean) => Disconnect

export const isPlaitedTrigger = (trigger: Trigger): trigger is PlaitedTrigger => 'addDisconnectCallback' in trigger
