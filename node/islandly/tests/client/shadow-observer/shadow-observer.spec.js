"use strict";
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
var shadow_island_js_1 = require("./shadow.island.js");
(0, shadow_island_js_1.ShadowIsland)();
(0, _rite_1.test)('shadow observer test', function (t) { return __awaiter(void 0, void 0, void 0, function () {
    var button, _a, row, _b, _c, _d, zone, svg, _e, _f, _g, h3;
    return __generator(this, function (_h) {
        switch (_h.label) {
            case 0: return [4 /*yield*/, t.findByAttribute('data-trigger', 'click->start')];
            case 1:
                button = _h.sent();
                _a = button;
                if (!_a) return [3 /*break*/, 3];
                return [4 /*yield*/, t.fireEvent(button, 'click')];
            case 2:
                _a = (_h.sent());
                _h.label = 3;
            case 3:
                _a;
                return [4 /*yield*/, t.findByAttribute('data-target', 'button-row')];
            case 4:
                row = _h.sent();
                t({
                    given: 'clicking start',
                    should: 'have add button in row',
                    actual: row === null || row === void 0 ? void 0 : row.childElementCount,
                    expected: 3,
                });
                _b = button;
                if (!_b) return [3 /*break*/, 6];
                return [4 /*yield*/, t.fireEvent(button, 'click')];
            case 5:
                _b = (_h.sent());
                _h.label = 6;
            case 6:
                _b;
                return [4 /*yield*/, t.findByAttribute('data-target', 'button-row')];
            case 7:
                row = _h.sent();
                t({
                    given: 'clicking start again',
                    should: 'not add another button to row',
                    actual: row === null || row === void 0 ? void 0 : row.children.length,
                    expected: 3,
                });
                return [4 /*yield*/, t.findByAttribute('data-trigger', 'click->addButton')];
            case 8:
                button = _h.sent();
                _c = button;
                if (!_c) return [3 /*break*/, 10];
                return [4 /*yield*/, t.fireEvent(button, 'click')];
            case 9:
                _c = (_h.sent());
                _h.label = 10;
            case 10:
                _c;
                return [4 /*yield*/, t.findByText('add svg')];
            case 11:
                button = _h.sent();
                t({
                    given: 'request to append `add svg` button',
                    should: 'new button should be in dom',
                    actual: button === null || button === void 0 ? void 0 : button.innerText,
                    expected: 'add svg',
                });
                _d = button;
                if (!_d) return [3 /*break*/, 13];
                return [4 /*yield*/, t.fireEvent(button, 'click')];
            case 12:
                _d = (_h.sent());
                _h.label = 13;
            case 13:
                _d;
                return [4 /*yield*/, t.findByAttribute('data-target', 'zone')];
            case 14:
                zone = _h.sent();
                t({
                    given: 'clicking add svg',
                    should: 'adds a svg to zone',
                    actual: zone === null || zone === void 0 ? void 0 : zone.children.length,
                    expected: 1,
                });
                return [4 /*yield*/, t.findByAttribute('data-target', 'svg')];
            case 15:
                svg = _h.sent();
                t({
                    given: 'add-svg event',
                    should: 'zone child is an svg',
                    actual: svg === null || svg === void 0 ? void 0 : svg.tagName,
                    expected: 'svg',
                });
                return [4 /*yield*/, t.findByText('add svg')];
            case 16:
                button = _h.sent();
                _e = button;
                if (!_e) return [3 /*break*/, 18];
                return [4 /*yield*/, t.fireEvent(button, 'click')];
            case 17:
                _e = (_h.sent());
                _h.label = 18;
            case 18:
                _e;
                return [4 /*yield*/, t.findByAttribute('data-target', 'zone')];
            case 19:
                zone = _h.sent();
                t({
                    given: 'clicking add svg again',
                    should: 'not add another svg to zone',
                    actual: zone === null || zone === void 0 ? void 0 : zone.children.length,
                    expected: 1,
                });
                _f = svg;
                if (!_f) return [3 /*break*/, 21];
                return [4 /*yield*/, t.fireEvent(svg, 'click')];
            case 20:
                _f = (_h.sent());
                _h.label = 21;
            case 21:
                _f;
                _g = button;
                if (!_g) return [3 /*break*/, 23];
                return [4 /*yield*/, t.fireEvent(button, 'click')];
            case 22:
                _g = (_h.sent());
                _h.label = 23;
            case 23:
                _g;
                return [4 /*yield*/, t.findByText('sub island')];
            case 24:
                h3 = _h.sent();
                t({
                    given: 'removeSvg event triggered',
                    should: 'still have children in zone appended in subsequent sync step',
                    actual: zone === null || zone === void 0 ? void 0 : zone.children.length,
                    expected: 1,
                });
                t({
                    given: 'append of sub-island with declarative shadowdom ',
                    should: "sub-island upgraded and thus it's content are queryable",
                    actual: h3 === null || h3 === void 0 ? void 0 : h3.tagName,
                    expected: 'H3',
                });
                return [2 /*return*/];
        }
    });
}); });
