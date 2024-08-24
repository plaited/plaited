/** Utility function for enabling hypermedia patterns */
import type { InitPlaitedArgs, PlaitedPopStateEvent, ViewTransition } from './types.js'
import { canUseDOM } from '@plaited/utils'
import { displayContent } from './display-content.js'
import { DelegatedListener, delegates } from '../shared/delegated-listener.js'
import { fetchHTML } from './fetch-html.js'
import { NAVIGATE_EVENT_TYPE } from '../shared/constants.js'

let id = 0
let direction: 'forwards' | 'backwards' = 'forwards'

const updatePage = async (event: CustomEvent<string> | PlaitedPopStateEvent, args: Omit<InitPlaitedArgs, 'skipViewTransition' | 'viewTransitionCallback' | 'viewTransitionTypes'>) => {
  const { retry = 3, retryDelay = 1000, credentials = 'same-origin', ...rest } = args || {}
  const isCustomEvent = event instanceof CustomEvent
  const href = isCustomEvent ? event.detail : event.state.plaited
  // Prevent navigation to the current page
  if(isCustomEvent && href === window.location.href) return
  // Fetch the html content from the server or cache
  const res = await fetchHTML(href, { retry, retryDelay, credentials, ...rest })
  if (res) {
    const text = await res.text()
    const title = displayContent(text)
    const prevId = id
    id = isCustomEvent ? id + 1 : event.state.id
    direction = prevId > id ? 'backwards' : 'forwards'
    isCustomEvent  && history.pushState({ plaited: href, id }, title, href)
  }
}

const transitionHelper = ({
  skipTransition,
  types,
  update,
}: {
  skipTransition: boolean;
  types: string[];
  update: () => void;
}) => {
  const unsupported = (error: string) => {
    const updateCallbackDone = Promise.resolve(update()).then(() => {});
    return {
      ready: Promise.reject(Error(error)),
      updateCallbackDone,
      finished: updateCallbackDone,
      skipTransition: () => {},
      types: [...types, direction],
    };
  }
  // @ts-ignore - TS doesn't know about startViewTransition
  if (skipTransition || !document.startViewTransition) {
    return unsupported('View Transitions are not supported in this browser');
  }

  try {
    // @ts-ignore - TS doesn't know about startViewTransition
    const transition: ViewTransition = document.startViewTransition({
      update,
      types,
    });
    return transition;
  } catch (e) {
    return unsupported('View Transitions with types are not supported in this browser');
  }
}

const transitionCallback = async (transition: ViewTransition) =>  {
  try {
    await transition.ready;
  }
  catch (e) {
    // @ts-ignore - TS doesn't know about startViewTransition
    !!document.startViewTransition && console.error('Error starting view transition:', e);
  }
}

const skipCallback = () => false;

export const initPlaited = ({
  skipViewTransition = skipCallback,
  viewTransitionCallback = transitionCallback,
  viewTransitionTypes = [],
  ...rest
} : InitPlaitedArgs = {}) => {
  const navigate = async (event: CustomEvent<string> | PlaitedPopStateEvent,) => {
    const transition = transitionHelper({
      update() {
        updatePage(event, rest);
      },
      types: viewTransitionTypes,
      skipTransition: skipViewTransition(),
    });
    viewTransitionCallback(transition)
    await transition.updateCallbackDone;
  }
  if (canUseDOM()) {
    const initialState = history?.state || { plaited: window.location.href, id }
    history.replaceState(initialState, document.title, window.location.href)
    !delegates.has(window) && delegates.set(window, new DelegatedListener(navigate))
    window.addEventListener(NAVIGATE_EVENT_TYPE, delegates.get(window))
    window.addEventListener('popstate', delegates.get(window))
  }
}