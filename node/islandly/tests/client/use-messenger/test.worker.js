"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var _plaited_1 = require("$plaited");
var _a = (0, _plaited_1.bProgram)(), trigger = _a.trigger, feedback = _a.feedback;
var send = (0, _plaited_1.useMain)(self, trigger)[0];
var calculator = {
    add: function (a, b) {
        return a + b;
    },
    subtract: function (a, b) {
        return a - b;
    },
    multiply: function (a, b) {
        return a * b;
    },
    divide: function (a, b) {
        return a / b;
    },
};
feedback({
    calculate: function (_a) {
        var a = _a.a, b = _a.b, operation = _a.operation;
        send('main', {
            type: 'update',
            detail: calculator[operation](a, b),
        });
    },
});
