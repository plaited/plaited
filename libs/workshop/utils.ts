import { IReportOptions } from '../deps.ts'

export type IReporter = IReportOptions['reporter']
export type IReportParam = Parameters<IReporter>[0]
export type MessageType<T extends AsyncIterable<unknown>> = T extends
  AsyncIterable<infer Y> ? Y : never
type MapFunc = (ms: MessageType<IReportParam>) => MessageType<IReportParam>
export type SendObjParam = MessageType<IReportParam> | {
  type: 'RUN_END'
} | {
  type: 'RUN_START'
}

const map = (mapFn: MapFunc) =>
  async function* (stream: IReportParam) {
    for await (const element of stream) {
      yield mapFn(element)
    }
  }

export const passThroughReporter = map((message) => message)
