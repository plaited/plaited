'use strict'
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
var __values = (this && this.__values) || function(o) {
  var s = typeof Symbol === 'function' && Symbol.iterator, m = s && o[s], i = 0
  if (m) return m.call(o)
  if (o && typeof o.length === 'number') return {
    next: function () {
      if (o && i >= o.length) o = void 0
      return { value: o && o[i++], done: !o }
    },
  }
  throw new TypeError(s ? 'Object is not iterable.' : 'Symbol.iterator is not defined.')
}
Object.defineProperty(exports, '__esModule', { value: true })
exports.sync = exports.loop = exports.thread = void 0
/**
 * @description
 * creates a behavioral thread from synchronization sets and/or other  behavioral threads
 */
var thread = function () {
  var rules = []
  for (var _i = 0; _i < arguments.length; _i++) {
    rules[_i] = arguments[_i]
  }
  return function () {
    var _i, rules_1, rule
    return __generator(this, function (_a) {
      switch (_a.label) {
        case 0:
          _i = 0, rules_1 = rules
          _a.label = 1
        case 1:
          if (!(_i < rules_1.length)) return [ 3 /*break*/, 4 ]
          rule = rules_1[_i]
          return [ 5 /*yield**/, __values(rule()) ]
        case 2:
          _a.sent()
          _a.label = 3
        case 3:
          _i++
          return [ 3 /*break*/, 1 ]
        case 4: return [ 2 /*return*/]
      }
    })
  }
}
exports.thread = thread
/**
 * @description
 * A behavioral thread that loops infinitely or until some callback condition is false
 * like a mode change open -> close. This function returns a threads
 */
var loop = function (rules, condition) {
  if (condition === void 0) { condition = function () { return true } }
  return function () {
    var _i, rules_2, rule
    return __generator(this, function (_a) {
      switch (_a.label) {
        case 0:
          if (!condition()) return [ 3 /*break*/, 5 ]
          _i = 0, rules_2 = rules
          _a.label = 1
        case 1:
          if (!(_i < rules_2.length)) return [ 3 /*break*/, 4 ]
          rule = rules_2[_i]
          return [ 5 /*yield**/, __values(rule()) ]
        case 2:
          _a.sent()
          _a.label = 3
        case 3:
          _i++
          return [ 3 /*break*/, 1 ]
        case 4: return [ 3 /*break*/, 0 ]
        case 5: return [ 2 /*return*/]
      }
    })
  }
}
exports.loop = loop
/**
 * @description
 * At synchronization points, each behavioral thread specifies three sets of events:
 * requested events: the threads proposes that these be considered for triggering,
 * and asks to be notified when any of them occurs; waitFor events: the threads does not request these, but
 * asks to be notified when any of them is triggered; and blocked events: the
 * threads currently forbids triggering
 * any of these events.
 */
var sync = function (set) {
  return function () {
    return __generator(this, function (_a) {
      switch (_a.label) {
        case 0: return [ 4 /*yield*/, set ]
        case 1:
          _a.sent()
          return [ 2 /*return*/]
      }
    })
  }
}
exports.sync = sync
