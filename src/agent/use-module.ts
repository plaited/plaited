import type { AddBThreads, BSync, DefaultHandlers, Trigger, UseSnapshot } from '../behavioral.ts'

type Callback = (arg: { emit: Trigger; addBThreads: AddBThreads; useSnapshot: UseSnapshot }) => {
  threads: Record<string, ReturnType<BSync>>
  handlers: DefaultHandlers
}

export const useModule = (id: string, callback: Callback) => {}
