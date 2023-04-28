"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var dev_deps_js_1 = require("../../dev-deps.js");
var mod_js_1 = require("../mod.js");
Deno.test('useStore()', function () {
    var _a = (0, mod_js_1.useStore)({ a: 1 }), store = _a[0], setStore = _a[1];
    setStore(function (prev) {
        if (typeof prev !== 'number')
            prev.b = 2;
        return prev;
    });
    (0, dev_deps_js_1.assertEquals)(store(), { a: 1, b: 2 });
    setStore(3);
    (0, dev_deps_js_1.assertEquals)(store(), 3);
});
Deno.test('useStore(): with subscription', function () {
    var _a = (0, mod_js_1.useStore)(2), store = _a[0], setStore = _a[1];
    var callback = (0, dev_deps_js_1.spy)();
    var disconnect = store.subscribe(callback);
    setStore(function (prev) { return prev + 1; });
    (0, dev_deps_js_1.assertEquals)(store(), 3);
    (0, dev_deps_js_1.assertSpyCall)(callback, 0, { args: [3] });
    disconnect();
    setStore(4);
    (0, dev_deps_js_1.assertEquals)(store(), 4);
    (0, dev_deps_js_1.assertSpyCalls)(callback, 1);
});
