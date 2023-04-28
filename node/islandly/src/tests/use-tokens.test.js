"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
var dev_deps_js_1 = require("../../dev-deps.js");
var mod_js_1 = require("../mod.js");
Deno.test('tokens()', function () {
    var expected = {
        '--width': 32,
        '--height': 24,
        '--backgroundColor': 'black',
    };
    var _a = (0, mod_js_1.useTokens)({
        width: 32,
        height: 24,
        backgroundColor: 'black',
    }), get = _a[0], set = _a[1];
    (0, dev_deps_js_1.assertEquals)(get(), expected);
    set({
        width: 32,
        height: 45,
        backgroundColor: 'black',
    });
    (0, dev_deps_js_1.assertEquals)(get(), __assign(__assign({}, expected), { '--height': 45 }));
});
Deno.test('tokens() conditional test', function () {
    var checked = false;
    var disabled = true;
    var expected = {
        '--width': 32,
        '--height': 24,
        '--backgroundColor': 'grey',
    };
    var get = (0, mod_js_1.useTokens)({
        width: 32,
        height: 24,
        backgroundColor: 'black',
    }, checked && {
        backgroundColor: 'blue',
    }, disabled && {
        backgroundColor: 'grey',
    })[0];
    (0, dev_deps_js_1.assertEquals)(get(), expected);
});
