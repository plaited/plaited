import type { BPEvent, Trigger } from '../behavioral/types.js'

export type FetchJSONOptions = RequestInit & { retry: number; retryDelay: number }

export type UsePostMessage = ({
  trigger,
  publicEvents,
  targetOrigin,
}: {
  trigger: Trigger
  publicEvents: string[]
  targetOrigin?: string
}) => {
  (data: BPEvent): void
  disconnect(): void
}

export type UseEmit = (host: HTMLElement) => (
  args: BPEvent & {
    bubbles?: boolean
    cancelable?: boolean
    composed?: boolean
  },
) => void
