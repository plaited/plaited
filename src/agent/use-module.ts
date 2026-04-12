import type { BPListener } from '../behavioral.ts'
import type { Module, ModuleParams } from './agent.types.ts'

export const MODULE_NAME_METADATA_KEY = '__plaitedModuleName' as const

type ModuleWithNameMetadata = Module & {
  [MODULE_NAME_METADATA_KEY]?: string
}

type UseModuleHelpers = {
  local: (listener: BPListener) => BPListener
  external: (listener: BPListener) => BPListener
}

type UseModuleCallback = (args: ModuleParams & UseModuleHelpers) => ReturnType<Module>

const toLocalType = ({ moduleName, type }: { moduleName: string; type: string }) => `${moduleName}:${type}`

export const getDeclaredModuleName = (module: Module): string | undefined => {
  const declared = (module as ModuleWithNameMetadata)[MODULE_NAME_METADATA_KEY]
  return typeof declared === 'string' && declared.length > 0 ? declared : undefined
}

export const useModule = (moduleName: string, callback: UseModuleCallback): Module => {
  const declaredModuleName = moduleName.trim()
  const wrapped: Module = (params) => {
    const scope = declaredModuleName || params.moduleId
    const local = (listener: BPListener): BPListener => ({
      ...listener,
      type: toLocalType({ moduleName: scope, type: listener.type }),
    })
    const external = (listener: BPListener): BPListener => listener
    return callback({
      ...params,
      local,
      external,
    })
  }
  if (declaredModuleName.length > 0) {
    ;(wrapped as ModuleWithNameMetadata)[MODULE_NAME_METADATA_KEY] = declaredModuleName
  }
  return wrapped
}
