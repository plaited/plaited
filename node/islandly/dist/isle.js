import { dataTarget, dataTrigger } from './constants.js';
import { useBehavioral } from './use-behavioral.js';
import { delegatedListener } from './delegated-listener.js';
import { createTemplate } from './create-template.js';
import { sugar, sugarForEach } from './use-sugar.js';
// It takes the value of a data-target attribute and return all the events happening in it. minus the method identifier
// so iof the event was data-target="click->doSomething" it would return ["click"]
export const matchAllEvents = (str) => {
    const regexp = /(^\w+|(?:\s)\w+)(?:->)/g;
    return [...str.matchAll(regexp)].flatMap(([, event]) => event);
};
// returns the request/action name to connect our event binding to data-target="click->doSomething" it would return "doSomething"
// note triggers are separated by spaces in the attribute data-target="click->doSomething focus->somethingElse"
export const getTriggerKey = (e, context) => {
    const el = e.currentTarget === context
        ? context
        // check if closest slot from the element that invoked the event is the instances slot
        : e.composedPath().find(slot => (slot?.tagName === 'SLOT') && slot ===
            context)
            ? context
            : undefined;
    if (!el)
        return '';
    const pre = `${e.type}->`;
    const trigger = el.dataset.trigger ?? '';
    const key = trigger.trim().split(/\s+/).find((str) => str.includes(pre));
    return key ? key.replace(pre, '') : '';
};
// We only support binding and querying named slots that are not also nested slots
export const canUseSlot = (node) => !node.hasAttribute('slot') && node.hasAttribute('name');
const traverseNodes = (node, arr) => {
    if (node.nodeType === 1) {
        if (node.hasAttribute('data-trigger')) {
            arr.push(node);
        }
        if (node.hasChildNodes()) {
            const childNodes = node.childNodes;
            const length = childNodes.length;
            for (let i = 0; i < length; i++) {
                traverseNodes(childNodes[i], arr);
            }
        }
    }
};
/**
 * A typescript function for instantiating Plaited Island Elements
 */
export const isle = ({ mode = 'open', delegatesFocus = true, tag, ...bProgramOptions }, mixin = base => class extends base {
}) => {
    const define = () => {
        if (customElements.get(tag)) {
            console.error(`${tag} already defined`);
            return;
        }
        customElements.define(tag, mixin(class extends HTMLElement {
            #shadowObserver;
            #templateObserver;
            #disconnect;
            internals_;
            trigger;
            plait;
            #root;
            constructor() {
                super();
                this.internals_ = this.attachInternals();
                if (this.internals_.shadowRoot) {
                    this.#root = this.internals_.shadowRoot;
                }
                else {
                    /** no declarative shadow dom then create a shadowRoot */
                    this.#root = this.attachShadow({ mode, delegatesFocus });
                }
                /** Warn ourselves not to overwrite the trigger method */
                if (this.trigger !== this.constructor.prototype.trigger) {
                    throw new Error('trigger cannot be overridden in a subclass.');
                }
            }
            connectedCallback() {
                if (!this.internals_.shadowRoot?.firstChild) {
                    const template = this.querySelector('template[shadowrootmode]');
                    template
                        ? this.#appendTemplate(template)
                        : (this.#templateObserver = this.#createTemplateObserver());
                }
                if (this.plait) {
                    this.#delegateListeners(// just connected/upgraded then delegate listeners nodes with data-trigger attribute
                    this.#root.querySelectorAll(`[${dataTrigger}]`));
                    const { disconnect, trigger, ...rest } = useBehavioral({
                        context: this,
                        ...bProgramOptions,
                    });
                    this.plait({
                        $: this.$.bind(this),
                        context: this,
                        trigger,
                        ...rest,
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
                        type: `disconnected->${this.id || this.tagName.toLowerCase()}`,
                    });
                    this.#disconnect();
                }
            }
            #delegateListeners(nodes) {
                nodes.forEach(el => {
                    if (el.nodeType === 1) { // Node is of type Element which in the browser mean HTMLElement | SVGElement
                        if (el.tagName === 'SLOT' && // Element is an instance of a slot
                            !canUseSlot(el))
                            return; // Element is not a slot we can use return callback
                        !delegatedListener.has(el) &&
                            delegatedListener.set(el, event => {
                                const triggerKey = getTriggerKey(event, el);
                                triggerKey
                                    /** if key is present in `data-trigger` trigger event on instance's bProgram */
                                    ? this.trigger({
                                        type: triggerKey,
                                        detail: event,
                                    })
                                    /** if key is not present in `data-trigger` remove event listener for this event on Element */
                                    : el.removeEventListener(event.type, delegatedListener.get(el));
                            });
                        const triggers = el.dataset
                            .trigger; /** get element triggers if it has them */
                        if (triggers) {
                            const events = matchAllEvents(triggers); /** get event type */
                            for (const event of events) {
                                /** loop through and set event listeners on delegated object */
                                el.addEventListener(event, delegatedListener.get(el));
                            }
                        }
                    }
                });
            }
            // Observes the addition of nodes to the shadow dom and changes to and child's data-trigger attribute
            #createShadowObserver() {
                const mo = new MutationObserver(mutationsList => {
                    for (const mutation of mutationsList) {
                        if (mutation.type === 'attributes') {
                            const el = mutation.target;
                            if (el.nodeType === 1) {
                                this.#delegateListeners([el]);
                            }
                        }
                        else if (mutation.addedNodes.length) {
                            const list = [];
                            const length = mutation.addedNodes.length;
                            for (let i = 0; i < length; i++) {
                                traverseNodes(mutation.addedNodes[i], list);
                            }
                            this.#delegateListeners(list);
                        }
                    }
                });
                mo.observe(this.#root, {
                    attributeFilter: [dataTrigger],
                    childList: true,
                    subtree: true,
                });
                return mo;
            }
            #appendTemplate(template) {
                !this.#root.firstChild &&
                    this.#root.appendChild(document.importNode(template.content, true));
                template.remove();
            }
            #createTemplateObserver() {
                const mo = new MutationObserver(() => {
                    const template = this.querySelector('template[shadowrootmode]');
                    if (template) {
                        mo.disconnect();
                        this.#appendTemplate(template);
                    }
                });
                mo.observe(this, { childList: true });
                return mo;
            }
            $(target, { all = false, mod = '=' } = {}) {
                const selector = `[${dataTarget}${mod}"${target}"]`;
                if (all) {
                    const elements = [];
                    this.#root.querySelectorAll(selector)
                        .forEach(element => {
                        if (element.tagName !== 'SLOT' ||
                            canUseSlot(element)) {
                            elements.push(Object.assign(element, sugar));
                        }
                    });
                    return Object.assign(elements, sugarForEach);
                }
                const element = this.#root.querySelector(selector);
                if (!element)
                    return;
                if (element.tagName !== 'SLOT' ||
                    canUseSlot(element)) {
                    return Object.assign(element, sugar);
                }
            }
        }));
    };
    define['template'] = (props) => createTemplate(tag, props);
    return define;
};
