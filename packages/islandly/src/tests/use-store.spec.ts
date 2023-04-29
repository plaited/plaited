import { expect, test } from "bun:test";
import sinon from "sinon";
import { useStore } from "../index.js";

Deno.test("useStore()", () => {
  const [store, setStore] = useStore<Record<string, number> | number>({ a: 1 });
  setStore((prev) => {
    if (typeof prev !== "number") prev.b = 2;
    return prev;
  });
  assertEquals(store(), { a: 1, b: 2 });
  setStore(3);
  assertEquals(store(), 3);
});

Deno.test("useStore(): with subscription", () => {
  const [store, setStore] = useStore<number>(2);
  const callback = spy();
  const disconnect = store.subscribe(callback);
  setStore((prev) => prev + 1);
  assertEquals(store(), 3);
  assertSpyCall(callback, 0, { args: [3] });
  disconnect();
  setStore(4);
  assertEquals(store(), 4);
  assertSpyCalls(
    callback,
    1,
  );
});
