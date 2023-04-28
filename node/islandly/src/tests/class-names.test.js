"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var dev_deps_js_1 = require("../../dev-deps.js");
var mod_js_1 = require("../mod.js");
Deno.test('classNames()', function () {
    (0, dev_deps_js_1.assertEquals)((0, mod_js_1.classNames)('class-1', 'class-2'), 'class-1 class-2');
});
Deno.test('classNames(): falsey', function () {
    var condtionTrue = true;
    var conditionFalse = false;
    var actual = (0, mod_js_1.classNames)('class-1', conditionFalse && 'class-2', condtionTrue && 'class-3');
    (0, dev_deps_js_1.assertEquals)(actual, 'class-1 class-3');
});
