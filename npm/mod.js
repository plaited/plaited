// libs/behavioral/constants.ts
var streamEvents = {
  select: "select-event",
  snapshot: "state-snapshot"
};
var strategies = {
  randomized: "randomized",
  priority: "priority",
  chaos: "chaos",
  custom: "custom"
};

// libs/behavioral/state-snapshot.ts
var stateSnapshot = ({ bids, selectedEvent }) => {
  const ruleSets = [];
  for (const bid of bids) {
    const { generator: _, waitFor, block, request, thread: thread2, priority, trigger } = bid;
    const obj = {
      thread: thread2,
      priority
    };
    let selected;
    waitFor && Object.assign(obj, {
      waitFor: Array.isArray(waitFor) ? waitFor : [waitFor]
    });
    block && Object.assign(obj, {
      block: Array.isArray(block) ? block : [block]
    });
    if (request) {
      const arr = Array.isArray(request) ? request : [request];
      arr.some(
        ({ type }) => type === selectedEvent.type && priority === selectedEvent.priority
      ) && (selected = selectedEvent.type);
      Object.assign(obj, {
        request: arr
      });
    }
    ruleSets.push({
      ...obj,
      ...trigger && { trigger },
      ...selected && { selected }
    });
  }
  return ruleSets.sort((a, b) => a.priority - b.priority);
};

// libs/behavioral/publisher.ts
var publisher = () => {
  const listeners = [];
  function publication(value) {
    for (const i in listeners) {
      listeners[i](value);
    }
  }
  publication.subscribe = (listener) => {
    listeners.push((value) => {
      value !== void 0 && listener(value);
    });
  };
  return publication;
};

// libs/behavioral/selection-strategies.ts
var randomizedStrategy = (filteredEvents) => {
  for (let i = filteredEvents.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [filteredEvents[i], filteredEvents[j]] = [
      filteredEvents[j],
      filteredEvents[i]
    ];
  }
  return filteredEvents.sort(
    ({ priority: priorityA }, { priority: priorityB }) => priorityA - priorityB
  )[0];
};
var chaosStrategy = (filteredEvents) => filteredEvents[Math.floor(Math.random() * Math.floor(filteredEvents.length))];
var priorityStrategy = (filteredEvents) => filteredEvents.sort(
  ({ priority: priorityA }, { priority: priorityB }) => priorityA - priorityB
)[0];
var selectionStrategies = {
  [strategies.priority]: priorityStrategy,
  [strategies.chaos]: chaosStrategy,
  [strategies.randomized]: randomizedStrategy
};

// libs/behavioral/rules.ts
var thread = (...rules) => function* () {
  for (const rule of rules) {
    yield* rule();
  }
};
var loop = (rules, condition = () => true) => function* () {
  while (condition()) {
    for (const rule of rules) {
      yield* rule();
    }
  }
};
var sync = (set) => function* () {
  yield set;
};

// libs/behavioral/b-program.ts
var requestInParameter = ({ type: requestEventName, detail: requestDetail = {} }) => {
  return ({
    type: parameterEventName,
    cb: parameterAssertion
  }) => parameterAssertion ? parameterAssertion({
    detail: requestDetail,
    type: requestEventName
  }) : requestEventName === parameterEventName;
};
var bProgram = ({
  /** event selection strategy {@link Strategy}*/
  strategy = strategies.priority,
  /** When set to true returns a stream with log of state snapshots, last selected event and trigger */
  dev
} = {}) => {
  const eventSelectionStrategy = typeof strategy === "string" ? selectionStrategies[strategy] : strategy;
  const pending = /* @__PURE__ */ new Set();
  const running = /* @__PURE__ */ new Set();
  const pub = publisher();
  function run() {
    running.size && step();
  }
  function step() {
    for (const bid of running) {
      const { generator, priority, thread: thread2, trigger: trigger2 } = bid;
      const { value, done } = generator.next();
      !done && pending.add({
        thread: thread2,
        priority,
        ...trigger2 && { trigger: trigger2 },
        generator,
        ...value
      });
      running.delete(bid);
    }
    selectNextEvent();
  }
  function selectNextEvent() {
    const bids = [...pending];
    let candidates = [];
    for (const { request, priority } of bids) {
      if (Array.isArray(request)) {
        candidates = candidates.concat(request.map(
          (event) => ({ priority, ...event })
          // create candidates for each request with current bids priority
        ));
        continue;
      }
      if (request) {
        candidates.push({ priority, ...request });
      }
    }
    const blocked = bids.flatMap(({ block }) => block || []);
    const filteredBids = candidates.filter(
      (request) => !blocked.some(requestInParameter(request))
    );
    const selectedEvent = eventSelectionStrategy(filteredBids);
    if (selectedEvent) {
      dev && pub({
        kind: streamEvents.snapshot,
        data: stateSnapshot({ bids, selectedEvent })
      });
      nextStep(selectedEvent);
    }
  }
  function nextStep(selectedEvent) {
    for (const bid of pending) {
      const { request = [], waitFor = [], generator } = bid;
      const waitList = [
        ...Array.isArray(request) ? request : [request],
        ...Array.isArray(waitFor) ? waitFor : [waitFor]
      ];
      if (waitList.some(requestInParameter(selectedEvent)) && generator) {
        running.add(bid);
        pending.delete(bid);
      }
    }
    const { priority: _p, cb: _cb, ...detail } = selectedEvent;
    pub({
      kind: streamEvents.select,
      data: detail
    });
    run();
  }
  const trigger = ({
    type,
    detail
  }) => {
    const thread2 = function* () {
      yield {
        request: [{ type, detail }],
        waitFor: [{ type: "", cb: () => true }]
      };
    };
    running.add({
      thread: type,
      priority: 0,
      trigger: true,
      generator: thread2()
    });
    run();
  };
  const feedback = (actions) => {
    pub.subscribe(
      ({ kind, data }) => {
        if (kind === streamEvents.select) {
          const { type: key, detail = {} } = data;
          Object.hasOwn(actions, key) && actions[key](detail);
        }
      }
    );
  };
  const addThreads = (threads) => {
    for (const thread2 in threads) {
      running.add({
        thread: thread2,
        priority: running.size + 1,
        generator: threads[thread2]()
      });
    }
  };
  if (dev) {
    pub.subscribe(
      ({ kind, data }) => {
        if (kind === streamEvents.snapshot) {
          dev(data);
        }
      }
    );
  }
  return Object.freeze({
    /** add thread function to behavioral program */
    addThreads,
    /** connect action function to behavioral program */
    feedback,
    /** trigger a run and event on behavioral program */
    trigger,
    /**
     * A behavioral thread that loops infinitely or until some callback condition is false
     * like a mode change open -> close. This function returns a threads
     */
    loop,
    /**
     * At synchronization points, each behavioral thread specifies three sets of events:
     * requested events: the threads proposes that these be considered for triggering,
     * and asks to be notified when any of them occurs; waitFor events: the threads does not request these, but
     * asks to be notified when any of them is triggered; and blocked events: the
     * threads currently forbids triggering
     * any of these events.
     */
    sync,
    /**
     * creates a behavioral thread from synchronization sets and/or other  behavioral threads
     */
    thread
  });
};

// libs/islandly/class-names.ts
var classNames = (...classes) => classes.filter(Boolean).join(" ");

// libs/utils/true-type-of.ts
var trueTypeOf = (obj) => Object.prototype.toString.call(obj).slice(8, -1).toLowerCase();

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
var escape2 = (sub) => replace.call(
  sub,
  reEscape,
  (key) => escapeObj[key]
);

// libs/utils/hash.ts
var hashString = (str) => {
  const hash = [...str].reduce(
    (acc, cur) => (acc << 5) + acc + cur.charCodeAt(0),
    5381
  );
  return hash === 5381 ? null : hash;
};

// libs/islandly/constants.ts
var dataTarget = "data-target";
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
    rootAttrs.push(`style="${escape2(value)}"`);
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
      `${key}="${trusted ? `${formattedValue}` : escape2(`${formattedValue}`)}"`
    );
  }
  if (typeof root === "string" && voidTags.has(root)) {
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
    if (stylesheet) {
      templateChildren.push(
        joinParts(
          "style",
          void 0,
          [stylesheet]
        )
      );
    }
    templateAttrs.push(
      `shadowrootdelegatesfocus="${shadowrootdelegatesfocus}"`
    );
    const slots = !_slots ? [] : Array.isArray(_slots) ? _slots : [_slots];
    const length2 = slots.length;
    for (let i = 0; i < length2; i++) {
      const child = slots[i];
      if (typeof child === "object" && "content" in child) {
        rootChildren.push(child.content);
        continue;
      }
      if (!primitives.has(typeof child))
        continue;
      const formattedChild = child ?? "";
      rootChildren.push(
        trusted ? `${formattedChild}` : escape2(`${formattedChild}`)
      );
    }
  }
  const length = children.length;
  for (let i = 0; i < length; i++) {
    const child = children[i];
    if (isCustomElement && typeof child === "object" && "content" in child) {
      templateChildren.push(child.content);
      continue;
    }
    if (typeof child === "object" && "content" in child) {
      rootChildren.push(child.content);
      continue;
    }
    if (!primitives.has(typeof child))
      continue;
    const formattedChild = child ?? "";
    if (isCustomElement) {
      templateChildren.push(
        trusted ? `${formattedChild}` : escape2(`${formattedChild}`)
      );
      continue;
    }
    rootChildren.push(
      trusted ? `${formattedChild}` : escape2(`${formattedChild}`)
    );
  }
  isCustomElement && rootChildren.unshift(joinParts(
    "template",
    templateAttrs,
    templateChildren
  ));
  return {
    stylesheets,
    content: joinParts(root, rootAttrs, rootChildren)
  };
};
function Fragment({ children }) {
  children = children && Array.isArray(children) ? children : children ? [children] : [];
  return {
    content: children.map(
      (child) => typeof child === "string" ? child : child.content
    ).join("")
  };
}

// libs/islandly/css.ts
var reduceWhitespace = (str) => str.replace(/(\s\s+|\n)/g, " ");
var isTruthy = (val) => trueTypeOf(val) === "string" || trueTypeOf(val) === "number";
var taggedWithPrimitives = (strings, ...expressions) => {
  const { raw } = strings;
  let result = expressions.reduce((acc, subst, i) => {
    acc += reduceWhitespace(raw[i]);
    let filteredSubst = Array.isArray(subst) ? subst.filter(isTruthy).join("") : isTruthy(subst) ? subst : "";
    if (acc.endsWith("$")) {
      filteredSubst = escape(filteredSubst);
      acc = acc.slice(0, -1);
    }
    return acc + filteredSubst;
  }, "");
  return result += reduceWhitespace(raw[raw.length - 1]);
};
var tokenize = (css2) => {
  const regex = /\.(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/gm;
  const matches = [];
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(css2)) !== null) {
    if (match.index > lastIndex) {
      matches.push(css2.substring(lastIndex, match.index));
    }
    matches.push({ content: match[1] });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < css2.length) {
    matches.push(css2.substring(lastIndex));
  }
  return matches;
};
var css = (strings, ...expressions) => {
  const result = taggedWithPrimitives(strings, ...expressions);
  const suffix = btoa(`${hashString(result)}`).replace(/[+/=]/g, "");
  const tokens = tokenize(result);
  const classes = /* @__PURE__ */ new Map();
  const addClass = (key) => {
    const value = `${key}_${suffix.slice(0, 6)}`;
    const toRet = `.${value}`;
    if (classes.has(key))
      return toRet;
    classes.set(key, value);
    return toRet;
  };
  const styles = tokens?.map(
    (token) => typeof token === "string" ? reduceWhitespace(token) : addClass(token.content)
  ).join("") || "";
  return {
    classes: Object.fromEntries(classes),
    styles: reduceWhitespace(styles).trim()
  };
};

// libs/islandly/create-idb.ts
var createIDB = (dbName, storeName) => {
  const dbp = new Promise((resolve, reject) => {
    const openreq = indexedDB.open(dbName);
    openreq.onerror = () => reject(openreq.error);
    openreq.onsuccess = () => resolve(openreq.result);
    openreq.onupgradeneeded = () => {
      !openreq.result.objectStoreNames.contains(storeName) && openreq.result.createObjectStore(storeName);
    };
  });
  return (type, callback) => dbp.then(
    (db) => new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, type);
      transaction.oncomplete = () => resolve();
      transaction.onabort = transaction.onerror = () => reject(transaction.error);
      callback(transaction.objectStore(storeName));
    })
  );
};

// libs/islandly/use-behavioral.ts
var useBehavioral = ({
  id,
  connect,
  dev,
  strategy,
  context
}) => {
  const { trigger, ...rest } = bProgram({
    strategy,
    dev
  });
  let disconnect;
  if (connect) {
    const tagName = context.tagName.toLowerCase();
    const _id = context.id;
    if (id && !_id) {
      console.error(
        `island ${tagName} is missing an id attribute and cannot communicate with messenger`
      );
    }
    disconnect = id && _id ? connect(_id, trigger) : connect(tagName, trigger);
    trigger({
      type: `connected->${id ? _id ?? `${tagName} with missing id` : tagName}`
    });
  }
  return { trigger, disconnect, ...rest };
};

// libs/islandly/delegated-listener.ts
var DelegatedListener = class {
  constructor(callback) {
    this.callback = callback;
  }
  handleEvent(evt) {
    this.callback(evt);
  }
};
var delegates = /* @__PURE__ */ new WeakMap();
var delegatedListener = Object.freeze({
  set: (context, callback) => {
    delegates.set(context, new DelegatedListener(callback));
  },
  get: (context) => delegates.get(context),
  has: (context) => delegates.has(context)
});

// libs/islandly/sugar.ts
var sugar = {
  render(tpl, position) {
    const element = this;
    const template = document.createElement("template");
    template.innerHTML = tpl.content;
    if (position) {
      element.insertAdjacentElement(position, template);
      template.replaceWith(template.content.cloneNode(true));
      return element;
    }
    element.replaceChildren(template.content.cloneNode(true));
    return element;
  },
  replace(tpl) {
    const element = this;
    const template = document.createElement("template");
    template.innerHTML = tpl.content;
    console.log({ element, clone: template.content.cloneNode(true).childNodes });
    element.replaceWith(...template.content.cloneNode(true).childNodes);
  },
  attr(attr, val) {
    const element = this;
    if (val === void 0)
      return element.getAttribute(attr);
    val == null ? element.removeAttribute(attr) : element.setAttribute(attr, val);
    return element;
  }
};
var sugarForEach = {
  render(template, position) {
    const elements = this;
    elements.forEach(($el) => $el.render(template, position));
    return elements;
  },
  replace(template) {
    const elements = this;
    elements.forEach(($el) => $el.replace(template));
    return elements;
  },
  attr(attrs, val) {
    const elements = this;
    if (typeof attrs === "string") {
      elements.forEach(($el) => $el.attr(attrs, val));
    } else {
      elements.forEach(
        ($el) => Object.entries(attrs).forEach(([key, val2]) => $el.attr(key, val2))
      );
    }
    return elements;
  }
};
var render = (element, tpl, position) => {
  const template = document.createElement("template");
  template.innerHTML = tpl.content;
  if (position) {
    element.insertAdjacentElement(position, template);
    template.replaceWith(template.content.cloneNode(true));
    return element;
  }
  element.replaceChildren(template.content.cloneNode(true));
  return element;
};

// libs/islandly/isle.ts
var matchAllEvents = (str) => {
  const regexp = /(^\w+|(?:\s)\w+)(?:->)/g;
  return [...str.matchAll(regexp)].flatMap(([, event]) => event);
};
var getTriggerKey = (e, context) => {
  const el = e.currentTarget === context ? context : e.composedPath().find(
    (slot) => slot?.tagName === "SLOT" && slot === context
  ) ? context : void 0;
  if (!el)
    return "";
  const pre = `${e.type}->`;
  const trigger = el.dataset.trigger ?? "";
  const key = trigger.trim().split(/\s+/).find(
    (str) => str.includes(pre)
  );
  return key ? key.replace(pre, "") : "";
};
var canUseSlot = (node) => !node.hasAttribute("slot") && node.hasAttribute("name");
var isle = ({
  mode = "open",
  delegatesFocus = true,
  tag,
  ...bProgramOptions
}, mixin = (base) => class extends base {
}) => {
  const define = () => {
    if (customElements.get(tag)) {
      console.error(`${tag} already defined`);
      return;
    }
    customElements.define(
      tag,
      mixin(
        class extends HTMLElement {
          constructor() {
            super();
            this.internals_ = this.attachInternals();
            !this.internals_.shadowRoot && this.attachShadow({ mode, delegatesFocus });
            Object.assign(this, sugar);
          }
          #shadowObserver;
          #templateObserver;
          #disconnect;
          connectedCallback() {
            if (!this.internals_.shadowRoot?.firstChild) {
              const template = this.querySelector(
                "template[shadowrootmode]"
              );
              template ? this.#appendTemplate(template) : this.#templateObserver = this.#createTemplateObserver();
            }
            if (this.plait) {
              this.internals_.shadowRoot && this.#delegateListeners(
                // just connected/upgraded then delegate listeners nodes with data-trigger attribute
                this.internals_.shadowRoot.querySelectorAll(
                  `[${dataTrigger}]`
                )
              );
              const { disconnect, trigger, ...rest } = useBehavioral(
                {
                  context: this,
                  ...bProgramOptions
                }
              );
              this.plait({
                $: this.$.bind(this),
                context: this,
                trigger,
                ...rest
              });
              this.#shadowObserver = this.#createShadowObserver();
              this.#disconnect = disconnect;
              this.trigger = trigger;
            }
          }
          disconnectedCallback() {
            this.#templateObserver && this.#templateObserver.disconnect();
            this.#shadowObserver && this.#shadowObserver.disconnect();
            if (this.#disconnect) {
              this.trigger({
                type: `disconnected->${this.id || this.tagName.toLowerCase()}`
              });
              this.#disconnect();
            }
          }
          #delegateListeners(nodes) {
            nodes.forEach((el) => {
              if (el.nodeType === 1) {
                if (el.tagName === "SLOT" && // Element is an instance of a slot
                !canUseSlot(el))
                  return;
                !delegatedListener.has(el) && delegatedListener.set(el, (event) => {
                  const triggerKey = getTriggerKey(
                    event,
                    el
                  );
                  triggerKey ? this.trigger({
                    type: triggerKey,
                    detail: event
                  }) : el.removeEventListener(
                    event.type,
                    delegatedListener.get(el)
                  );
                });
                const triggers = el.dataset.trigger;
                if (triggers) {
                  const events = matchAllEvents(triggers);
                  for (const event of events) {
                    el.addEventListener(event, delegatedListener.get(el));
                  }
                }
              }
            });
          }
          // Observes the addition of nodes to the shadow dom and changes to and child's data-trigger attribute
          #createShadowObserver() {
            const mo = new MutationObserver((mutationsList) => {
              for (const mutation of mutationsList) {
                if (mutation.addedNodes.length) {
                  this.#delegateListeners(mutation.addedNodes);
                }
                if (mutation.type === "attributes") {
                  this.internals_.shadowRoot && this.#delegateListeners(
                    this.internals_.shadowRoot.querySelectorAll(
                      `[${dataTrigger}]`
                    )
                  );
                }
              }
            });
            this.internals_.shadowRoot && mo.observe(this.internals_.shadowRoot, {
              attributeFilter: [dataTrigger],
              childList: true,
              subtree: true
            });
            return mo;
          }
          #appendTemplate(template) {
            if (this.internals_.shadowRoot) {
              !this.internals_.shadowRoot.firstChild && this.internals_.shadowRoot.appendChild(
                document.importNode(template.content, true)
              );
              template.remove();
            }
          }
          #createTemplateObserver() {
            const mo = new MutationObserver(() => {
              const template = this.querySelector(
                "template[shadowrootmode]"
              );
              if (template) {
                mo.disconnect();
                this.#appendTemplate(template);
              }
            });
            mo.observe(this, { childList: true });
            return mo;
          }
          $(target) {
            const elements = [];
            if (this.internals_.shadowRoot) {
              this.internals_.shadowRoot.querySelectorAll(
                `[${dataTarget}="${target}"]`
              ).forEach((el) => {
                if (el.tagName === "SLOT") {
                  if (canUseSlot(el)) {
                    Object.assign(el, sugar);
                    elements.push(el);
                  }
                  return;
                }
                Object.assign(el, sugar);
                elements.push(el);
              });
            }
            Object.assign(elements, sugarForEach);
            return elements;
          }
        }
      )
    );
  };
  define["template"] = (props) => createTemplate(tag, props);
  return define;
};

// libs/islandly/memo.ts
var shallowCompare = (obj1, obj2) => Object.keys(obj1).length === Object.keys(obj2).length && Object.keys(obj1).every(
  (key) => Object.hasOwn(obj2, key) && obj1[key] === obj2[key]
);
var memo = (resultFn) => {
  let cache = null;
  function tpl(props) {
    if (cache && cache.lastThis === this && shallowCompare(props, cache.lastProps)) {
      return cache.lastResult;
    }
    const lastResult = resultFn.call(this, props);
    cache = {
      lastResult,
      lastProps: props,
      lastThis: this
    };
    return lastResult;
  }
  return tpl;
};

// libs/islandly/messenger.ts
var messenger = () => {
  const emitter = new EventTarget();
  const connect = (recipient, trigger) => {
    const eventHandler = (event) => trigger(event.detail);
    emitter.addEventListener(
      recipient,
      eventHandler
    );
    return () => emitter.removeEventListener(
      recipient,
      eventHandler
    );
  };
  const send = (recipient, detail) => {
    const event = new CustomEvent(recipient, { detail });
    emitter.dispatchEvent(event);
  };
  return Object.freeze({ connect, send });
};

// libs/islandly/ssr.ts
var ssr = (...templates) => {
  return "<!DOCTYPE html> " + templates.map((tpl) => tpl.content).join("");
};

// libs/islandly/use-css-var.ts
var useCSSVar = (variable) => {
  const name = variable.startsWith("var(") ? variable.substring(4, variable.length - 5) : variable;
  const get = () => getComputedStyle(document.documentElement).getPropertyValue(name);
  const set = (value, rem = true) => {
    let val;
    if (typeof value === "number" && rem) {
      const baseFontSize = parseInt(
        getComputedStyle(document.documentElement).fontSize
      );
      val = `${value / baseFontSize}rem`;
    }
    document.documentElement.style.setProperty(name, val || value.toString());
  };
  return Object.freeze([
    get,
    set
  ]);
};

// libs/islandly/use-indexed-db.ts
var useIndexedDB = async (key, initialValue, idb) => {
  const db = idb || createIDB("USE_INDEXED_DB", "STORE");
  await function setInitialValue() {
    return db("readwrite", (store) => {
      store.put(initialValue, key);
    });
  }();
  const updateStore = (newValue) => db("readwrite", (store) => {
    const req = store.openCursor(key);
    req.onsuccess = function getAndPutOnSuccess() {
      const cursor = this.result;
      if (cursor) {
        const { value } = cursor;
        cursor.update(newValue(value));
        return;
      } else {
        console.error(`cursor's value missing`);
      }
    };
  });
  const overwriteStore = (newValue) => db("readwrite", (store) => store.put(newValue, key));
  const set = (newValue) => trueTypeOf(newValue) === "function" ? updateStore(newValue) : overwriteStore(newValue);
  const get = () => {
    let req;
    return db("readonly", (store) => {
      req = store.get(key);
    }).then(() => req.result);
  };
  return Object.freeze([get, set]);
};

// libs/islandly/use-main.ts
var useMain = ({
  /** is self of the worker */
  context,
  /** is a trigger callback from a behavioral program */
  trigger
}) => {
  const eventHandler = ({ data }) => {
    trigger(data);
  };
  const send = (recipient, detail) => {
    context.postMessage({
      recipient,
      detail
    });
  };
  context.addEventListener("message", eventHandler, false);
  const disconnect = () => context.removeEventListener("message", eventHandler);
  return Object.freeze({ send, disconnect });
};

// libs/islandly/use-store.ts
var useStore = (initialStore) => {
  let store = initialStore;
  const get = () => store;
  const set = (newStore) => {
    store = trueTypeOf(newStore) === "function" ? newStore(structuredClone(store)) : newStore;
  };
  return Object.freeze([
    get,
    set
  ]);
};

// libs/islandly/use-tokens.ts
var useTokens = (...obj) => {
  let tokenSet = {};
  const set = (...tokenSets) => {
    const nextSet = {};
    const filtered = tokenSets.filter(Boolean);
    Object.assign(nextSet, ...filtered);
    for (const key in nextSet) {
      nextSet[`--${key}`] = nextSet[key];
      delete nextSet[key];
    }
    tokenSet = nextSet;
  };
  set(...obj);
  const get = () => tokenSet;
  return Object.freeze([
    get,
    set
  ]);
};

// libs/islandly/use-web-worker.ts
var useWebWorker = ({
  /** identifier for our worker */
  id,
  /** the server public directory relative url  */
  url,
  /** messenger connect callback to connect your instantiate worker */
  connect,
  /** messenger send callback so that messages received from the worker can be sent to the main thread */
  send
}) => {
  const worker = new Worker(new URL(url, import.meta.url).href, {
    type: "module"
  });
  const trigger = (args) => {
    worker.postMessage(args);
  };
  const disconnect = connect(id, trigger);
  const eventHandler = ({ data }) => {
    const { recipient, detail } = data;
    send(recipient, detail);
  };
  worker.addEventListener("message", eventHandler, false);
  return () => {
    disconnect();
    worker.removeEventListener("message", eventHandler);
  };
};
export {
  Fragment,
  bProgram,
  canUseSlot,
  classNames,
  createIDB,
  createTemplate,
  css,
  getTriggerKey,
  createTemplate as h,
  isle,
  loop,
  matchAllEvents,
  memo,
  messenger,
  reduceWhitespace,
  render,
  ssr,
  sync,
  thread,
  useCSSVar,
  useIndexedDB,
  useMain,
  useStore,
  useTokens,
  useWebWorker
};
