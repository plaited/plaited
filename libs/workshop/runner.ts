import { hold, report } from 'npm:zora@5.2.0'
import {
  IReporter,
  IReportParam,
  MessageType,
  passThroughReporter,
  SendObjParam,
} from './utils.ts'
import { Story, StoryConfig } from './types.ts'
import { fixture, storiesRoutePath, testsRoutePath } from './constants.ts'
hold()

const createSocketReporter = (): Promise<
  ((args: IReportParam) => Promise<void>)
> =>
  new Promise((resolve, reject) => {
    const hostRegex = /^https?:\/\/([^\/]+)\/.*$/i
    const host = document.URL.replace(hostRegex, '$1')
    const socket = new WebSocket(`ws://${host}/${testsRoutePath}`)
    // Connection opened
    socket.addEventListener('open', function (_) {
      resolve(async (stream: IReportParam) => {
        sendObj({ type: 'RUN_START' })
        for await (const message of stream) {
          sendObj(message)
        }
        sendObj({ type: 'RUN_END' })
      })
    })

    function sendObj(obj: SendObjParam) {
      return socket.send(JSON.stringify(obj))
    }

    socket.addEventListener('error', (err) => {
      console.error(err)
      reject(err)
    })
  })

const devToolReporter = async (stream: IReportParam) => {
  for await (const message of stream) {
    if (message.type === 'ASSERTION') {
      if (message.data.pass === true) {
        console.log(message)
      } else {
        console.error(message)
      }
    } else {
      console.info(message)
    }
  }
}

const iteratorToStream = (iterator: Iterator<MessageType<IReportParam>>) => {
  return new ReadableStream({
    async pull(controller) {
      const { value, done } = await iterator.next()

      if (done) {
        controller.close()
      } else {
        controller.enqueue(value)
      }
    },
  })
}

async function* streamAsyncIterator(stream: ReadableStream) {
  const reader = stream.getReader()

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) return
      yield value
    }
  } finally {
    reader.releaseLock()
  }
}

const tee = (iterator: Iterator<MessageType<IReportParam>>) => {
  return iteratorToStream(iterator).tee().map(streamAsyncIterator)
}
let data: string[] = []
const hostRegex = /(^https?:\/\/[^\/]+)\/.*$/i
const host = document.URL.replace(hostRegex, '$1')
try {
  const res = await fetch(`${host}/${storiesRoutePath}`)
  data = await res.json()
} catch (err) {
  console.error(err)
}

const tests = document.querySelector('#tests')
const render = (tpl: string) => {
  const li = document.createElement('li')
  tests?.append(li)
  li.insertAdjacentHTML('beforeend', tpl)
  return li.querySelector(fixture)?.shadowRoot as ShadowRoot
}

try {
  await Promise.all(data.map(async ([path]) => {
    const { default: config, ...rest } = await import(`${host}/${path}`)
    const { template } = config as StoryConfig
    for (const story in rest) {
      const { play, args = {} } = rest[story] as Story
      if (play) {
        const context = render(template(args))
        await play(context)
      }
    }
  }))
} catch (err) {
  console.error(err)
}

const messageStream = await report({
  reporter: passThroughReporter as unknown as IReporter,
})

const [st1, st2] = tee(
  messageStream as unknown as Iterator<MessageType<IReportParam>>,
)
const socketReporter = await createSocketReporter()

socketReporter(st2)
await devToolReporter(st1)
