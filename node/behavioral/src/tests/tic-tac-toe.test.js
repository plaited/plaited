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
var dev_deps_js_1 = require('../../../dev-deps.js')
var mod_js_1 = require('../mod.js')
var winConditions = [
  //rows
  [ 0, 1, 2 ],
  [ 3, 4, 5 ],
  [ 6, 7, 8 ],
  // columns
  [ 0, 3, 6 ],
  [ 1, 4, 7 ],
  [ 2, 5, 8 ],
  // diagonals
  [ 0, 4, 8 ],
  [ 2, 4, 6 ],
]
var squares = [ 0, 1, 2, 3, 4, 5, 6, 7, 8 ]
Deno.test('detect wins', function () {
  var _a = (0, mod_js_1.bProgram)(), sync = _a.sync, addThreads = _a.addThreads, thread = _a.thread, feedback = _a.feedback, trigger = _a.trigger
  var actual = []
  var playerWins = function (player) {
    return winConditions.reduce(function (acc, win) {
      acc[''.concat(player, 'Wins (').concat(win, ')')] = thread(sync({
        waitFor: {
          cb: function (_a) {
            var type = _a.type, detail = _a.detail
            return type === player && win.includes(detail.square)
          },
        },
      }), sync({
        waitFor: {
          cb: function (_a) {
            var type = _a.type, detail = _a.detail
            return type === player && win.includes(detail.square)
          },
        },
      }), sync({
        waitFor: {
          cb: function (_a) {
            var type = _a.type, detail = _a.detail
            return type === player && win.includes(detail.square)
          },
        },
      }), sync({
        request: { type: ''.concat(player, 'Win'), detail: { win: win } },
      }))
      return acc
    }, {})
  }
  addThreads(__assign({}, playerWins('X')))
  feedback({
    XWin: function (deatil) {
      Object.assign(actual, deatil.win)
    },
  })
  trigger({ type: 'X', detail: { square: 1 } })
  trigger({ type: 'X', detail: { square: 4 } })
  trigger({ type: 'X', detail: { square: 7 } });
  (0, dev_deps_js_1.assertEquals)(actual, [ 1, 4, 7 ])
})
Deno.test('enforceTurns', function () {
  var _a = (0, mod_js_1.bProgram)(), sync = _a.sync, addThreads = _a.addThreads, thread = _a.thread, feedback = _a.feedback, trigger = _a.trigger, loop = _a.loop
  var actual
  var playerWins = function (player) {
    return winConditions.reduce(function (acc, win) {
      acc[''.concat(player, 'Wins (').concat(win, ')')] = thread(sync({
        waitFor: {
          cb: function (_a) {
            var type = _a.type, detail = _a.detail
            return type === player && win.includes(detail.square)
          },
        },
      }), sync({
        waitFor: {
          cb: function (_a) {
            var type = _a.type, detail = _a.detail
            return type === player && win.includes(detail.square)
          },
        },
      }), sync({
        waitFor: {
          cb: function (_a) {
            var type = _a.type, detail = _a.detail
            return type === player && win.includes(detail.square)
          },
        },
      }), sync({
        request: { type: ''.concat(player, 'Win'), detail: { win: win } },
      }))
      return acc
    }, {})
  }
  addThreads(__assign(__assign(__assign({}, playerWins('O')), playerWins('X')), { enforceTurns: loop([
    sync({ waitFor: { type: 'X' }, block: { type: 'O' } }),
    sync({ waitFor: { type: 'O' }, block: { type: 'X' } }),
  ]) }))
  feedback({
    X: function (_a) {
      var square = _a.square
      actual = {
        player: 'X',
        square: square,
      }
    },
    O: function (_a) {
      var square = _a.square
      actual = {
        player: 'X',
        square: square,
      }
    },
  })
  trigger({ type: 'X', detail: { square: 1 } })
  trigger({ type: 'X', detail: { square: 4 } })
  trigger({ type: 'X', detail: { square: 7 } });
  //@ts-ignore: test
  (0, dev_deps_js_1.assertEquals)(actual, { player: 'X', square: 1 })
})
Deno.test('enforceTurns without blocking', function () {
  var _a = (0, mod_js_1.bProgram)(), sync = _a.sync, addThreads = _a.addThreads, thread = _a.thread, feedback = _a.feedback, trigger = _a.trigger, loop = _a.loop
  var actual
  var playerWins = function (player) {
    return winConditions.reduce(function (acc, win) {
      acc[''.concat(player, 'Wins (').concat(win, ')')] = thread(sync({
        waitFor: {
          cb: function (_a) {
            var type = _a.type, detail = _a.detail
            return type === player && win.includes(detail.square)
          },
        },
      }), sync({
        waitFor: {
          cb: function (_a) {
            var type = _a.type, detail = _a.detail
            return type === player && win.includes(detail.square)
          },
        },
      }), sync({
        waitFor: {
          cb: function (_a) {
            var type = _a.type, detail = _a.detail
            return type === player && win.includes(detail.square)
          },
        },
      }), sync({
        request: { type: ''.concat(player, 'Win'), detail: { win: win } },
      }))
      return acc
    }, {})
  }
  addThreads(__assign(__assign(__assign({}, playerWins('O')), playerWins('X')), { enforceTurns: loop([
    sync({ waitFor: { type: 'X' }, block: { type: 'O' } }),
    sync({ waitFor: { type: 'O' }, block: { type: 'X' } }),
  ]) }))
  feedback({
    XWin: function (_a) {
      var win = _a.win
      actual = {
        player: 'X',
        win: win,
      }
    },
    OWin: function (_a) {
      var win = _a.win
      actual = {
        player: 'O',
        win: win,
      }
    },
  })
  trigger({ type: 'X', detail: { square: 0 } })
  trigger({ type: 'O', detail: { square: 1 } })
  trigger({ type: 'X', detail: { square: 4 } })
  trigger({ type: 'O', detail: { square: 2 } })
  trigger({ type: 'X', detail: { square: 8 } });
  //@ts-ignore: test
  (0, dev_deps_js_1.assertEquals)(actual, { player: 'X', win: [ 0, 4, 8 ] })
})
Deno.test('squaresTaken', function () {
  var _a = (0, mod_js_1.bProgram)(), sync = _a.sync, addThreads = _a.addThreads, thread = _a.thread, feedback = _a.feedback, trigger = _a.trigger, loop = _a.loop
  var actual = []
  var playerWins = function (player) {
    return winConditions.reduce(function (acc, win) {
      acc[''.concat(player, 'Wins (').concat(win, ')')] = thread(sync({
        waitFor: {
          cb: function (_a) {
            var type = _a.type, detail = _a.detail
            return type === player && win.includes(detail.square)
          },
        },
      }), sync({
        waitFor: {
          cb: function (_a) {
            var type = _a.type, detail = _a.detail
            return type === player && win.includes(detail.square)
          },
        },
      }), sync({
        waitFor: {
          cb: function (_a) {
            var type = _a.type, detail = _a.detail
            return type === player && win.includes(detail.square)
          },
        },
      }), sync({
        request: { type: ''.concat(player, 'Win'), detail: { win: win } },
      }))
      return acc
    }, {})
  }
  var squaresTaken = squares.reduce(function (acc, square) {
    acc['('.concat(square, ') taken')] = thread(sync({
      waitFor: { cb: function (_a) {
        var detail = _a.detail
        return square === detail.square
      } },
    }), sync({
      block: { cb: function (_a) {
        var detail = _a.detail
        return square === detail.square
      } },
    }))
    return acc
  }, {})
  addThreads(__assign(__assign(__assign(__assign({}, playerWins('O')), playerWins('X')), { enforceTurns: loop([
    sync({ waitFor: { type: 'X' }, block: { type: 'O' } }),
    sync({ waitFor: { type: 'O' }, block: { type: 'X' } }),
  ]) }), squaresTaken))
  feedback({
    O: function (_a) {
      var square = _a.square
      actual.push({
        player: 'O',
        square: square,
      })
    },
  })
  trigger({ type: 'X', detail: { square: 0 } })
  trigger({ type: 'O', detail: { square: 0 } }) // reuse
  trigger({ type: 'X', detail: { square: 4 } })
  trigger({ type: 'O', detail: { square: 2 } })
  trigger({ type: 'X', detail: { square: 8 } });
  //@ts-ignore: test
  (0, dev_deps_js_1.assertEquals)(actual, [ { player: 'O', square: 2 } ])
})
Deno.test('doesn\'t stop game', function () {
  var _a = (0, mod_js_1.bProgram)(), sync = _a.sync, addThreads = _a.addThreads, thread = _a.thread, feedback = _a.feedback, trigger = _a.trigger, loop = _a.loop
  var actual = []
  var playerWins = function (player) {
    return winConditions.reduce(function (acc, win) {
      acc[''.concat(player, 'Wins (').concat(win, ')')] = thread(sync({
        waitFor: {
          cb: function (_a) {
            var type = _a.type, detail = _a.detail
            return type === player && win.includes(detail.square)
          },
        },
      }), sync({
        waitFor: {
          cb: function (_a) {
            var type = _a.type, detail = _a.detail
            return type === player && win.includes(detail.square)
          },
        },
      }), sync({
        waitFor: {
          cb: function (_a) {
            var type = _a.type, detail = _a.detail
            return type === player && win.includes(detail.square)
          },
        },
      }), sync({
        request: { type: ''.concat(player, 'Win'), detail: { win: win } },
      }))
      return acc
    }, {})
  }
  var squaresTaken = squares.reduce(function (acc, square) {
    acc['('.concat(square, ') taken')] = thread(sync({
      waitFor: { cb: function (_a) {
        var detail = _a.detail
        return square === detail.square
      } },
    }), sync({
      block: { cb: function (_a) {
        var detail = _a.detail
        return square === detail.square
      } },
    }))
    return acc
  }, {})
  addThreads(__assign(__assign(__assign(__assign({}, playerWins('O')), playerWins('X')), { enforceTurns: loop([
    sync({ waitFor: { type: 'X' }, block: { type: 'O' } }),
    sync({ waitFor: { type: 'O' }, block: { type: 'X' } }),
  ]) }), squaresTaken))
  feedback({
    X: function (_a) {
      var square = _a.square
      actual.push({
        player: 'X',
        square: square,
      })
    },
    O: function (_a) {
      var square = _a.square
      actual.push({
        player: 'O',
        square: square,
      })
    },
    XWin: function (_a) {
      var win = _a.win
      actual.push({
        player: 'X',
        win: win,
      })
    },
    OWin: function (_a) {
      var win = _a.win
      actual.push({
        player: 'O',
        win: win,
      })
    },
  })
  trigger({ type: 'X', detail: { square: 0 } })
  trigger({ type: 'O', detail: { square: 1 } })
  trigger({ type: 'X', detail: { square: 4 } })
  trigger({ type: 'O', detail: { square: 2 } })
  trigger({ type: 'X', detail: { square: 8 } })
  trigger({ type: 'O', detail: { square: 7 } });
  //@ts-ignore: test
  (0, dev_deps_js_1.assertEquals)(actual, [
    { player: 'X', square: 0 },
    { player: 'O', square: 1 },
    { player: 'X', square: 4 },
    { player: 'O', square: 2 },
    { player: 'X', square: 8 },
    { player: 'X', win: [ 0, 4, 8 ] },
    { player: 'O', square: 7 },
  ])
})
Deno.test('stopGame', function () {
  var _a = (0, mod_js_1.bProgram)(), sync = _a.sync, addThreads = _a.addThreads, thread = _a.thread, feedback = _a.feedback, trigger = _a.trigger, loop = _a.loop
  var actual = []
  var playerWins = function (player) {
    return winConditions.reduce(function (acc, win) {
      acc[''.concat(player, 'Wins (').concat(win, ')')] = thread(sync({
        waitFor: {
          cb: function (_a) {
            var type = _a.type, detail = _a.detail
            return type === player && win.includes(detail.square)
          },
        },
      }), sync({
        waitFor: {
          cb: function (_a) {
            var type = _a.type, detail = _a.detail
            return type === player && win.includes(detail.square)
          },
        },
      }), sync({
        waitFor: {
          cb: function (_a) {
            var type = _a.type, detail = _a.detail
            return type === player && win.includes(detail.square)
          },
        },
      }), sync({
        request: { type: ''.concat(player, 'Win'), detail: { win: win } },
      }))
      return acc
    }, {})
  }
  var squaresTaken = squares.reduce(function (acc, square) {
    acc['('.concat(square, ') taken')] = thread(sync({
      waitFor: { cb: function (_a) {
        var detail = _a.detail
        return square === detail.square
      } },
    }), sync({
      block: { cb: function (_a) {
        var detail = _a.detail
        return square === detail.square
      } },
    }))
    return acc
  }, {})
  addThreads(__assign(__assign(__assign(__assign(__assign({}, playerWins('O')), playerWins('X')), { enforceTurns: loop([
    sync({ waitFor: { type: 'X' }, block: { type: 'O' } }),
    sync({ waitFor: { type: 'O' }, block: { type: 'X' } }),
  ]) }), squaresTaken), { stopGame: thread(sync({ waitFor: [ { type: 'XWin' }, { type: 'OWin' } ] }), sync({ block: [ { type: 'X' }, { type: 'O' } ] })) }))
  feedback({
    X: function (_a) {
      var square = _a.square
      actual.push({
        player: 'X',
        square: square,
      })
    },
    O: function (_a) {
      var square = _a.square
      actual.push({
        player: 'O',
        square: square,
      })
    },
    XWin: function (_a) {
      var win = _a.win
      actual.push({
        player: 'X',
        win: win,
      })
    },
    OWin: function (_a) {
      var win = _a.win
      actual.push({
        player: 'O',
        win: win,
      })
    },
  })
  trigger({ type: 'X', detail: { square: 0 } })
  trigger({ type: 'O', detail: { square: 1 } })
  trigger({ type: 'X', detail: { square: 4 } })
  trigger({ type: 'O', detail: { square: 2 } })
  trigger({ type: 'X', detail: { square: 8 } })
  trigger({ type: 'O', detail: { square: 7 } });
  //@ts-ignore: test
  (0, dev_deps_js_1.assertEquals)(actual, [
    { player: 'X', square: 0 },
    { player: 'O', square: 1 },
    { player: 'X', square: 4 },
    { player: 'O', square: 2 },
    { player: 'X', square: 8 },
    { player: 'X', win: [ 0, 4, 8 ] },
  ])
})
Deno.test('defaultMoves', function () {
  var _a = (0, mod_js_1.bProgram)(), sync = _a.sync, addThreads = _a.addThreads, thread = _a.thread, feedback = _a.feedback, trigger = _a.trigger, loop = _a.loop
  var actual = []
  var playerWins = function (player) {
    return winConditions.reduce(function (acc, win) {
      acc[''.concat(player, 'Wins (').concat(win, ')')] = thread(sync({
        waitFor: {
          cb: function (_a) {
            var type = _a.type, detail = _a.detail
            return type === player && win.includes(detail.square)
          },
        },
      }), sync({
        waitFor: {
          cb: function (_a) {
            var type = _a.type, detail = _a.detail
            return type === player && win.includes(detail.square)
          },
        },
      }), sync({
        waitFor: {
          cb: function (_a) {
            var type = _a.type, detail = _a.detail
            return type === player && win.includes(detail.square)
          },
        },
      }), sync({
        request: { type: ''.concat(player, 'Win'), detail: { win: win } },
      }))
      return acc
    }, {})
  }
  var squaresTaken = squares.reduce(function (acc, square) {
    acc['('.concat(square, ') taken')] = thread(sync({
      waitFor: { cb: function (_a) {
        var detail = _a.detail
        return square === detail.square
      } },
    }), sync({
      block: { cb: function (_a) {
        var detail = _a.detail
        return square === detail.square
      } },
    }))
    return acc
  }, {})
  addThreads(__assign(__assign(__assign(__assign(__assign({}, playerWins('O')), playerWins('X')), { enforceTurns: loop([
    sync({ waitFor: { type: 'X' }, block: { type: 'O' } }),
    sync({ waitFor: { type: 'O' }, block: { type: 'X' } }),
  ]) }), squaresTaken), { stopGame: thread(sync({ waitFor: [ { type: 'XWin' }, { type: 'OWin' } ] }), sync({ block: [ { type: 'X' }, { type: 'O' } ] })), defaultMoves: loop([
    sync({
      request: squares.map(function (square) { return ({
        type: 'O',
        detail: { square: square },
      }) }),
    }),
  ]) }))
  feedback({
    X: function (_a) {
      var square = _a.square
      actual.push({
        player: 'X',
        square: square,
      })
    },
    O: function (_a) {
      var square = _a.square
      actual.push({
        player: 'O',
        square: square,
      })
    },
    XWin: function (_a) {
      var win = _a.win
      actual.push({
        player: 'X',
        win: win,
      })
    },
    OWin: function (_a) {
      var win = _a.win
      actual.push({
        player: 'O',
        win: win,
      })
    },
  })
  trigger({ type: 'X', detail: { square: 0 } })
  trigger({ type: 'X', detail: { square: 4 } })
  trigger({ type: 'X', detail: { square: 8 } });
  //@ts-ignore: test
  (0, dev_deps_js_1.assertEquals)(actual, [
    { player: 'X', square: 0 },
    { player: 'O', square: 1 },
    { player: 'X', square: 4 },
    { player: 'O', square: 2 },
    { player: 'X', square: 8 },
    { player: 'X', win: [ 0, 4, 8 ] },
  ])
})
Deno.test('startAtCenter', function () {
  var _a = (0, mod_js_1.bProgram)(), sync = _a.sync, addThreads = _a.addThreads, thread = _a.thread, feedback = _a.feedback, trigger = _a.trigger, loop = _a.loop
  var actual = []
  var playerWins = function (player) {
    return winConditions.reduce(function (acc, win) {
      acc[''.concat(player, 'Wins (').concat(win, ')')] = thread(sync({
        waitFor: {
          cb: function (_a) {
            var type = _a.type, detail = _a.detail
            return type === player && win.includes(detail.square)
          },
        },
      }), sync({
        waitFor: {
          cb: function (_a) {
            var type = _a.type, detail = _a.detail
            return type === player && win.includes(detail.square)
          },
        },
      }), sync({
        waitFor: {
          cb: function (_a) {
            var type = _a.type, detail = _a.detail
            return type === player && win.includes(detail.square)
          },
        },
      }), sync({
        request: { type: ''.concat(player, 'Win'), detail: { win: win } },
      }))
      return acc
    }, {})
  }
  var squaresTaken = squares.reduce(function (acc, square) {
    acc['('.concat(square, ') taken')] = thread(sync({
      waitFor: { cb: function (_a) {
        var detail = _a.detail
        return square === detail.square
      } },
    }), sync({
      block: { cb: function (_a) {
        var detail = _a.detail
        return square === detail.square
      } },
    }))
    return acc
  }, {})
  addThreads(__assign(__assign(__assign(__assign(__assign({}, playerWins('O')), playerWins('X')), { enforceTurns: loop([
    sync({ waitFor: { type: 'X' }, block: { type: 'O' } }),
    sync({ waitFor: { type: 'O' }, block: { type: 'X' } }),
  ]) }), squaresTaken), { stopGame: thread(sync({ waitFor: [ { type: 'XWin' }, { type: 'OWin' } ] }), sync({ block: [ { type: 'X' }, { type: 'O' } ] })), startAtCenter: thread(sync({
    request: {
      type: 'O',
      detail: { square: 4 },
    },
  })), defaultMoves: loop([
    sync({
      request: squares.map(function (square) { return ({
        type: 'O',
        detail: { square: square },
      }) }),
    }),
  ]) }))
  feedback({
    X: function (_a) {
      var square = _a.square
      actual.push({
        player: 'X',
        square: square,
      })
    },
    O: function (_a) {
      var square = _a.square
      actual.push({
        player: 'O',
        square: square,
      })
    },
    XWin: function (_a) {
      var win = _a.win
      actual.push({
        player: 'X',
        win: win,
      })
    },
    OWin: function (_a) {
      var win = _a.win
      actual.push({
        player: 'O',
        win: win,
      })
    },
  })
  trigger({ type: 'X', detail: { square: 0 } })
  trigger({ type: 'X', detail: { square: 4 } })
  trigger({ type: 'X', detail: { square: 8 } });
  //@ts-ignore: test
  (0, dev_deps_js_1.assertEquals)(actual, [
    { player: 'X', square: 0 },
    { player: 'O', square: 4 },
    { player: 'X', square: 8 },
    { player: 'O', square: 1 },
  ])
})
Deno.test('prtypeCompletionOfLineWithTwoXs', function () {
  var _a = (0, mod_js_1.bProgram)(), sync = _a.sync, addThreads = _a.addThreads, thread = _a.thread, feedback = _a.feedback, trigger = _a.trigger, loop = _a.loop
  var actual = []
  var playerWins = function (player) {
    return winConditions.reduce(function (acc, win) {
      acc[''.concat(player, 'Wins (').concat(win, ')')] = thread(sync({
        waitFor: {
          cb: function (_a) {
            var type = _a.type, detail = _a.detail
            return type === player && win.includes(detail.square)
          },
        },
      }), sync({
        waitFor: {
          cb: function (_a) {
            var type = _a.type, detail = _a.detail
            return type === player && win.includes(detail.square)
          },
        },
      }), sync({
        waitFor: {
          cb: function (_a) {
            var type = _a.type, detail = _a.detail
            return type === player && win.includes(detail.square)
          },
        },
      }), sync({
        request: { type: ''.concat(player, 'Win'), detail: { win: win } },
      }))
      return acc
    }, {})
  }
  var squaresTaken = squares.reduce(function (acc, square) {
    acc['('.concat(square, ') taken')] = thread(sync({
      waitFor: { cb: function (_a) {
        var detail = _a.detail
        return square === detail.square
      } },
    }), sync({
      block: { cb: function (_a) {
        var detail = _a.detail
        return square === detail.square
      } },
    }))
    return acc
  }, {})
  var prtypeCompletionOfLineWithTwoXs = winConditions.reduce(function (acc, win) {
    acc['StopXWin('.concat(win, ')')] = thread(sync({
      waitFor: {
        cb: function (_a) {
          var type = _a.type, detail = _a.detail
          return type === 'X' && win.includes(detail.square)
        },
      },
    }), sync({
      waitFor: {
        cb: function (_a) {
          var type = _a.type, detail = _a.detail
          return type === 'X' && win.includes(detail.square)
        },
      },
    }), sync({
      request: win.map(function (square) { return ({ type: 'O', detail: { square: square } }) }),
    }))
    return acc
  }, {})
  addThreads(__assign(__assign(__assign(__assign(__assign(__assign(__assign({}, playerWins('O')), playerWins('X')), { enforceTurns: loop([
    sync({ waitFor: { type: 'X' }, block: { type: 'O' } }),
    sync({ waitFor: { type: 'O' }, block: { type: 'X' } }),
  ]) }), squaresTaken), { stopGame: thread(sync({ waitFor: [ { type: 'XWin' }, { type: 'OWin' } ] }), sync({ block: [ { type: 'X' }, { type: 'O' } ] })) }), prtypeCompletionOfLineWithTwoXs), { startAtCenter: thread(sync({
    request: {
      type: 'O',
      detail: { square: 4 },
    },
  })), defaultMoves: loop([
    sync({
      request: squares.map(function (square) { return ({
        type: 'O',
        detail: { square: square },
      }) }),
    }),
  ]) }))
  feedback({
    X: function (_a) {
      var square = _a.square
      actual.push({
        player: 'X',
        square: square,
      })
    },
    O: function (_a) {
      var square = _a.square
      actual.push({
        player: 'O',
        square: square,
      })
    },
    XWin: function (_a) {
      var win = _a.win
      actual.push({
        player: 'X',
        win: win,
      })
    },
    OWin: function (_a) {
      var win = _a.win
      actual.push({
        player: 'O',
        win: win,
      })
    },
  })
  trigger({ type: 'X', detail: { square: 0 } })
  trigger({ type: 'X', detail: { square: 3 } });
  //@ts-ignore: test
  (0, dev_deps_js_1.assertEquals)(actual, [
    { player: 'X', square: 0 },
    { player: 'O', square: 4 },
    { player: 'X', square: 3 },
    { player: 'O', square: 6 },
  ])
})
