"use strict";
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
Object.defineProperty(exports, "__esModule", { value: true });
var dev_deps_js_1 = require("../../../dev-deps.js");
var mod_js_1 = require("../mod.js");
// const ssr = (tpl: Template) => {
//   const style = tpl.stylesheets.size
//     ? `<style>${[...tpl.stylesheets].join('')}</style>`
//     : ''
//   return style + tpl.content
// }
Deno.test('createTemplate: self closing - html', function (t) {
    (0, dev_deps_js_1.assertSnapshot)(t, (0, mod_js_1.ssr)(<input type='text'></input>));
});
Deno.test('createTemplate: self closing - svg', function (t) {
    return (0, dev_deps_js_1.assertSnapshot)(t, (0, mod_js_1.ssr)(<polygon points='0,100 50,25 50,75 100,0'></polygon>));
});
Deno.test('createTemplate: falsey - undefined', function (t) {
    return (0, dev_deps_js_1.assertSnapshot)(t, (0, mod_js_1.ssr)(<div>{undefined}</div>));
});
Deno.test('createTemplate: falsey - null', function (t) {
    return (0, dev_deps_js_1.assertSnapshot)(t, (0, mod_js_1.ssr)(<div>{null}</div>));
});
Deno.test('createTemplate: falsey - false', function (t) {
    return (0, dev_deps_js_1.assertSnapshot)(t, (0, mod_js_1.ssr)(<div>{false}</div>));
});
Deno.test('createTemplate: falsey - ""', function (t) {
    return (0, dev_deps_js_1.assertSnapshot)(t, (0, mod_js_1.ssr)(<div>{''}</div>));
});
Deno.test('createTemplate: falsey - 0', function (t) {
    return (0, dev_deps_js_1.assertSnapshot)(t, (0, mod_js_1.ssr)(<div>{0}</div>));
});
Deno.test('createTemplate: falsey - NaN', function (t) {
    return (0, dev_deps_js_1.assertSnapshot)(t, (0, mod_js_1.ssr)(<div>{NaN}</div>));
});
Deno.test('createTemplate: conditional', function (t) {
    return (0, dev_deps_js_1.assertSnapshot)(t, (0, mod_js_1.ssr)(<div>{true && 'hello'}</div>));
});
Deno.test('createTemplate: style attribute', function (t) {
    return (0, dev_deps_js_1.assertSnapshot)(t, (0, mod_js_1.ssr)(<div style={{ backgroundColor: 'blue', margin: "12px" }}>styles</div>));
});
Deno.test('createTemplate: data-trigger attribute', function (t) {
    return (0, dev_deps_js_1.assertSnapshot)(t, (0, mod_js_1.ssr)(<div data-trigger={{
            click: 'random',
            focus: 'thing',
        }}>
        triggers
      </div>));
});
Deno.test('createTemplate: array of PlaitedElements', function (t) {
    return (0, dev_deps_js_1.assertSnapshot)(t, (0, mod_js_1.ssr)(<div>
        {Array.from(Array(10).keys()).map(function (n) { return <li>{"".concat(n)}</li>; })}
      </div>));
});
Deno.test('createTemplate: should throw with attribute starting with on', function () {
    (0, dev_deps_js_1.assertThrows)(function () {
        (0, mod_js_1.ssr)(<div>
        <template shadowrootmode='closed'>
          <img src='nonexistent.png' onerror="alert('xss!')"/>
        </template>
      </div>);
    });
});
Deno.test('createTemplate: should throw on script tag', function () {
    (0, dev_deps_js_1.assertThrows)(function () {
        (0, mod_js_1.ssr)(<script type='module' src='main.js'></script>);
    });
});
Deno.test('createTemplate: should not throw on script tag with trusted attribute', function (t) {
    (0, dev_deps_js_1.assertSnapshot)(t, (0, mod_js_1.ssr)(<script type='module' src='main.js' trusted></script>));
});
Deno.test('createTemplate: escapes children', function (t) {
    (0, dev_deps_js_1.assertSnapshot)(t, (0, mod_js_1.ssr)(<div>
        {"<script type=\"text/javascript\">\nconst hostRegex = /^https?://([^/]+)/.*$/i;\nconst host = document.URL.replace(hostRegex, '$1');\nconst socket = new WebSocket(/);\nconst reload = () =>{\n  location.reload();\n  console.log('...reloading');\n};\nsocket.addEventListener('message', reload);\nconsole.log('[plaited] listening for file changes');\n</script>"}
      </div>));
});
Deno.test('createTemplate: doest not escape children when trusted', function (t) {
    (0, dev_deps_js_1.assertSnapshot)(t, (0, mod_js_1.ssr)(<div trusted>
        {"<script type=\"text/javascript\">\nconst hostRegex = /^https?://([^/]+)/.*$/i;\nconst host = document.URL.replace(hostRegex, '$1');\nconst socket = new WebSocket(/);\nconst reload = () =>{\n  location.reload();\n  console.log('...reloading');\n};\nsocket.addEventListener('message', reload);\nconsole.log('[plaited] listening for file changes');\n</script>"}
      </div>));
});
Deno.test('createTemplate: Fragment of PlaitedElements', function (t) {
    return (0, dev_deps_js_1.assertSnapshot)(t, (0, mod_js_1.ssr)(<>
        {Array.from(Array(10).keys()).map(function (n) { return <li>{"".concat(n)}</li>; })}
      </>));
});
Deno.test('createTemplate: with slotted PlaitedElements', function (t) {
    var Cel = function (_a) {
        var children = _a.children;
        return (<c-el slots={children}>
      <slot name='slot'></slot>
    </c-el>);
    };
    (0, dev_deps_js_1.assertSnapshot)(t, (0, mod_js_1.ssr)(<Cel>
        {Array.from(Array(10).keys()).map(function (n) { return <li slot='slot'>slot-{n}</li>; })}
      </Cel>));
});
Deno.test('createTemplate: Fragment PlaitedElements', function (t) {
    return (0, dev_deps_js_1.assertSnapshot)(t, (0, mod_js_1.ssr)(<>
        {Array.from(Array(10).keys()).map(function (n) { return <li>item-{n}</li>; })}
      </>));
});
var span = (0, mod_js_1.css)(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n.nested-label {\n  font-weight: bold;\n}\n"], ["\n.nested-label {\n  font-weight: bold;\n}\n"])));
var NestedCustomElement = function (_a) {
    var children = _a.children, stylesheet = _a.stylesheet;
    return (<nested-component slots={children} stylesheet={stylesheet}>
    <span class={span[0]['nested-label']} {...span[1]}>
      inside nested template
    </span>
    <slot name='nested'></slot>
  </nested-component>);
};
Deno.test('createTemplate: custom element with child hoisting it\'s styles', function (t) {
    return (0, dev_deps_js_1.assertSnapshot)(t, (0, mod_js_1.ssr)(<NestedCustomElement />));
});
var nested = (0, mod_js_1.css)(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n  host: {\n    display: flex;\n    flex-direction: column;\n  }\n  "], ["\n  host: {\n    display: flex;\n    flex-direction: column;\n  }\n  "])));
Deno.test('createTemplate: custom element with child and host styles', function (t) {
    return (0, dev_deps_js_1.assertSnapshot)(t, (0, mod_js_1.ssr)(<NestedCustomElement {...nested[1]}/>));
});
var slotted = (0, mod_js_1.css)(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n.slotted-paragraph {\n  color: rebeccapurple;\n}\n"], ["\n.slotted-paragraph {\n  color: rebeccapurple;\n}\n"])));
Deno.test('createTemplate: custom element with styled slotted component', function (t) {
    return (0, dev_deps_js_1.assertSnapshot)(t, (0, mod_js_1.ssr)(<NestedCustomElement>
        <p slot='nested' class={slotted[0]['slotted-paragraph']} {...slotted[1]}>
          slotted paragraph
        </p>
      </NestedCustomElement>));
});
var TopCustomElement = function (_a) {
    var children = _a.children, stylesheet = _a.stylesheet;
    return (<top-component stylesheet={stylesheet} slots={children}>
    <NestedCustomElement>
      <p slot='nested' class={slotted[0]['slotted-paragraph']} {...slotted[1]}>
        slotted paragraph
      </p>
    </NestedCustomElement>
  </top-component>);
};
Deno.test('createTemplate: custom element with styles nested in custom element', function (t) {
    return (0, dev_deps_js_1.assertSnapshot)(t, (0, mod_js_1.ssr)(<TopCustomElement />));
});
var top = (0, mod_js_1.css)(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n:host {\n  display: block;\n}\n"], ["\n:host {\n  display: block;\n}\n"])));
Deno.test('createTemplate: custom element with styles nested in custom element with styles', function (t) {
    return (0, dev_deps_js_1.assertSnapshot)(t, (0, mod_js_1.ssr)(<TopCustomElement {...top[1]}/>));
});
var testEl = (0, mod_js_1.css)(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n  .image {\n    width: 100%;\n    aspect-ratio: 16 /9 ;\n  }\n"], ["\n  .image {\n    width: 100%;\n    aspect-ratio: 16 /9 ;\n  }\n"])));
Deno.test('createTemplate: custom element with nested custom element and styled slotted element', function (t) {
    return (0, dev_deps_js_1.assertSnapshot)(t, (0, mod_js_1.ssr)(<TopCustomElement {...top[1]}>
        <img class={testEl[0].image} {...testEl[1]}/>
      </TopCustomElement>));
});
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5;
