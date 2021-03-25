import {track, baseDynamics} from '@plaited/behavioral'
import {dataIsland, dataTarget, dataTrigger} from './constants.js'
import {constructableSupported} from './constructableSupported.js'
import {connect} from './actor.js'

export const register = (tag, {strands = {}, actions = {}, options = {}}) => {
  if (customElements.get(tag)) return
  class ControlTrack extends HTMLElement {
    static matchAllEvents(str) {
      const regexp = /(\w+)(?:->)/g
      return [...str.matchAll(regexp)].flatMap(([, event]) => event)
    }
    static getTriggerKey(key, evt) {
      const el = evt.target
      const dataTrigger = el.dataset.trigger
      if (!dataTrigger) return
      return dataTrigger
        .trim()
        .split(/\s+/)
        .find(str => str.includes(`${key}->`))
    }
    #trigger
    #events = new Set()
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
      this.setAttribute(dataIsland, '')
      !constructableSupported && (this.style.display = 'contents')
      this.observer = this.#init()
      const {feedback, trigger, stream} = track(strands, options)
      options.debug && stream(options.debug)
      feedback(actions(id => {
        const targets = [...(this.querySelectorAll(`[${dataTarget}="${id}"]`))]
          .filter(el => el.closest(`[${dataIsland}]`) === this)
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
      if (this.#events.size > 0) {
        this.#events.forEach(evt => {
          this[`on${evt}`] = null
        })
        this.#events.clear()
      }
      const triggers = new Set([...(this.querySelectorAll(`[${dataTrigger}]`))]
        .reduce((acc, el) => {
          if (el.closest(`[${dataIsland}]`) !== this) return acc
          return acc.concat(ControlTrack.matchAllEvents(el.dataset.trigger))
        }, []))
      for (const key of triggers) {
        this.#events.add(key)
        this[`on${key}`] = evt => {
          const triggerKey = ControlTrack.getTriggerKey(key, evt)
          const closest = evt.target.closest(`[${dataIsland}]`) === this
          triggerKey && closest && this.#trigger({
            eventName: triggerKey,
            payload: evt,
            baseDynamic: baseDynamics.objectPerson,
          })
        }
      }
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
