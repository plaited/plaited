# @plaited/rite

[Modern web](https://modern-web.dev/docs/test-runner/overview/) unit test
framework based on [RITEway](https://github.com/paralleldrive/riteway). To learn
more about this testing pattern read
[5 questions every unit test must answer](https://medium.com/javascript-scene/what-every-unit-test-needs-f6cd34d9836d).
RITEWay forces you to answer them.

1. What is the unit under test (module, function, class, whatever)?
2. What should it do? (Prose description)
3. What was the actual output?
4. What was the expected output?
5. How do you reproduce the failure?

## Configuration example

Below is an example of how to use `@plaited/rite` with modern web's test runner.
Not that we can change the test timeout by passing the time to the
`getFramework` function which will configure the testFramework setting for us.
The default timeout is 5 seconds.

**web-test-runner.config.js**

```js
import { esbuildPlugin } from "@web/dev-server-esbuild";
import { playwrightLauncher } from "@web/test-runner-playwright";
import { getFramework } from "@plaited/rite/framework";
import { fileURLToPath } from "url";

export default {
  testFramework: getFramework(3_000),
};
```

## test

To use import the test function. this function takes a synchronous or
asynchronous callback function that will provide us with the assertion function.

The assertion function is the function you call to make your assertions. It
takes prose descriptions for given and should (which should be strings). When
the test runner calls the test callback it throws an error should the assertion
of the actual and expected values not be equal.

Note that assertion function uses a deep equality check to compare the actual
and expected values. Rarely, you may need another kind of check. In those cases,
pass a JavaScript expression for the actual value.

**assertion type**

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

**Example test**

```ts
import { test } from "@plaited/rite";
import { classNames } from "../index.js";

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

### skip

We can also skip a tests like so

```ts
import { test } from "@plaited/rite";
import sinon from "sinon";
import { useStore } from "../index.js";

test.skip("useStore()", (t) => {
  const [store, setStore] = useStore<Record<string, number> | number>({ a: 1 });
  setStore((prev) => {
    if (typeof prev !== "number") prev.b = 2;
    return prev;
  });
  t({
    given: "updating store with callback",
    should: "return new value when getter invoked",
    actual: store(),
    expected: { a: 1, b: 2 },
  });
  setStore(3);
  t({
    given: "updating store with value",
    should: "return new value when getter invoked",
    actual: store(),
    expected: 3,
  });
});
```

## Utility methods

In addition it also provides some useful utilities for unit testing our
frontend.

### wait

In the example below we wait 60 ms before asserting whether the sinon spy was
called.

```ts
import { test } from "@plaited/rite";
import sinon from "sinon";
import { useMessenger } from "../index.js";

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

### throws

Easily assert that a function throws an error. It take the function which can be
a synchronous or asynchronous along with n arguments. It catches the thrown
error and returns error.toString()

```ts
import { test } from "@plaited/rite";
import { useMessenger } from "../index.js";

test("yep it throws", async (t) => {
  const error = new Error("ooops");
  const erred = (_: string) => {
    throw error;
  };
  const actual = await t.throws(erred, "irrelevant");
  t({
    given: "an async function that throws",
    should: "await and return the value of the error",
    actual,
    expected: error.toString(),
  });
});
```

### match

Take some text to search and return a function which takes a pattern and returns
the matched text, if found, or an empty string. The pattern can be a string or
regular expression.

```ts
test("match()", (t) => {
  const given = "some text to search and a pattern to match";
  const should = "return the matched text";

  const textToSearch = "<h1>Dialog Title</h1>";
  const pattern = "Dialog Title";
  const contains = t.match(textToSearch);

  t({
    given,
    should,
    actual: contains(pattern),
    expected: pattern,
  });
});
```

### findByAttribute

Use this utility method to find a dom node by attribute and then use it for an
assertion. This method will also penetrate the shadow dom to find said node.

```ts
test("template observer", async (t) => {
  const wrapper = document.querySelector("body");
  
  ...

  const island = await t.findByAttribute("data-test-id", "island", wrapper);
  t({
    given: "after template append is observed by observer",
    should: "no longer be in light dom",
    actual: island?.innerHTML,
    expected: "",
  });
});
```

### findByText

Use this utility method to find a dom node by text and then use it for an
assertion. This method will also penetrate the shadow dom to find said node.

```ts
test("shadow observer test", async (t) => {
  const button = await t.findByText<HTMLButtonElement>("add svg");
  t({
    given: "request to append `add svg` button",
    should: "new button should be in dom",
    actual: button?.innerText,
    expected: "add svg",
  });
});
```

### fireEvent

Use this utility method to trigger an event on a dom node and then we can
subsequently assert some change.

```ts
test("shadow observer test", async (t) => {
  ...

  await t.fireEvent(button, "click");
  t({
    given: "clicking button",
    should: "append string to header",
    actual: header?.innerHTML,
    expected: "Hello World!",
  });
}
```

A third optional argument of the following type can be passed to fireEvent as
needed by our test

```ts
type EventArguments = {
  bubbles?: boolean;
  composed?: boolean;
  cancelable?: boolean;
  detail?: Record<string, unknown>;
};
```
