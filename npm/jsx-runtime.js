// libs/utils/escape-unescape.ts
var reEscape = /[&<>'"]/g;
var escapeObj = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "'": "&#39;",
  '"': "&quot;"
};
var { replace } = "";
var cape = (key) => escapeObj[key];
var escape = (sub) => replace.call(
  sub,
  reEscape,
  cape
);

// libs/islandly/constants.ts
var dataTrigger = "data-trigger";
var voidTags = /* @__PURE__ */ new Set([
  "area",
  "base",
  "basefont",
  "bgsound",
  "br",
  "col",
  "command",
  "embed",
  "frame",
  "hr",
  "img",
  "isindex",
  "input",
  "keygen",
  "link",
  "menuitem",
  "meta",
  "nextid",
  "param",
  "source",
  "track",
  "wbr",
  "circle",
  "ellipse",
  "line",
  "path",
  "polygon",
  "polyline",
  "rect",
  "stop",
  "use"
]);
var booleanAttrs = /* @__PURE__ */ new Set([
  "allowfullscreen",
  "async",
  "autofocus",
  "autoplay",
  "checked",
  "controls",
  "default",
  "defer",
  "disabled",
  "formnovalidate",
  "inert",
  "ismap",
  "itemscope",
  "loop",
  "multiple",
  "muted",
  "nomodule",
  "novalidate",
  "open",
  "playsinline",
  "readonly",
  "required",
  "reversed",
  "selected"
]);
var primitives = /* @__PURE__ */ new Set([
  "null",
  "undefined",
  "number",
  "string",
  "boolean",
  "bigint"
]);

// libs/islandly/create-template.ts
var customElementRegex = /^[a-z]+\-[a-z]+(?:\-[a-z]+)*$/;
var joinParts = (tag, attrs = [], children) => `<${[tag, ...attrs].join(" ")}>${children.join("")}</${tag}>`;
var createTemplate = (tag, attrs) => {
  const {
    shadowrootmode = "open",
    children: _children,
    shadowrootdelegatesfocus = true,
    trusted,
    slots: _slots,
    stylesheet,
    style,
    key: _,
    "data-trigger": trigger,
    ...attributes
  } = attrs;
  if (typeof tag === "function") {
    return tag(attrs);
  }
  const stylesheets = /* @__PURE__ */ new Set();
  stylesheet && stylesheets.add(stylesheet);
  const children = _children && Array.isArray(_children) ? _children : _children ? [_children] : [];
  if (tag === "script" && !trusted) {
    throw new Error("Script tag not allowed unless 'trusted' property set");
  }
  const root = tag.toLowerCase();
  const rootAttrs = [];
  if (trigger) {
    const value = Object.entries(trigger).map(
      ([ev, req]) => `${ev}->${req}`
    ).join(" ");
    rootAttrs.push(`${dataTrigger}="${value}"`);
  }
  if (style) {
    const value = Object.entries(style).map(
      ([prop, val]) => `${prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}:${val};`
    ).join(" ");
    rootAttrs.push(`style="${escape(value)}"`);
  }
  for (const key in attributes) {
    if (key.startsWith("on")) {
      throw new Error(`Event handler attributes are not allowed:  [${key}]`);
    }
    const value = attributes[key];
    if (!primitives.has(typeof value)) {
      throw new Error(
        `Attributes not declared in BaseAttrs must be of type Primitive: ${key} is not primitive`
      );
    }
    if (booleanAttrs.has(key)) {
      rootAttrs.push(`${key}`);
      continue;
    }
    const formattedValue = value ?? "";
    rootAttrs.push(
      `${key}="${trusted ? `${formattedValue}` : escape(`${formattedValue}`)}"`
    );
  }
  if (voidTags.has(root)) {
    return {
      stylesheets,
      content: `<${[root, ...rootAttrs].join(" ")}/>`
    };
  }
  const rootChildren = [];
  const isCustomElement = customElementRegex.test(root);
  const templateAttrs = [];
  const templateChildren = [];
  if (isCustomElement) {
    templateAttrs.push(`shadowrootmode="${shadowrootmode}"`);
    templateAttrs.push(
      `shadowrootdelegatesfocus="${shadowrootdelegatesfocus}"`
    );
  }
  const length = children.length;
  for (let i = 0; i < length; i++) {
    const child = children[i];
    if (isCustomElement && typeof child === "object" && "content" in child) {
      templateChildren.push(child.content);
      for (const sheet of child.stylesheets) {
        stylesheets.add(sheet);
      }
      continue;
    }
    if (typeof child === "object" && "content" in child) {
      rootChildren.push(child.content);
      for (const sheet of child.stylesheets) {
        stylesheets.add(sheet);
      }
      continue;
    }
    if (!primitives.has(typeof child))
      continue;
    const formattedChild = child ?? "";
    if (isCustomElement) {
      templateChildren.push(
        trusted ? `${formattedChild}` : escape(`${formattedChild}`)
      );
      continue;
    }
    rootChildren.push(
      trusted ? `${formattedChild}` : escape(`${formattedChild}`)
    );
  }
  if (isCustomElement) {
    if (stylesheets.size) {
      templateChildren.unshift(
        joinParts(
          "style",
          void 0,
          [...stylesheets]
        )
      );
    }
    rootChildren.unshift(joinParts(
      "template",
      templateAttrs,
      templateChildren
    ));
    stylesheets.clear();
    const slots = !_slots ? [] : Array.isArray(_slots) ? _slots : [_slots];
    const length2 = slots.length;
    for (let i = 0; i < length2; i++) {
      const child = slots[i];
      if (typeof child === "object" && "content" in child) {
        rootChildren.push(child.content);
        for (const sheet of child.stylesheets) {
          stylesheets.add(sheet);
        }
        continue;
      }
      if (!primitives.has(typeof child))
        continue;
      const formattedChild = child ?? "";
      rootChildren.push(
        trusted ? `${formattedChild}` : escape(`${formattedChild}`)
      );
    }
  }
  return {
    stylesheets,
    content: joinParts(root, rootAttrs, rootChildren)
  };
};
function Fragment({ children }) {
  children = children && Array.isArray(children) ? children : children ? [children] : [];
  let content = "";
  const stylesheets = /* @__PURE__ */ new Set();
  const length = children.length;
  for (let i = 0; i < length; i++) {
    const child = children[i];
    if (typeof child === "string") {
      content += child;
      continue;
    }
    content += child.content;
    for (const sheet of child.stylesheets) {
      stylesheets.add(sheet);
    }
  }
  return {
    content,
    stylesheets
  };
}
export {
  Fragment,
  createTemplate as jsx,
  createTemplate as jsxDEV,
  createTemplate as jsxs
};
