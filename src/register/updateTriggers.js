import {baseDynamics} from '@plaited/behavioral'
import {dataIsland, dataTrigger} from '../constants'

const matchAllEvents = str => {
  const regexp = /(\w+)(?:->)/g
  return [...str.matchAll(regexp)].flatMap(([, event]) => event)
}

const getTriggerKey = (key, evt) => {
  const el = evt.target
  const dataTrigger = el.dataset.trigger
  if(!dataTrigger) return
  return dataTrigger
    .trim()
    .split(/\s+/)
    .find(str => str.includes(`${key}->`))
}

export const updateTriggers = context => {
  context.events.forEach(evt => {
    context[`on${evt}`] = null
  })
  context.events.clear()
  const triggers = new Set([...(context.querySelectorAll(`[${dataTrigger}]`))]
    .filter(el => el.closest(`[${dataIsland}]`) === context)
    .flatMap(el => matchAllEvents(el.dataset.trigger)))
  for(const key of triggers) {
    context.events.add(key)
    context[`on${key}`] = evt => {
      const triggerKey = getTriggerKey(key, evt)
      triggerKey && context.trigger({
        eventName: triggerKey,
        payload: evt,
        baseDynamic: baseDynamics.objectPerson,
      })
    }
  }
}
