# @plaited/rite

Modern web unit test framework based on RITEway.

To learn more about the [RITEway](https://github.com/paralleldrive/riteway)
testing pattern read
[5 questions every unit test must answer](https://medium.com/javascript-scene/what-every-unit-test-needs-f6cd34d9836d).
RITEWay forces us to answer them.

1. What is the unit under test (module, function, class, whatever)?
2. What should it do? (Prose description)
3. What was the actual output?
4. What was the expected output?
5. How do we reproduce the failure?

## Requirements

### Test runner

- [@web/test-runner](https://www.npmjs.com/package/@web/test-runner) >= 0.16.1

### JavaScript runtime options

1. [Node](https://nodejs.org/en) >= v18
2. [Bun](https://bun.sh/) >= 0.5.9

## Installing

`npm install--save-dev @plaited/rite`

Then add it to our
[modern web](https://modern-web.dev/docs/test-runner/cli-and-configuration/#configuration-file)
test config like so

**web-test-runner.config.js**

```js
import { getFramework } from "@plaited/rite/framework";

export default {
  nodeResolve: true,
  testFramework: getFramework(),
};
```

Update our package.json scripts like so

```json
"scripts": {
  "test": "web-test-runner \"src/**/*.spec.(ts|tsx)\" --config web-test-runner.config.js",
  "test:watch": "web-test-runner \"src/**/*.spec.(ts|tsx)\" --config web-test-runner.config.js --watch"
},
```

If we want to change the default test timeout time from 5 seconds we can do so
like this

**web-test-runner.config.js**

```js
import { getFramework } from "@plaited/rite/framework";

export default {
  nodeResolve: true,
  testFramework: getFramework(3_000),
};
```

## Example Usage

```ts
import { test } from "@plaited/rite";

const classNames = (...classes: Array<string | undefined | false | null>) =>
  classes.filter(Boolean).join(" ");

test("classNames", (t) => {
  t({
    given: "two class names",
    should: "join them",
    expected: "class-1 class-2",
    actual: classNames("class-1", "class-2"),
  });
  const conditionTrue = true;
  const conditionFalse = false;
  t({
    given: "truthy and falsy class names",
    should: "join only truthy",
    expected: "class-1 class-3",
    actual: classNames(
      "class-1",
      conditionFalse && "class-2",
      conditionTrue && "class-3",
    ),
  });
});
```

To skip a test we can do the following

```ts
import { test } from "@plaited/rite";

const classNames = (...classes: Array<string | undefined | false | null>) =>
  classes.filter(Boolean).join(" ");

test.skip("classNames", (t) => {
  t({
    given: "two class names",
    should: "join them",
    expected: "class-1 class-2",
    actual: classNames("class-1", "class-2"),
  });
  const conditionTrue = true;
  const conditionFalse = false;
  t({
    given: "truthy and falsy class names",
    should: "join only truthy",
    expected: "class-1 class-3",
    actual: classNames(
      "class-1",
      conditionFalse && "class-2",
      conditionTrue && "class-3",
    ),
  });
});
```

`t` our assertion function has the following type

```ts
export interface Assertion {
  <T>(param: {
    given: string;
    should: string;
    actual: T;
    expected: T;
  }): void;
  findByAttribute: typeof findByAttribute;
  findByText: typeof findByText;
  fireEvent: typeof fireEvent;
  match: typeof match;
  throws: typeof throws;
  wait: typeof wait;
}
```

As we can see `t` includes some useful helpers for testing in the browser:

- [findByAttribute](#t.findbyattribute)
- [findByText](#t.findbytext)
- [fireEvent](#t.fireevent)
- [match](#t.match)
- [throws](#t.throws)
- [wait](#t.wait)

### t.findByAttribute

#### How it works

Wether an element is in the light DOM or deeply nested in another elements
shadow DOM we can find it using the helper `t.findByAttribute`. This helper
takes three arguments:

- `type attribute = string`
- `type value = string`
- `type context = HTML` _Optional defaults to the `document`_

It will search the light dom of the `context`, then penetrate all nested shadow
DOMs in the `context` until it finds the first element with the target
`attribute` and `value` or return undefined.

#### Example Scenario

Let's say we've rendered an element to the screen with:

- attribute: `data-test-id`
- value: `island`
- innerText: `Pick your hammock`

We can test to make sure it rendered correctly like so:

```ts
import { test } from "@plaited/rite";

test("Island rendered correctly", async (t) => {
  const body = document.querySelector("body");
  const island = await t.findByAttribute("data-test-id", "island", body);
  t({
    given: "Rendering the island component",
    should: "be present with the correct content",
    actual: island?.innerText,
    expected: "Pick your hammock",
  });
});
```

### t.findByText

#### How it works

Wether an element is in the light DOM or deeply nested in another elements
shadow DOM we can find it using the helper `t.findByText`. This helper takes two
arguments:

- `type searchText = string | RegExp`
- `type context = HTMLElement` _Optional defaults to the `document`_

It will search the light dom of the `context`, then penetrate all nested shadow
DOMs in the `context` until it finds the first element with the
`Node.textContent` of our `searchText` or return undefined.

#### Example Scenario

Let's say we've rendered a button to the screen:

- innerText: `add svg`

```ts
import { test } from "@plaited/rite";

test("add svg button", async (t) => {
  const body = document.querySelector("body");
  const button = await t.findByText<HTMLButtonElement>("add svg", body);
  t({
    given: "button rendered",
    should: "should be in dom",
    actual: button?.tagName,
    expected: "BUTTON",
  });
  t({
    given: "button rendered",
    should: "should have correct content",
    actual: button?.innerText,
    expected: "add svg",
  });
});
```

### t.fireEvent

#### How it works

When `t.fireEvent` is passed an `Element` and an event `type` it will trigger
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

We've rendered a `button` to the screen and have reference to it. When we click
the button, we expect our `header` element's `textContent` to change to
`Hello World!`

```ts
import { test } from "@plaited/rite";

test("shadow observer test", async (t) => {
  ...

  await t.fireEvent(button, "click");
  t({
    given: "clicking button",
    should: "append string to header",
    actual: header?.textContent,
    expected: "Hello World!",
  });
}
```

### t.match

#### How it works

When `t.match` is passed a string of text it returns a search callback function.
We can then pass that callback a string of text to search for in the original
string or a regex pattern. It will return the matched text, if found, or an
empty string.

#### Example Scenario

We want to make sure our alert dialog `header` is rendering with the correct
`className` and `innerText`

```ts
import { test } from "@plaited/rite";

test("match()", (t) => {
   ...

  const expected = "<h1 className="alert">Houston we have a problem!!!</h1>";
  const contains = t.match(header.outerHTML);

  t({
    given: "some text to search and a pattern to match",
    should: "return the matched text",
    actual: contains(expected),
    expected,
  });
});
```

### t.throws

#### How it works

`t.throws` takes a function which can be synchronous or asynchronous along with
any arguments that are to be passed to the function. If an error is thrown when
the function is called with those arguments `t.throws` returns
`error.toString()`. If an error is not thrown `t.throws` returns `undefined`.

#### Example Scenario

We've got an function `reverence` that will throw when passed the string
`irreverent` for it's first argument but will not if passed `true` for it's
second argument. We need to make sure it works right.

```ts
import { test } from "@plaited/rite";

test("yep it throws", async (t) => {
  const error = new Error("unacceptable");
  const reverence = (attitude: string, pass = false) => {
    if (!pass && attitude === "irreverent") {
      throw error;
    }
  };
  let actual = await t.throws(reverence, "irreverent");
  t({
    given: "reverent receives irreverent attitude",
    should: "throw an error",
    actual,
    expected: error.toString(),
  });

  actual = await t.throws(reverence, "irreverent", true);
  t({
    given: "reverent receives irreverent attitude but has a pass",
    should: "not throw error",
    actual,
    expected: undefined,
  });
});
```

### t.wait

#### How it works

`t.wait` is an async function that will wait the given time passed to it in ms
and then continue execution of the `test` callback function.

#### Example Scenario

We're testing **plaited's** `useMessenger` utility which uses the `CustomEvent`
constructor. So we know we need to wait a bit before asserting message receipt,
let's wait 60ms. We're also going to use **sinon** to create a spy callback to
assert on message values.

```ts
import { test } from "@plaited/rite";
import sinon from "sinon";
import { useMessenger } from "plaited";

test("useMessenger: connect, send, close", async (t) => {
  const [connect, send] = useMessenger();
  const spy = sinon.spy();
  const close = connect("actor1", spy);
  send("actor1", { type: "a", detail: { value: 4 } });
  await t.wait(60);
  t({
    given: "message send",
    should: "connected spy should receive message",
    actual: spy.calledWith({ type: "a", detail: { value: 4 } }),
    expected: true,
  });
  close();
});
```
