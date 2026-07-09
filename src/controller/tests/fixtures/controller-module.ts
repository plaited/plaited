import type { ControllerExtensionParams } from '../../controller.types.ts'

/**
 * Controller extension module for testing the extension feature.
 *
 * @remarks
 * Exports a `key` that maps to a `p-trigger` pair, and a default `ControllerExtension`
 * function that is invoked inside the controller's delegated listener when a matching
 * DOM event fires.
 */
export const key = 'click:module_enhanced_action'

const extension = (params: ControllerExtensionParams<HTMLElement, 'click'>) => {
  const { event, trigger } = params
  const element = event.currentTarget as HTMLElement
  const globals = globalThis as Record<string, unknown>
  globals.__extensionInvoked = true
  globals.__extensionHandlerCallCount = Number(globals.__extensionHandlerCallCount ?? 0) + 1
  // Record whether the controller still passes the deprecated addDisconnect param.
  // The public contract is { event, trigger } only; this must be false.
  globals.__extensionHasAddDisconnect = 'addDisconnect' in params

  trigger({
    type: 'extension_action',
    detail: {
      id: element.id,
      'data-extra': element.getAttribute('data-extra'),
    },
  })
}

export default extension
