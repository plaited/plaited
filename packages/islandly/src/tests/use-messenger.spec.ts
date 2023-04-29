import { expect, test } from "bun:test";
import sinon from "sinon";
import { wait } from "@plaited/utils";
import { useMessenger } from "../index.js";

Deno.test("useMessenger: connect, broadcast, close", async () => {
  const [connect, send] = useMessenger();
  const callback = spy();
  const close = connect("actor1", callback);
  send("actor1", { type: "a", detail: { value: 4 } });
  await wait(60);
  assertSpyCall(callback, 0, { args: [{ type: "a", detail: { value: 4 } }] }),
    close();
});
Deno.test("useMessenger: broadcast, connect, close", async () => {
  const [connect, send] = useMessenger();
  const callback = spy();
  send("actor1", { type: "b", detail: { value: 4 } });
  const close = connect("actor1", callback);
  await wait(100);
  assertSpyCalls(
    callback,
    0,
  );
  close();
});
