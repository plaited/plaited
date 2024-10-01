import { chromium } from 'playwright';
import { getStories } from '../workshop/get-stories.js'
import { isTypeOf } from '../utils/is-type-of.js';
import { isBPEvent } from '../behavioral/b-thread.js'
import { type FailedTestEvent, type PassedTestEvent, PLAITED_TEXT_FIXTURE } from '../workshop/use-play.js'
import { TEST_PASSED, TEST_EXCEPTION } from '../assert/assert.constants.js';
import { wait } from 'src/utils.js';
import { ACTION_TRIGGER } from '../client/client.constants.js';
import { ServerWebSocket, Server, Request } from 'bun'


const cwd = `${process.cwd()}/src`
const { stories, getResponses } = await getStories(cwd)
const browser = await chromium.launch();
const running = new Map(stories)
const fail = new Set()
const pass = new Set()

const isAnExceptionEvent = (data: unknown): data is FailedTestEvent => isBPEvent(data) && TEST_EXCEPTION === data.type
const isAPassedTestEvent = (data: unknown): data is PassedTestEvent => isBPEvent(data) && TEST_PASSED === data.type

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
      console.log(`WebSocket opened: server`);
      ws.send(JSON.stringify({
        address: PLAITED_TEXT_FIXTURE,
        action: ACTION_TRIGGER,
        type: 'play',
      }))
    }, 
    message(ws: ServerWebSocket<unknown>, message: string | Buffer) {
      if(!isTypeOf<string>(message, 'string')) return
      try {
        const json = JSON.parse(message);
        console.log(json)
        if(isAnExceptionEvent(json)) {
          console.error(json.detail)
          fail.add(json.detail.route)
          running.delete(json.detail.route)
        }
        if(isAPassedTestEvent(json)) {
          console.log("✓ ", json.detail.route)
          pass.add(json.detail.route)
          running.delete(json.detail.route)
        }
      } catch (error) {
        console.error(error);
      }
    },
  }
}



const server = Bun.serve(config)

await Promise.all(stories.map(async ([route, { timeout }]) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('websocket', ws => {
    ws.on('framereceived', data => {
      console.log(`WebSocket opened: page`);
    });


    ws.on('framesent', frame => {
      if(!isTypeOf<string>(frame, 'string')) return
      try {
        const message = JSON.parse(frame);
        if(isAnExceptionEvent(message) || isAPassedTestEvent(message)) page.close();
      } catch (error) {
        console.error(error)
      }
    });
  });

  await page.goto(`http://localhost:3000${route}`);
  
  await wait(timeout + 100)
  await page.close()
}))

// await server.stop()

// console.log("Fail: ", fail.size)
// console.log("Pass: ", pass.size)

// if(fail.size) {
//   process.exitCode = 1;
// } else {
//   process.exitCode = 0;
// }
