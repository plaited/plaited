"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShadowTemplate = void 0;
var shadow_island_js_1 = require("./shadow.island.js");
var ShadowTemplate = function () { return (<shadow_island_js_1.ShadowIsland.template {...shadow_island_js_1.stylesheet}>
    <div class={shadow_island_js_1.classes.mount} data-target='wrapper'>
      <div class={shadow_island_js_1.classes.zone} data-target='zone'>
      </div>
      <div class={shadow_island_js_1.classes.row} data-target='button-row'>
        <button data-trigger={{ click: 'start' }} class={shadow_island_js_1.classes.button}>
          start
        </button>
        <button data-trigger={{ click: 'addButton' }} class={shadow_island_js_1.classes.button}>
          addButton
        </button>
      </div>
    </div>
  </shadow_island_js_1.ShadowIsland.template>); };
exports.ShadowTemplate = ShadowTemplate;
