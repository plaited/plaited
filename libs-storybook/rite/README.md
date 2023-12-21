# @plaited/storybook-rite

Storybook test framework based on RITEway, instrumented for use with the [Interactions addon](https://github.com/storybookjs/storybook/blob/next/code/addons/interactions/README.md).

To learn more about the [RITEway](https://github.com/paralleldrive/riteway)
testing pattern read
[5 questions every unit test must answer](https://medium.com/javascript-scene/what-every-unit-test-needs-f6cd34d9836d).
RITEWay forces us to answer them.

1. What is the unit under test (module, function, class, whatever)?
2. What should it do? (Prose description)
3. What was the actual output?
4. What was the expected output?
5. How do we reproduce the failure?

## Why?
Storybook has a great test tooling, `@storybook/testing-library` & `@storybook/jest`. However they don't support the Shadow DOM and web components. We wanted to be able to support these for our work. So we decided to instrument a testing pattern we've loved for years to work inside a tool we love and have used for even longer!

## Requirements

### Test runner

- [@storybook/test-runner](https://www.npmjs.com/package/@storybook/test-runner) >= v0.15.2

### JavaScript runtime 
- [Node](https://nodejs.org/en) >= v18
- [Bun](https://bun.sh/) >= v1


## Installing

`npm install--save-dev @plaited/storybook-rite`

## Exports 

`import { assert, findByAttribute, findByText, fireEvent, match, throws, wait } from '@plaited/storybook-rite'`

## Example Usage
### Assert

```ts
export interface Assertion {
  <T>(param: {
    given: string;
    should: string;
    actual: T;
    expected: T;
  }): void;
}
```
### How it works
When it comes to testing we like to keep it simple with basic deep equality checking, and meaningful test messages that clearly state, given some condition we should expect some outcome.

```ts
import { createFragment } from '@plaited/storybook-utils'
import { StoryObj, Meta } from '@plaited/storybook'
import { withActions } from '@storybook/addon-actions/decorator'
import { assert, throws, findByText, findByAttribute} from '@plaited/storybook-rite'
import { Header } from './header.js'

const meta: Meta<typeof Header> = {
  title: 'Example/Header',
  component: Header,
  parameters: {
    layout: 'fullscreen',
  },
}

export default meta

type Story = StoryObj<typeof Header>

export const LoggedIn: Story = {
  render({ user }) {
    const frag = createFragment(<Header.template user={user?.name} />)
    return frag
  },
  play: async ({ canvasElement }) => {
    const button = await findByText<HTMLButtonElement>("Log out", canvasElement);
    assert({
      given: "button rendered",
      should: "should be in shadow dom",
      actual: button?.tagName,
      expected: "BUTTON",
    });
    assert({
      given: "button rendered",
      should: "should have correct content",
      actual: button?.value,
      expected: "onLogout",
    });
  },
  args: {
    user: {
      name: 'Jane Doe',
    },
  },
}
```


## Test helpers
We've also included some useful helpers for testing in the browser

- **[findByAttribute](#findbyattribute):**
- **[findByText](#findbytext):**
- **[fireEvent](#fireevent):**
- **[match](#match):**
- **[throws](#throws):**
- **[wait](#wait):**


### findByAttribute
```ts
type FindByAttribute: <T extends HTMLElement | SVGElement = HTMLElement | SVGElement>(attributeName: string, attributeValue: string | RegExp, context?: HTMLElement | SVGElement) => Promise<T>
```
#### How it works

Wether an element is in the light DOM or deeply nested in another elements
shadow DOM we can find it using the helper `findByAttribute`. This helper
takes three arguments:

- `type attribute = string`
- `type value = string`
- `type context = HTML` _Optional defaults to the `document`_

It will search the light dom of the `context`, then penetrate all nested shadow
DOMs in the `context` until it finds the first element with the target
`attribute` and `value` or return undefined.

#### Example Scenario

Let's say we've rendered our Header component in a logged out state to the canvas. We can test to make sure it rendered correctly like so:

```ts
export const LoggedOut: Story = {
  play: async ({ canvasElement }) => {
    const bar = await findByAttribute("bp-target", "button-bar", canvasElement);
    assert({
      given: "Logged out mode",
      should: "Button bar should have two children",
      actual: bar.childElementCount,
      expected: 2,
    });
  }
}
```

### findByText
```ts
type FindByText: <T extends HTMLElement = HTMLElement>(searchText: string | RegExp, context?: HTMLElement) => Promise<T>
```

#### How it works

Wether an element is in the light DOM or deeply nested in another elements
shadow DOM we can find it using the helper `findByText`. This helper takes two
arguments:

- `type searchText = string | RegExp`
- `type context = HTMLElement` _Optional defaults to the `document`_

It will search the light dom of the `context`, then penetrate all nested shadow
DOMs in the `context` until it finds the first element with the
`Node.textContent` of our `searchText` or return undefined.

#### Example Scenario

Let's say we've rendered our Header component in a logged in state to the canvas. We can verify it by asserting on the presence of a log out button like so:

```ts
export const LoggedIn: Story = {
  play: async ({ canvasElement }) => {
    const button = await findByText<HTMLButtonElement>("Log out", canvasElement);
    assert({
      given: "button rendered",
      should: "should be in shadow dom",
      actual: button?.tagName,
      expected: "BUTTON",
    });
    assert({
      given: "button rendered",
      should: "should have correct content",
      actual: button?.value,
      expected: "onLogout",
    });
  }
}
```

### fireEvent
```ts
type FireEvent: <T extends HTMLElement | SVGElement = HTMLElement | SVGElement>(element: T, eventName: string, options?: EventArguments) => Promise<void>
```

#### How it works

When `fireEvent` is passed an `Element` and an event `type` it will trigger
that event type on the `Element`. We can then subsequently assert some change.

Further we can also pass it an optional third argument object with the following
type signature

```ts
type EventArguments = {
  bubbles?: boolean; // default true
  composed?: boolean; // default true
  cancelable?: boolean; // default true
  detail?: Record<string, unknown>; // default undefined
};
```

#### Example Scenario

We've rendered our Page component in a logged out state to the canvas. We have reference to the login button. When we click the button, we expect our button bar to now contain a Log Out button.

```ts
export const LoggingIn: Story = {
  play: async ({ canvasElement }) => {
    const loginButton = await findByAttribute('value', 'onLogin', canvasElement)
    await fireEvent(loginButton, 'click')
    const logoutButton = await findByAttribute('value', 'onLogout', canvasElement)
    assert({
      given: 'the user is logged in',
      should: 'render the logout button',
      actual: logoutButton?.textContent,
      expected: 'Log out',
    })
  },
}
```

### match
```ts 
type Match: (str: string) => (pattern: string | RegExp) => string
```

#### How it works

When `match` is passed a string of text it returns a search callback function.
We can then pass that callback a string of text to search for in the original
string or a regex pattern. It will return the matched text, if found, or an
empty string.

#### Example Scenario

We want to make sure our Buttons are rendering our label arg so write an assertion like so to verify.

```ts
export const Small: Story = {
  play: async ({ canvasElement }) => {
    const button = await findByAttribute<HTMLButtonElement>('type', 'button', canvasElement)
    const expected = 'Small Button'
    const contains = match(button?.innerHTML);
    assert({
      given: 'label arg passed to story',
      should: 'render with label content',
      actual: contains(expected),
      expected,
    })
  },
  args: {
    dataTarget: 'button',
    size: 'small',
    label: 'Small Button',
  },
}
```

### throws
```ts
type Throws = <U extends unknown[], V>(fn: (...args: U) => V, ...args: U) => string | undefined | Promise<string | undefined>
```

#### How it works

`throws` takes a function which can be synchronous or asynchronous along with
any arguments that are to be passed to the function. If an error is thrown when
the function is called with those arguments `throws` returns
`error.toString()`. If an error is not thrown `throws` returns `undefined`.

#### Example Scenario

Sometimes you want to test a utility function or just make sure your exports are working as expected. We're exporting a file that defines our custom elements. We want to make sure it's working as expected. We've already imported it in our storybook's `preview-head.html`. So we now need to try to re-define one our custom elements to ensure it throws.

```ts
export const RegistryIsDefiningElements: Story = {
  play: async () => {
    const msg = await throws(
      (tag, el) =>  customElements.define(el, tag),
      Header, 
      Header.tag
    );
    assert({
      given: "reverent receives irreverent attitude",
      should: "throw an error",
      actual: msg.includes(`Failed to execute 'define' on 'CustomElementRegistry'`),
      expected: true,
    });
  },
}
```

### wait
```ts
type Wait: (ms: number) => Promise<unknown>
```

#### How it works

`wait` is an async function that will wait the given time passed to it in milliseconds
and then continue execution of the `play` function.

#### Example Scenario

We're testing **plaited's** `useMessenger` utility which uses the `CustomEvent`
constructor. So we know we need to wait a bit before asserting message receipt,
let's wait 60ms. We're also going to use **sinon** to create a spy callback to
assert on message values.

```ts
export const ConnectSendClose: Story = {
  play: async () => {
     const msg = messenger()
    const spy = sinon.spy()
    const close = msg.connect('actor1', spy)
    msg('actor1', { type: 'a', detail: { value: 4 } })
    await wait(60)
    assert({
      given: 'message send',
      should: 'connected spy should receive message',
      actual: spy.calledWith({ type: 'a', detail: { value: 4 } }),
      expected: true,
    })
    close()
    assert({
      given: 'close',
      should: 'has should return false',
      actual: msg.has('actor1'),
      expected: false,
    })
  },
}
```
