"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var dev_deps_js_1 = require("../../dev-deps.js");
var mod_js_1 = require("../mod.js");
var Island = (0, mod_js_1.isle)({ tag: 'z-el' }, function (base) { return /** @class */ (function (_super) {
    __extends(class_1, _super);
    function class_1() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return class_1;
}(base)); });
Deno.test('Island.template: shadow only', function (t) {
    (0, dev_deps_js_1.assertSnapshot)(t, (0, mod_js_1.ssr)(<Island.template>
        <div>
          <h1>header</h1>
        </div>
      </Island.template>));
});
Deno.test('Island.template: shadow and id', function (t) {
    (0, dev_deps_js_1.assertSnapshot)(t, (0, mod_js_1.ssr)(<Island.template>
        <div id='random'>
          <h1>header</h1>
        </div>
      </Island.template>));
});
Deno.test('Island.template: shadow, and mode closed', function (t) {
    (0, dev_deps_js_1.assertSnapshot)(t, (0, mod_js_1.ssr)(<Island.template shadowrootmode='closed'>
        <div>
          <h1>header</h1>
        </div>
      </Island.template>));
});
Deno.test('Island.template: shadow, and slots', function (t) {
    var IslandTemplate = function (_a) {
        var children = _a.children;
        return (<Island.template slots={children}>
      <div>
        <h1>header</h1>
        <slot name='slot'></slot>
      </div>
    </Island.template>);
    };
    (0, dev_deps_js_1.assertSnapshot)(t, (0, mod_js_1.ssr)(<IslandTemplate>
        <div slot='slot'>slotted</div>
      </IslandTemplate>));
});
Deno.test('Island.template: styles string', function (t) {
    (0, dev_deps_js_1.assertSnapshot)(t, (0, mod_js_1.ssr)(<Island.template styles='.h1 { color: red}'>
        <div>
          <h1>header</h1>
        </div>
      </Island.template>));
});
