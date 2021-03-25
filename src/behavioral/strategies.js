import {selectionStrategies} from './constants.js'
import {requestInParameter} from './requestInParameter.js'
const shuffle = array => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]]
  }
}
const randomizedPriority = (candidateEvents, blockedEvents) => {
  const filteredEvents = candidateEvents.filter(request => !blockedEvents.some(requestInParameter(request)))
  shuffle(filteredEvents)
  return filteredEvents.sort(({priority: priorityA}, {priority: priorityB}) => priorityA - priorityB)[0]
}
const chaosStrategy = (candidateEvents, blockedEvents) => {
  const randomArrayElement = arr => arr[Math.floor(Math.random() * Math.floor(arr.length))]
  return randomArrayElement(candidateEvents.filter(request => !blockedEvents.some(requestInParameter(request))))
}
const priorityStrategy = (candidateEvents, blockedEvents) => {
  return candidateEvents
    .filter(request => !blockedEvents.some(requestInParameter(request)))
    .sort(({priority: priorityA}, {priority: priorityB}) => priorityA - priorityB)[0]
}
export const strategies = {
  [selectionStrategies.random]: randomizedPriority,
  [selectionStrategies.priority]: priorityStrategy,
  [selectionStrategies.chaos]: chaosStrategy,
}
