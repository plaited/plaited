'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
var dev_deps_js_1 = require('../../../dev-deps.js')
var mod_js_1 = require('../../mod.js')
Deno.test('Add hot water 3 times', function () {
  var actual = []
  var _a = (0, mod_js_1.bProgram)(), addThreads = _a.addThreads, thread = _a.thread, sync = _a.sync, trigger = _a.trigger, feedback = _a.feedback
  addThreads({
    addHot: thread(sync({ request: { type: 'hot' } }), sync({ request: { type: 'hot' } }), sync({ request: { type: 'hot' } })),
  })
  feedback({
    hot: function () {
      actual.push('hot')
    },
  })
  trigger({ type: 'start' });
  (0, dev_deps_js_1.assertEquals)(actual, [ 'hot', 'hot', 'hot' ])
})
Deno.test('Add hot/cold water 3 times', function () {
  var actual = []
  var _a = (0, mod_js_1.bProgram)(), addThreads = _a.addThreads, thread = _a.thread, sync = _a.sync, trigger = _a.trigger, feedback = _a.feedback
  addThreads({
    addHot: thread(sync({ request: { type: 'hot' } }), sync({ request: { type: 'hot' } }), sync({ request: { type: 'hot' } })),
    addCold: thread(sync({ request: { type: 'cold' } }), sync({ request: { type: 'cold' } }), sync({ request: { type: 'cold' } })),
  })
  feedback({
    hot: function () {
      actual.push('hot')
    },
    cold: function () {
      actual.push('cold')
    },
  })
  trigger({ type: 'start' });
  (0, dev_deps_js_1.assertEquals)(actual, [
    'hot',
    'hot',
    'hot',
    'cold',
    'cold',
    'cold',
  ])
})
Deno.test('interleave', function () {
  var actual = []
  var _a = (0, mod_js_1.bProgram)(), addThreads = _a.addThreads, thread = _a.thread, sync = _a.sync, trigger = _a.trigger, feedback = _a.feedback, loop = _a.loop
  addThreads({
    addHot: thread(sync({ request: { type: 'hot' } }), sync({ request: { type: 'hot' } }), sync({ request: { type: 'hot' } })),
    addCold: thread(sync({ request: { type: 'cold' } }), sync({ request: { type: 'cold' } }), sync({ request: { type: 'cold' } })),
    mixHotCold: loop([
      sync({
        waitFor: { type: 'hot' },
        block: { type: 'cold' },
      }),
      sync({
        waitFor: { type: 'cold' },
        block: { type: 'hot' },
      }),
    ]),
  })
  feedback({
    hot: function () {
      actual.push('hot')
    },
    cold: function () {
      actual.push('cold')
    },
  })
  trigger({ type: 'start' });
  (0, dev_deps_js_1.assertEquals)(actual, [
    'hot',
    'cold',
    'hot',
    'cold',
    'hot',
    'cold',
  ])
})
Deno.test('logging', function (t) {
  var logs = []
  var _a = (0, mod_js_1.bProgram)({
      dev: function (msg) { return logs.push(msg) },
    }), addThreads = _a.addThreads, thread = _a.thread, sync = _a.sync, trigger = _a.trigger, loop = _a.loop
  addThreads({
    addHot: thread(sync({ request: { type: 'hot' } }), sync({ request: { type: 'hot' } }), sync({ request: { type: 'hot' } })),
    addCold: thread(sync({ request: { type: 'cold' } }), sync({ request: { type: 'cold' } }), sync({ request: { type: 'cold' } })),
    mixHotCold: loop([
      sync({
        waitFor: { type: 'hot' },
        block: { type: 'cold' },
      }),
      sync({
        waitFor: { type: 'cold' },
        block: { type: 'hot' },
      }),
    ]),
  })
  trigger({ type: 'start' });
  (0, dev_deps_js_1.assertSnapshot)(t, logs)
})
