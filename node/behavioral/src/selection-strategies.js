'use strict'
var _a
Object.defineProperty(exports, '__esModule', { value: true })
exports.selectionStrategies = exports.priorityStrategy = exports.chaosStrategy = exports.randomizedStrategy = void 0
var constants_js_1 = require('./constants.js')
/** @description Randomized Priority Queue Selection Strategy */
var randomizedStrategy = function (filteredEvents) {
  var _a
  for (var i = filteredEvents.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1))
    _a = [
      filteredEvents[j],
      filteredEvents[i],
    ], filteredEvents[i] = _a[0], filteredEvents[j] = _a[1]
  }
  return filteredEvents.sort(function (_a, _b) {
    var priorityA = _a.priority
    var priorityB = _b.priority
    return priorityA - priorityB
  })[0]
}
exports.randomizedStrategy = randomizedStrategy
/** @description Chaos Selection Strategy */
var chaosStrategy = function (filteredEvents) {
  return filteredEvents[Math.floor(Math.random() * Math.floor(filteredEvents.length))]
}
exports.chaosStrategy = chaosStrategy
/** @description Priority Queue Selection Strategy */
var priorityStrategy = function (filteredEvents) {
  return filteredEvents.sort(function (_a, _b) {
    var priorityA = _a.priority
    var priorityB = _b.priority
    return priorityA - priorityB
  })[0]
}
exports.priorityStrategy = priorityStrategy
exports.selectionStrategies = (_a = {},
_a[constants_js_1.strategies.priority] = exports.priorityStrategy,
_a[constants_js_1.strategies.chaos] = exports.chaosStrategy,
_a[constants_js_1.strategies.randomized] = exports.randomizedStrategy,
_a)
