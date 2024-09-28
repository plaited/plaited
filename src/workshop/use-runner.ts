// import type { ServerWebSocket } from "bun";
// import { chromium } from "playwright";
// import { bProgram } from "../behavioral/b-program.js";
// import { TEST_PASSED, TEST_EXCEPTION, UNKNOWN_ERROR } from "../assert/assert.constants.js";
// import { useStore } from "../client/use-store.js";
// import { PLAITED_TEXT_FIXTURE, PLAY_EVENT } from './workshop.constants.js'
// import type { TriggerMessage } from '../client/use-server.js'
// import { ACTION_TRIGGER } from "../client/client.constants.js";
// import { FailedTest, PassedTest } from "./use-play.js";
// import { StoriesMap } from "./scan-template.js";

// export const useRunner = async ({
//   pathnames,
//   stories,
//   port,
//   socket,
// }:{
//   pathnames: string[],
//   stories: StoriesMap,
//   port: number,
//   socket: ReturnType<typeof useStore<ServerWebSocket<unknown>>>
// }) => {
//   const pending = new Set(pathnames)
//   const { trigger, useFeedback } = bProgram();
//   const browser = await chromium.launch(); 
//   const context = await browser.newContext({
//     baseURL: `http://localhost:${port}`
//   });
//   socket.sub('run', trigger)
//   const finish = () => {
//     if(pending.size === 0) {
//       trigger({ type: 'done' })
//     }
//   }
//   const pass = useStore(0)
//   const fail= useStore(0)
//   useFeedback({
//     [UNKNOWN_ERROR](msg: FailedTest) {
//       console.error(msg)
//       fail(fail.get() + 1)
//       finish()
//     },
//     [TEST_EXCEPTION](msg: FailedTest) {
//       console.error(msg)
//       fail(fail.get() + 1)
//       finish()
//     },
//     [TEST_PASSED]({route}: PassedTest) {
//       const obj = stories.get(route)
//       if(obj) {
//         const { relativePath, exportName } = obj
//         console.log('passed', relativePath, exportName)
//       }
//       pass(pass.get() + 1)
//       finish()
//     },
//     async done() {
//       await browser.close()
//       if(fail.get() === 0) {
//         console.log('All tests passed')
//         process.exit(0)
//       } else {
//         console.log(`${fail.get()} tests failed`)
//         process.exit(1)
//       }
//     },
//     async run(ws: ServerWebSocket<unknown>) {
//       await Promise.all([...pathnames].map(async (route) => {
//         const page = await context.newPage();
//         await page.goto(route);
//         const message:TriggerMessage = {
//           address: PLAITED_TEXT_FIXTURE,
//           action: ACTION_TRIGGER,
//           type: PLAY_EVENT
//         }
//         ws.send(JSON.stringify(message));
//         pending.delete(route)
//       }))  
//     }
//   })
//   return trigger
// }


// const useComposeStories = () => {}
// console.log(Bun.main)

