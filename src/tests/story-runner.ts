import { chromium, BrowserContext } from 'playwright';
import { bSync, bThread } from '../behavioral/b-thread.js';
import { bProgram } from '../behavioral/b-program.js';
import { getStories } from '../workshop/get-stories.js'
import { isTypeOf } from '../utils/is-type-of.js';
import { isBPEvent } from '../behavioral/b-thread.js'
import { type FailedTestEvent, type PassedTestEvent, PLAITED_TEXT_FIXTURE } from '../workshop/use-play.js'
import { TEST_PASSED, TEST_EXCEPTION, UNKNOWN_ERROR } from '../assert/assert.constants.js';
import { ACTION_TRIGGER } from '../client/client.constants.js';
import { ServerWebSocket, Server } from 'bun'
import { run } from 'node:test';


const cwd = `${process.cwd()}/src`
const { stories, getResponses } = await getStories(cwd)
const browser = await chromium.launch();
const running = new Map(stories)
const fail = new Set()
const pass = new Set()
const contexts = new Set<BrowserContext>()
const isAnExceptionEvent = (data: unknown): data is FailedTestEvent => isBPEvent(data) && TEST_EXCEPTION === data.type
const isAPassedTestEvent = (data: unknown): data is PassedTestEvent => isBPEvent(data) && TEST_PASSED === data.type

const { useFeedback, trigger } = bProgram()

const config ={
  static: getResponses(),
  port: 3000,
  fetch(req: Request, server: Server){
    const url = new URL(req.url);
    if (url.pathname === "/_test-runner") {
      const success = server.upgrade(req);
      return success
        ? undefined
        : new Response("WebSocket upgrade error", { status: 400 });
    }
    return new Response("Upgrade failed", { status: 500 });
  },
  websocket: {
    open(ws: ServerWebSocket<unknown>) {
      ws.send(JSON.stringify({
        address: PLAITED_TEXT_FIXTURE,
        action: ACTION_TRIGGER,
        type: 'play',
      }))
    }, 
    message(_: ServerWebSocket<unknown>, message: string | Buffer) {
      if(!isTypeOf<string>(message, 'string')) return
      try {
        const json = JSON.parse(message);
        if(isAnExceptionEvent(json)) trigger<FailedTestEvent['detail']>(json)
        if(isAPassedTestEvent(json)) trigger<PassedTestEvent['detail']>(json)
      } catch (error) {
        console.error(error);
      }
    },
  }
}

const server = Bun.serve(config)

useFeedback({
  async end() {
    console.log("Fail: ", fail.size)
    console.log("Pass: ", pass.size)
    await Promise.all([...contexts].map(async context => await context.close()))
    console.log("Closed all contexts")
    if(fail.size) {
      process.exitCode = 1;
    } else {
      process.exitCode = 0;
    }
    server.stop()
    process.exit()
  },
  [TEST_EXCEPTION]({route, ...rest}: FailedTestEvent['detail']) {
    fail.add(route)
    running.delete(route)
    console.error(`http://localhost:3000${route}\n`, rest)
    running.size === 0 && trigger({ type: 'end' })
  },
  [UNKNOWN_ERROR]({route, ...rest}: FailedTestEvent['detail']) {
    fail.add(route)
    running.delete(route)
    console.error(`http://localhost:3000${route}\n`, rest)
    running.size === 0 && trigger({ type: 'end' })
  },
  [TEST_PASSED]({ route }: PassedTestEvent['detail']) {
    pass.add(route)
    running.delete(route)
    console.log("✓ ", `http://localhost:3000${route}`)
    running.size === 0 && trigger({ type: 'end' })
  }
})

await Promise.all(stories.map(async ([route]) => {
  const context = await browser.newContext();
  contexts.add(context)
  const page = await context.newPage();
  await page.goto(`http://localhost:3000${route}`);
}))
