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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.send = exports.connect = void 0;
var _plaited_1 = require("$plaited");
exports.connect = (_a = (0, _plaited_1.useMessenger)(), _a[0]), exports.send = _a[1];
var _rite_1 = require("$rite");
var _b = (0, _plaited_1.css)(templateObject_1 || (templateObject_1 = __makeTemplateObject([".row {\n  display: flex;\n  gap: 10px;\n  padding: 12px;\n}\n.button {\n  height: 18px;\n  width: auto;\n}"], [".row {\n  display: flex;\n  gap: 10px;\n  padding: 12px;\n}\n.button {\n  height: 18px;\n  width: auto;\n}"]))), classes = _b[0], stylesheet = _b[1];
(0, _rite_1.test)('dynamic island comms', function (t) { return __awaiter(void 0, void 0, void 0, function () {
    var wrapper, DynamicOne, DynamicTwo, button, header, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                wrapper = document.querySelector('#root');
                DynamicOne = (0, _plaited_1.isle)({
                    tag: 'dynamic-one',
                    id: true,
                    connect: exports.connect,
                }, function (base) {
                    return /** @class */ (function (_super) {
                        __extends(class_1, _super);
                        function class_1() {
                            return _super !== null && _super.apply(this, arguments) || this;
                        }
                        class_1.prototype.plait = function (_a) {
                            var feedback = _a.feedback, $ = _a.$;
                            feedback({
                                disable: function () {
                                    var button = $('button');
                                    button && (button.disabled = true);
                                },
                                click: function () {
                                    (0, exports.send)('dynamic-two', { type: 'add', detail: { value: ' World!' } });
                                },
                            });
                        };
                        return class_1;
                    }(base));
                });
                DynamicTwo = (0, _plaited_1.isle)({
                    tag: 'dynamic-two',
                    connect: exports.connect,
                }, function (base) {
                    return /** @class */ (function (_super) {
                        __extends(class_2, _super);
                        function class_2() {
                            return _super !== null && _super.apply(this, arguments) || this;
                        }
                        class_2.prototype.plait = function (_a) {
                            var $ = _a.$, feedback = _a.feedback, addThreads = _a.addThreads, thread = _a.thread, sync = _a.sync;
                            addThreads({
                                onAdd: thread(sync({ waitFor: { type: 'add' } }), sync({ request: { type: 'disable' } })),
                            });
                            feedback({
                                disable: function () {
                                    (0, exports.send)('one', { type: 'disable' });
                                },
                                add: function (detail) {
                                    var header = $('header');
                                    header === null || header === void 0 ? void 0 : header.insertAdjacentHTML('beforeend', "".concat(detail.value));
                                },
                            });
                        };
                        return class_2;
                    }(base));
                });
                DynamicOne();
                DynamicTwo();
                (0, _plaited_1.useSugar)(wrapper).render(<>
      <DynamicOne.template {...stylesheet} id='one'>
        <div class={classes.row}>
          <button data-target='button' class={classes.button} data-trigger={{ click: 'click' }}>
            Add "world!"
          </button>
        </div>
      </DynamicOne.template>
      <DynamicTwo.template {...stylesheet}>
        <h1 data-target='header'>Hello</h1>
      </DynamicTwo.template>
    </>, 'beforeend');
                return [4 /*yield*/, t.findByAttribute('data-target', 'button', wrapper)];
            case 1:
                button = _b.sent();
                return [4 /*yield*/, t.findByAttribute('data-target', 'header', wrapper)];
            case 2:
                header = _b.sent();
                t({
                    given: 'render',
                    should: 'header should contain string',
                    actual: header === null || header === void 0 ? void 0 : header.innerHTML,
                    expected: 'Hello',
                });
                _a = button;
                if (!_a) return [3 /*break*/, 4];
                return [4 /*yield*/, t.fireEvent(button, 'click')];
            case 3:
                _a = (_b.sent());
                _b.label = 4;
            case 4:
                _a;
                t({
                    given: 'clicking button',
                    should: 'append string to header',
                    actual: header === null || header === void 0 ? void 0 : header.innerHTML,
                    expected: 'Hello World!',
                });
                return [4 /*yield*/, t.findByAttribute('data-target', 'button', wrapper)];
            case 5:
                button = _b.sent();
                t({
                    given: 'clicking button',
                    should: 'be disabled',
                    actual: button === null || button === void 0 ? void 0 : button.disabled,
                    expected: true,
                });
                return [2 /*return*/];
        }
    });
}); });
var templateObject_1;
