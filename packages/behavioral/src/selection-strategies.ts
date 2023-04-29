import { Strategy } from "./types.js";
import { strategies } from "./constants.js";
/** @description Randomized Priority Queue Selection Strategy */
export const randomizedStrategy: Strategy = (filteredEvents) => {
  for (let i = filteredEvents.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [filteredEvents[i], filteredEvents[j]] = [
      filteredEvents[j],
      filteredEvents[i],
    ];
  }
  return filteredEvents.sort(
    ({ priority: priorityA }, { priority: priorityB }) => priorityA - priorityB,
  )[0];
};

/** @description Chaos Selection Strategy */
export const chaosStrategy: Strategy = (filteredEvents) =>
  filteredEvents[Math.floor(Math.random() * Math.floor(filteredEvents.length))];

/** @description Priority Queue Selection Strategy */
export const priorityStrategy: Strategy = (filteredEvents) =>
  filteredEvents.sort(
    ({ priority: priorityA }, { priority: priorityB }) => priorityA - priorityB,
  )[0];

export const selectionStrategies = {
  [strategies.priority]: priorityStrategy,
  [strategies.chaos]: chaosStrategy,
  [strategies.randomized]: randomizedStrategy,
};
