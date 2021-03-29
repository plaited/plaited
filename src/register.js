import {track, baseDynamics} from '@plaited/behavioral'
import {dataTarget, dataTrigger} from './constants.js'
import {constructableSupported} from './constructableSupported.js'
import {delegatedListener} from './delegatedListener'
export const register = (tag, {strands = {}, actions = {}, options = {}, connect = () => () => {}}) => {
  if (customElements.get(tag)) return
  class ControlTrack extends HTMLElement {
    static matchAllEvents(str) {
      const regexp = /(\w+)(?:->)/g
      return [...str.matchAll(regexp)].flatMap(([, event]) => event)
    }
    static getTriggerKey = evt => {
      const el = evt.currentTarget
      const type = evt.type
      return  el.dataset.trigger
        .trim()
        .split(/\s+/)
        .find(str => str.includes(`${type}->`))
    }
    #trigger
    #disconnect
    constructor() {
      super()
      if (constructableSupported) {
        const sheet = new CSSStyleSheet()
        sheet.replaceSync(`${tag} { display: contents; }`)
        document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]
      }
    }
    connectedCallback() {
      !constructableSupported && (this.style.display = 'contents')
      this.observer = this.#init()
      const {feedback, trigger, stream} = track(strands, options)
      options.debug && stream(options.debug)
      feedback(actions(id => {
        const targets = [...(this.querySelectorAll(`[${dataTarget}="${id}"]`))]
          .filter(el => el.closest(tag) === this)
        return targets.length > 1 ? targets : targets[0]
      }))
      this.#disconnect = connect(tag, trigger)
      this.#trigger = trigger
      this.#trigger({eventName: `connected->${tag}`, baseDynamic: baseDynamics.objectObject})
    }
    disconnectedCallback() {
      this.observer.disconnect()
      this.#disconnect()
      this.#trigger({eventName: `disconnected->${tag}`, baseDynamic: baseDynamics.objectObject})
    }
    #update() {
      this.querySelectorAll(`[${dataTrigger}]`).forEach(el => {
        if (el.closest(tag) !== this) return
        delegatedListener.set(el, evt => {
          const triggerKey = ControlTrack.getTriggerKey(evt)
          triggerKey && this.#trigger({
            eventName: triggerKey,
            payload: evt,
            baseDynamic: baseDynamics.objectPerson,
          })
        })
        const triggers = ControlTrack.matchAllEvents(el.dataset.trigger)
        for (const event of triggers) {
          el.addEventListener(event, delegatedListener.get(el))
        }
      })
    }
    #init() {
      this.#update()
      const mo = new MutationObserver(mutationsList => {
        for (const mutation of mutationsList) {
          if (mutation.type === 'childList') {
            this.#update()
          }
          if (mutation.type === 'attributes') {
            mutation.attributeName === dataTrigger && this.#update()
          }
        }
      })
      mo.observe(this, {
        attributeFilter: [dataTrigger],
        childList: true,
        subtree: true,
      })
      return mo
    }
  }
  customElements.define(tag, ControlTrack)
}
