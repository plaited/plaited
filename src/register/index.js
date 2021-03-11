import {track, baseDynamics} from '@plaited/behavioral'
import {observer} from './observer'
import {dataIsland} from '../constants'
import {constructableSupported} from './constructableSupported'

export const register = (tag, {strands = {}, actions = {}, options = {}}) => {
  if (customElements.get(tag)) return
  class ControlTrack extends HTMLElement {
    targets = {}
    events = new Set()
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
      this.observer = observer(this)
      const obj = track(strands, options)
      for(const key in obj) {
        Object.defineProperty(this, key, {
          enumerable: true,
          get: () => obj[key],
          set: () => {console.error(`${key} reserved: do not use for instance or methods name`)},
        })
      }
      this.feedback(actions(this.target))
      this.trigger({eventName: `connected->${this.tagName.toLocaleLowerCase()}`, baseDynamic: baseDynamics.objectObject})
    }
    disconnectedCallback() {
      this.observer.disconnect()
      this.trigger({eventName: `disconnected->${this.tagName.toLocaleLowerCase()}`, baseDynamic: baseDynamics.objectObject})
    }
    get target(){
      return id =>  this.targets.get(id) || []
    }
  }
  customElements.define(tag, ControlTrack)
}

