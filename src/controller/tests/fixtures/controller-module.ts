import type { Disconnect, Trigger } from '../../../behavioral.ts'
import type { DelegatedListener, delegates } from '../../delegated-listener.ts'

type ControllerModuleContext = {
  DelegatedListener: typeof DelegatedListener
  delegates: typeof delegates
  addDisconnect: (disconnect: Disconnect) => void
  trigger: Trigger
}

export default ({ DelegatedListener, addDisconnect, delegates, trigger }: ControllerModuleContext) => {
  ;(globalThis as Record<string, unknown>).__controllerModuleLoaded = true
  ;(globalThis as Record<string, unknown>).__controllerModuleHandlerCallCount = 0

  const target = document.getElementById('module-enhanced-btn')
  if (!target) return

  const listener = new DelegatedListener(() => {
    const globals = globalThis as Record<string, unknown>
    globals.__controllerModuleHandlerCallCount = Number(globals.__controllerModuleHandlerCallCount ?? 0) + 1
    trigger({
      type: 'controller_module_click',
      detail: {
        id: target.id,
        'data-extra': target.getAttribute('data-extra'),
      },
    })
  })

  delegates.set(target, listener)
  target.addEventListener('click', listener)

  addDisconnect(() => {
    target.removeEventListener('click', listener)
  })
  addDisconnect(() => {
    ;(globalThis as Record<string, unknown>).__controllerModuleLoaded = false
  })
}
