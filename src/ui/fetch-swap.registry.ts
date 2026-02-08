/**
 * @internal
 * Lightweight registry for fetch-swap Shadow DOM binding.
 * Imported by bElement (adds ~50 bytes to bundle).
 * The fetch-swap module registers itself here as a side-effect import.
 */
type ShadowBinder = (root: ShadowRoot) => () => void
let _binder: ShadowBinder | undefined
export const setFetchSwapBinder = (fn: ShadowBinder) => {
  _binder = fn
}
export const getFetchSwapBinder = () => _binder
