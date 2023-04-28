"use strict";
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var _rite_1 = require("$rite");
var _plaited_1 = require("$plaited");
var _a = (0, _plaited_1.css)(templateObject_1 || (templateObject_1 = __makeTemplateObject([".row {\n  display: flex;\n  gap: 12px;\n  padding: 12px;\n}\n::slotted(button), .button {\n  height: 18px;\n  width: auto;\n}"], [".row {\n  display: flex;\n  gap: 12px;\n  padding: 12px;\n}\n::slotted(button), .button {\n  height: 18px;\n  width: auto;\n}"]))), classes = _a[0], stylesheet = _a[1];
var slot = 0;
var nested = 0;
var named = 0;
var SlotTest = (0, _plaited_1.isle)({ tag: 'slot-test' }, function (base) {
    return /** @class */ (function (_super) {
        __extends(class_1, _super);
        function class_1() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        class_1.prototype.plait = function (_a) {
            var feedback = _a.feedback;
            feedback({
                slot: function () {
                    slot++;
                },
                named: function () {
                    named++;
                },
                nested: function () {
                    nested++;
                },
            });
        };
        return class_1;
    }(base));
});
SlotTest();
var root = document.getElementById('root');
var SlotTestTemplate = function (_a) {
    var children = _a.children;
    return (<SlotTest.template {...stylesheet} slots={children}>
    <div class={classes.row}>
      <slot data-trigger={{ click: 'slot' }}></slot>
      <slot name='named' data-trigger={{ click: 'named' }}></slot>
      <template>
        <div data-target='target'>template target</div>
      </template>
      <nested-slot>
        <slot slot='nested' name='nested' data-trigger={{ click: 'nested' }}>
        </slot>
      </nested-slot>
    </div>
  </SlotTest.template>);
};
(0, _plaited_1.useSugar)(root).render(<SlotTestTemplate>
    <button>Slot</button>
    <button slot='named'>Named</button>
    <button slot='nested'>Nested</button>
  </SlotTestTemplate>, 'beforeend');
(0, _rite_1.test)('slot: default', function (t) { return __awaiter(void 0, void 0, void 0, function () {
    var button, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, t.findByText('Slot')];
            case 1:
                button = _b.sent();
                _a = button;
                if (!_a) return [3 /*break*/, 3];
                return [4 /*yield*/, t.fireEvent(button, 'click')];
            case 2:
                _a = (_b.sent());
                _b.label = 3;
            case 3:
                _a;
                t({
                    given: "default slot click of element in event's composed path",
                    should: 'not trigger feedback action',
                    actual: slot,
                    expected: 0,
                });
                return [2 /*return*/];
        }
    });
}); });
(0, _rite_1.test)('slot: named', function (t) { return __awaiter(void 0, void 0, void 0, function () {
    var button, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, t.findByText('Named')];
            case 1:
                button = _b.sent();
                _a = button;
                if (!_a) return [3 /*break*/, 3];
                return [4 /*yield*/, t.fireEvent(button, 'click')];
            case 2:
                _a = (_b.sent());
                _b.label = 3;
            case 3:
                _a;
                t({
                    given: "named slot click of element in event's composed path",
                    should: 'trigger feedback action',
                    actual: named,
                    expected: 1,
                });
                return [2 /*return*/];
        }
    });
}); });
(0, _rite_1.test)('slot: nested', function (t) { return __awaiter(void 0, void 0, void 0, function () {
    var button, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, t.findByText('Nested')];
            case 1:
                button = _b.sent();
                _a = button;
                if (!_a) return [3 /*break*/, 3];
                return [4 /*yield*/, t.fireEvent(button, 'click')];
            case 2:
                _a = (_b.sent());
                _b.label = 3;
            case 3:
                _a;
                t({
                    given: "nested slot click of element in event's composed path",
                    should: 'not trigger feedback action',
                    actual: nested,
                    expected: 0,
                });
                return [2 /*return*/];
        }
    });
}); });
var templateObject_1;
