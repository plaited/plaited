import {CandidateBid} from './types'

/** @description Randomized Priority Queue Selection Strategy */
const shuffle = (array: unknown[]) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[array[i], array[j]] = [array[j], array[i]]
  }
}
export const randomizedStrategy = (filteredEvents: CandidateBid[]) => {
  shuffle(filteredEvents)
  return filteredEvents.sort(
    ({priority: priorityA}, {priority: priorityB}) => priorityA - priorityB,
  )[0]
}

/** @description Chaos Selection Strategy */
const randomArrayElement = (arr: CandidateBid[]) =>
  arr[Math.floor(Math.random() * Math.floor(arr.length))]
export const chaosStrategy = (filteredEvents: CandidateBid[]) => randomArrayElement(filteredEvents)

/** @description Priority Queue Selection Strategy */
export const priorityStrategy = (filteredEvents: CandidateBid[]) => filteredEvents.sort(
  ({priority: priorityA}, {priority: priorityB}) =>
    priorityA - priorityB,
)[0]
