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
var __generator = (this && this.__generator) || function (thisArg, body) {
  var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1] }, trys: [], ops: [] }, f, y, t, g
  return g = { next: verb(0), throw: verb(1), return: verb(2) }, typeof Symbol === 'function' && (g[Symbol.iterator] = function() { return this }), g
  function verb(n) { return function (v) { return step([ n, v ]) } }
  function step(op) {
    if (f) throw new TypeError('Generator is already executing.')
    while (g && (g = 0, op[0] && (_ = 0)), _) try {
      if (f = 1, y && (t = op[0] & 2 ? y['return'] : op[0] ? y['throw'] || ((t = y['return']) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t
      if (y = 0, t) op = [ op[0] & 2, t.value ]
      switch (op[0]) {
        case 0: case 1: t = op; break
        case 4: _.label++; return { value: op[1], done: false }
        case 5: _.label++; y = op[1]; op = [ 0 ]; continue
        case 7: op = _.ops.pop(); _.trys.pop(); continue
        default:
          if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue }
          if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break }
          if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break }
          if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break }
          if (t[2]) _.ops.pop()
          _.trys.pop(); continue
      }
      op = body.call(thisArg, _)
    } catch (e) { op = [ 6, e ]; y = 0 } finally { f = t = 0 }
    if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true }
  }
}
var __rest = (this && this.__rest) || function (s, e) {
  var t = {}
  for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
    t[p] = s[p]
  if (s != null && typeof Object.getOwnPropertySymbols === 'function')
    for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
      if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
        t[p[i]] = s[p[i]]
    }
  return t
}
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
  if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
    if (ar || !(i in from)) {
      if (!ar) ar = Array.prototype.slice.call(from, 0, i)
      ar[i] = from[i]
    }
  }
  return to.concat(ar || Array.prototype.slice.call(from))
}
Object.defineProperty(exports, '__esModule', { value: true })
exports.bProgram = void 0
var constants_js_1 = require('./constants.js')
var state_snapshot_js_1 = require('./state-snapshot.js')
var utils_1 = require('@plaited/utils')
var selection_strategies_js_1 = require('./selection-strategies.js')
var rules_js_1 = require('./rules.js')
var requestInParameter = function (_a) {
  var requestEventName = _a.type, _b = _a.detail, requestDetail = _b === void 0 ? {} : _b
  return function (_a) {
    var parameterEventName = _a.type, parameterAssertion = _a.cb
    return (parameterAssertion
            ? parameterAssertion({
              detail: requestDetail,
              type: requestEventName,
            })
            : requestEventName === parameterEventName)
  }
}
var bProgram = function (_a) {
  var _b = _a === void 0 ? {} : _a, 
    /** event selection strategy {@link Strategy}*/
    _c = _b.strategy, 
    /** event selection strategy {@link Strategy}*/
    strategy = _c === void 0 ? constants_js_1.strategies.priority : _c, 
    /** When set to true returns a stream with log of state snapshots, last selected event and trigger */
    dev = _b.dev
  var eventSelectionStrategy = typeof strategy === 'string'
        ? selection_strategies_js_1.selectionStrategies[strategy]
        : strategy
  var pending = new Set()
  var running = new Set()
  var actionPublisher = (0, utils_1.publisher)()
  var snapshotPublisher = dev && (0, utils_1.publisher)()
  function run() {
    running.size && step()
  }
  function step() {
    for (var _i = 0, running_1 = running; _i < running_1.length; _i++) {
      var bid = running_1[_i]
      var generator = bid.generator, priority = bid.priority, thread_1 = bid.thread, trigger_1 = bid.trigger
      var _a = generator.next(), value = _a.value, done = _a.done
      !done &&
                pending.add(__assign(__assign(__assign({ thread: thread_1, priority: priority }, (trigger_1 && { trigger: trigger_1 })), { generator: generator }), value))
      running.delete(bid)
    }
    selectNextEvent()
  }
  // Select next event
  function selectNextEvent() {
    var bids = __spreadArray([], pending, true)
    var candidates = []
    var _loop_1 = function (request, priority) {
      if (Array.isArray(request)) {
        candidates = candidates.concat(request.map(function (event) { return (__assign({ priority: priority }, event)) }))
        return 'continue'
      }
      if (request) {
        candidates.push(__assign({ priority: priority }, request)) // create candidates for each request with current bids priority
      }
    }
    for (var _i = 0, bids_1 = bids; _i < bids_1.length; _i++) {
      var _a = bids_1[_i], request = _a.request, priority = _a.priority
      _loop_1(request, priority)
    }
    var blocked = bids.flatMap(function (_a) {
      var block = _a.block
      return block || []
    })
    var filteredBids = candidates.filter(function (request) { return !blocked.some(requestInParameter(request)) })
    var selectedEvent = eventSelectionStrategy(filteredBids)
    if (selectedEvent) {
      dev && snapshotPublisher &&
                snapshotPublisher((0, state_snapshot_js_1.stateSnapshot)({ bids: bids, selectedEvent: selectedEvent }))
      nextStep(selectedEvent)
    }
  }
  // Queue up bids for next step of super step
  function nextStep(selectedEvent) {
    for (var _i = 0, pending_1 = pending; _i < pending_1.length; _i++) {
      var bid = pending_1[_i]
      var _a = bid.request, request = _a === void 0 ? [] : _a, _b = bid.waitFor, waitFor = _b === void 0 ? [] : _b, generator = bid.generator
      var waitList = __spreadArray(__spreadArray([], (Array.isArray(request) ? request : [ request ]), true), (Array.isArray(waitFor) ? waitFor : [ waitFor ]), true)
      if (waitList.some(requestInParameter(selectedEvent)) && generator) {
        running.add(bid)
        pending.delete(bid)
      }
    }
    var _p = selectedEvent.priority, _cb = selectedEvent.cb, detail = __rest(selectedEvent
      // To avoid infinite loop with calling trigger from feedback always stream select event
      // checking if the request is in the parameter which can be a waitFor or pending request
      , [ 'priority', 'cb' ])
    // To avoid infinite loop with calling trigger from feedback always stream select event
    // checking if the request is in the parameter which can be a waitFor or pending request
    actionPublisher(detail)
    run()
  }
  var trigger = function (_a) {
    var type = _a.type, detail = _a.detail
    var thread = function () {
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0: return [ 4 /*yield*/, {
            request: [ { type: type, detail: detail } ],
            waitFor: [ { type: '', cb: function () { return true } } ],
          } ]
          case 1:
            _a.sent()
            return [ 2 /*return*/]
        }
      })
    }
    running.add({
      thread: type,
      priority: 0,
      trigger: true,
      generator: thread(),
    })
    run()
  }
  var feedback = function (actions) {
    actionPublisher.subscribe(function (data) {
      var type = data.type, _a = data.detail, detail = _a === void 0 ? {} : _a
      Object.hasOwn(actions, type) &&
                actions[type](detail)
    })
  }
  var addThreads = function (threads) {
    for (var thread_2 in threads) {
      running.add({
        thread: thread_2,
        priority: running.size + 1,
        generator: threads[thread_2](),
      })
    }
  }
  if (dev && snapshotPublisher) {
    snapshotPublisher.subscribe(function (data) { return dev(data) })
  }
  return Object.freeze({
    /** add thread function to behavioral program */
    addThreads: addThreads,
    /** connect action function to behavioral program */
    feedback: feedback,
    /** trigger a run and event on behavioral program */
    trigger: trigger,
    /**
         * A behavioral thread that loops infinitely or until some callback condition is false
         * like a mode change open -> close. This function returns a threads
         */
    loop: rules_js_1.loop,
    /**
         * At synchronization points, each behavioral thread specifies three sets of events:
         * requested events: the threads proposes that these be considered for triggering,
         * and asks to be notified when any of them occurs; waitFor events: the threads does not request these, but
         * asks to be notified when any of them is triggered; and blocked events: the
         * threads currently forbids triggering
         * any of these events.
         */
    sync: rules_js_1.sync,
    /**
         * creates a behavioral thread from synchronization sets and/or other  behavioral threads
         */
    thread: rules_js_1.thread,
  })
}
exports.bProgram = bProgram
