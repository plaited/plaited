import { Template, TemplateProps } from '../islandly/mod.ts'
import { Credentials } from '../server/mod.ts'
import { IAssert, IReportOptions } from '../deps.ts'

export type StorySet<T extends TemplateProps = TemplateProps> = {
  title: string
  template: Template<T>
  description: string
}

export type Story<T extends TemplateProps = TemplateProps> = {
  args?: T & TemplateProps
  description: string
  play?: (context: ShadowRoot, assert: IAssert) => Promise<void> | void
}

export type StoryData = Story & {
  name: string
}

export type StorySetData = [
  {
    path: string
  } & StorySet,
  StoryData[],
][]

export type WorkshopConfig = {
  assets?: string
  credentials?: Credentials
  dev?: boolean
  importMap?: string
  port?: number
  workspace?: string
}

export type IReporter = IReportOptions['reporter']
export type IReportParam = Parameters<IReporter>[0]
export type MessageType<T extends AsyncIterable<unknown>> = T extends
  AsyncIterable<infer Y> ? Y : never
export type IAssertionMessage = Extract<
  MessageType<IReportParam>,
  { type: 'ASSERTION' }
>

export type INewTestMessage = Extract<
  MessageType<IReportParam>,
  { type: 'TEST_START' }
>

export type ITestEndMessage = Extract<
  MessageType<IReportParam>,
  { type: 'TEST_END' }
>
export type MapFunc = (
  ms: MessageType<IReportParam>,
) => MessageType<IReportParam>
export type SendObjParam = MessageType<IReportParam> | {
  type: 'RUN_END'
} | {
  type: 'RUN_START'
}
