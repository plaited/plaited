/** https://medium.com/@WebReflection/dom-handleevent-a-cross-platform-standard-since-year-2000-5bf17287fd38
*/

class DelegatedListener {
  /** @param {HTMLElement} delegated */
  constructor(callback) {
    this.callback = callback
  }
  /** @param {Event} event */
  handleEvent(evt) {
    this.callback(evt)
  }
}

const delegates = new WeakMap()

export const delegatedListener = Object.freeze({
  /** @param {HTMLElement} context  @param {Function} callback*/
  set: (context, callback) => {
    delegates.set(context, new DelegatedListener(callback))
  },
  /** @param {HTMLElement} context */
  get: context => delegates.get(context),
})
