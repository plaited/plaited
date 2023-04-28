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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShadowIsland = exports.stylesheet = exports.classes = void 0;
var _plaited_1 = require("$plaited");
var _utils_1 = require("$utils");
var noun_braids_2633610_js_1 = require("./noun-braids-2633610.js");
exports.classes = (_a = (0, _plaited_1.css)(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n.zone {\n  border: 1px black dashed;\n  margin: 24px;\n  padding: 12px;\n  height: 300px;\n  display: flex;\n  flex-direction: column;\n  gap: 25px;\n  position: relative;\n}\n.svg {\n  width: 125px;\n  height: 125px;\n}\n.sub-island {\n  height: 100%;\n  width: 100%;\n  position: absolute;\n  top: 0;\n  left: 0;\n  margin: 0;\n  display: flex;\n  justify-content: center;\n  align-items: center;\n  background: #000000", ";\n  color: #ffffff", "\n}\n.row {\n  display: flex;\n  gap: 10px;\n  padding: 12px;\n}\n::slotted(button), .button {\n  height: 18px;\n  width: auto;\n}\n"], ["\n.zone {\n  border: 1px black dashed;\n  margin: 24px;\n  padding: 12px;\n  height: 300px;\n  display: flex;\n  flex-direction: column;\n  gap: 25px;\n  position: relative;\n}\n.svg {\n  width: 125px;\n  height: 125px;\n}\n.sub-island {\n  height: 100%;\n  width: 100%;\n  position: absolute;\n  top: 0;\n  left: 0;\n  margin: 0;\n  display: flex;\n  justify-content: center;\n  align-items: center;\n  background: #000000", ";\n  color: #ffffff", "\n}\n.row {\n  display: flex;\n  gap: 10px;\n  padding: 12px;\n}\n::slotted(button), .button {\n  height: 18px;\n  width: auto;\n}\n"])), (0, _utils_1.opacityHex)().get(0.75), (0, _utils_1.opacityHex)().get(0.80)), _a[0]), exports.stylesheet = _a[1];
exports.ShadowIsland = (0, _plaited_1.isle)({ tag: 'shadow-island' }, function (base) {
    return /** @class */ (function (_super) {
        __extends(class_1, _super);
        function class_1() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        class_1.prototype.plait = function (_a) {
            var _b;
            var feedback = _a.feedback, addThreads = _a.addThreads, sync = _a.sync, thread = _a.thread, context = _a.context, $ = _a.$, loop = _a.loop;
            addThreads({
                onRemoveSvg: thread(sync({ waitFor: { type: 'removeSvg' } }), sync({ request: { type: 'addSubIsland' } })),
                onStart: thread(sync({ waitFor: { type: 'start' } }), sync({ request: { type: 'addSlot' } })),
                onAddSvg: loop([
                    sync({ waitFor: { type: 'add-svg' } }),
                    sync({ request: { type: 'modifyAttributes' } }),
                ]),
            });
            var slotTarget = (0, _plaited_1.useSugar)(context);
            feedback((_b = {
                    addSubIsland: function () {
                        var zone = $('zone');
                        /** create a dynamic island */
                        var Sub = (0, _plaited_1.isle)({
                            tag: 'sub-island',
                        });
                        /** define the new dynamic island */
                        Sub();
                        /** render dynamic island to zone */
                        zone === null || zone === void 0 ? void 0 : zone.render(<Sub.template {...exports.stylesheet}>
                <h3 class={exports.classes['sub-island']}>sub island</h3>
              </Sub.template>, 'beforeend');
                    },
                    addButton: function () {
                        slotTarget.render(<button slot='button'>add svg</button>, 'beforeend');
                    },
                    modifyAttributes: function () {
                        var slot = $('add-svg-slot');
                        slot === null || slot === void 0 ? void 0 : slot.removeAttribute('data-trigger');
                    },
                    addSlot: function () {
                        var row = $('button-row');
                        row === null || row === void 0 ? void 0 : row.render(<slot name='button' data-target='add-svg-slot' data-trigger={{ click: 'add-svg' }}>
              </slot>, 'beforeend');
                    },
                    removeSvg: function () {
                        var svg = $('svg');
                        svg === null || svg === void 0 ? void 0 : svg.remove();
                    }
                },
                _b['add-svg'] = function () {
                    var zone = $('zone');
                    zone === null || zone === void 0 ? void 0 : zone.render(<noun_braids_2633610_js_1.SVG />, 'beforeend');
                },
                _b));
        };
        return class_1;
    }(base));
});
var templateObject_1;
