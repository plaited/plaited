/** https://medium.com/@WebReflection/dom-handleevent-a-cross-platform-standard-since-year-2000-5bf17287fd38 */
class DelegatedListener {
  callback;
  constructor(callback) {
    this.callback = callback;
  }
  handleEvent(evt) {
    this.callback(evt);
  }
}
const delegates = new WeakMap();
export const delegatedListener = Object.freeze({
  set: (context, callback) => {
    delegates.set(context, new DelegatedListener(callback));
  },
  get: (context) => delegates.get(context),
  has: (context) => delegates.has(context),
});
