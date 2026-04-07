import type { ModuleParams } from '../../agent.types.ts'

const invalidModule = (_params: ModuleParams) => ({
  handlers: {
    bad_handler: 'not-a-function' as never,
  },
})

export default [invalidModule]
