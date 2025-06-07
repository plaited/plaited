import { defineBProgram, type DefineBProgramProps } from '../behavioral/define-b-program.js'
import type { BPEvent } from '../behavioral/b-thread.js'
import type { Disconnect, Handlers } from '../behavioral/b-program.js'

export const defineWorkshop = <A extends Handlers>({
  bProgram,
  publicEvents,
}: {
  bProgram: (args: DefineBProgramProps) => A
  publicEvents: string[]
}) => {}
