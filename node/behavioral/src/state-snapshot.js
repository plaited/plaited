'use strict'
var __assign = (this && this.__assign) || function () {
  __assign = Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
      s = arguments[i]
      for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
        t[p] = s[p]
    }
    return t
  }
  return __assign.apply(this, arguments)
}
Object.defineProperty(exports, '__esModule', { value: true })
exports.stateSnapshot = void 0
var stateSnapshot = function (_a) {
  var bids = _a.bids, selectedEvent = _a.selectedEvent
  var ruleSets = []
  var _loop_1 = function (bid) {
    var _ = bid.generator, waitFor = bid.waitFor, block = bid.block, request = bid.request, thread = bid.thread, priority = bid.priority, trigger = bid.trigger
    var obj = {
      thread: thread,
      priority: priority,
    }
    var selected = void 0
    waitFor &&
            Object.assign(obj, {
              waitFor: Array.isArray(waitFor) ? waitFor : [ waitFor ],
            })
    block &&
            Object.assign(obj, {
              block: Array.isArray(block) ? block : [ block ],
            })
    if (request) {
      var arr = Array.isArray(request) ? request : [ request ]
      arr.some(function (_a) {
        var type = _a.type
        return type === selectedEvent.type && priority === selectedEvent.priority
      }) &&
                (selected = selectedEvent.type)
      Object.assign(obj, {
        request: arr,
      })
    }
    ruleSets.push(__assign(__assign(__assign({}, obj), (trigger && { trigger: trigger })), (selected && { selected: selected })))
  }
  for (var _i = 0, bids_1 = bids; _i < bids_1.length; _i++) {
    var bid = bids_1[_i]
    _loop_1(bid)
  }
  return ruleSets.sort(function (a, b) { return a.priority - b.priority })
}
exports.stateSnapshot = stateSnapshot
