"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var _plaited_1 = require("$plaited");
var _a = (0, _plaited_1.bProgram)(), trigger = _a.trigger, feedback = _a.feedback;
var send = (0, _plaited_1.useMain)(self, trigger)[0];
var calculator = {
    add: function (prev, cur) {
        return prev + cur;
    },
    subtract: function (prev, cur) {
        return prev - cur;
    },
    multiply: function (prev, cur) {
        return prev * cur;
    },
    divide: function (prev, cur) {
        return prev / cur;
    },
};
feedback({
    calculate: function (_a) {
        var prev = _a.prev, cur = _a.cur, operation = _a.operation;
        send('main', {
            type: 'calculation',
            detail: calculator[operation](prev, cur),
        });
        self.close();
    },
});
