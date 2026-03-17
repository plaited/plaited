/**
 * Permissive ambient declarations for third-party packages used in generated modules.
 *
 * @remarks
 * Generated workspaces declare deps in package.json but don't install them.
 * Layer 2 (tsc check) validates TypeScript LOGIC in the module's own code,
 * not type fidelity of third-party API usage. Using `any` for these packages
 * ensures tsc only reports errors in the module's own type logic.
 */

/* eslint-disable */
// biome-ignore-all

declare module '@atproto/api' {
  // Class declarations allow use as both value and type: `let a: BskyAgent = new BskyAgent()`
  export class BskyAgent {
    constructor(opts?: any)
    login(opts?: any): Promise<any>
    logout(): Promise<void>
    resumeSession(session: any): Promise<void>
    getTimeline(opts?: any): Promise<any>
    getAuthorFeed(opts?: any): Promise<any>
    getProfile(opts?: any): Promise<any>
    post(opts?: any): Promise<any>
    follow(did: string): Promise<any>
    unfollow(uri: string): Promise<any>
    like(uri: string, cid: string): Promise<any>
    unlike(uri: string): Promise<any>
    listNotifications(opts?: any): Promise<any>
    searchActors(opts?: any): Promise<any>
    session?: any
    _baseClient?: any
    [key: string]: any
  }
  export class AtpAgent extends BskyAgent {}
  export class RichText {
    constructor(opts: any)
    text: string
    facets?: any[]
    detectFacets(agent: BskyAgent): Promise<void>
    [key: string]: any
  }
  export namespace AppBskyFeedDefs {
    export type FeedViewPost = any
    export type PostView = any
    export type ReasonRepost = any
    export type ViewerState = any
    export type GeneratorView = any
    export function isReasonRepost(v: unknown): boolean
    export function isPostView(v: unknown): boolean
  }
  export namespace AppBskyActorDefs {
    export type ProfileView = any
    export type ProfileViewDetailed = any
    export type ProfileViewBasic = any
    export type ViewerState = any
    export type KnownFollowers = any
    export function isProfileView(v: unknown): boolean
  }
  export namespace AppBskyGraphDefs {
    export type ListView = any
    export type ListViewBasic = any
  }
  export namespace AppBskyNotificationListNotifications {
    export type Notification = any
  }
  export const Agent: any
  export default {} as any
}

declare module 'leaflet' {
  export const map: any
  export const tileLayer: any
  export const marker: any
  export const circle: any
  export const polyline: any
  export const polygon: any
  export const icon: any
  export const latLng: any
  export const latLngBounds: any
  export const geoJSON: any
  export const DivIcon: any
  export const Icon: any
  export const control: any
  export const popup: any
  export const tooltip: any
  export default {} as any
}

declare module 'chart.js' {
  export class Chart {
    constructor(ctx: any, config: any)
    destroy(): void
    update(mode?: any): void
    data: any
    options: any
    [key: string]: any
  }
  export const registerables: any[]
  export function register(...args: any[]): void
  export default {} as any
}

declare module 'chart.js/auto' {
  export const Chart: any
  export default {} as any
}

declare module 'marked' {
  export function marked(src: string, opts?: any): string
  export function parse(src: string, opts?: any): string | Promise<string>
  export const Marked: any
  export default {} as any
}

declare module 'marked-highlight' {
  export function markedHighlight(opts: any): any
  export default {} as any
}

declare module 'highlight.js' {
  export function highlight(code: string, opts: any): { value: string }
  export function highlightAuto(code: string): { value: string }
  export default {} as any
}

declare module 'prismjs' {
  export function highlight(code: string, grammar: any, language: string): string
  export const languages: any
  export default {} as any
}

declare module 'codemirror' { const m: any; export default m; export = m }
declare module '@codemirror/state' { export const EditorState: any; export const Transaction: any; export default {} as any }
declare module '@codemirror/view' { export const EditorView: any; export const keymap: any; export default {} as any }
declare module '@codemirror/lang-javascript' { export function javascript(): any; export default {} as any }
declare module '@codemirror/lang-python' { export function python(): any; export default {} as any }
declare module '@codemirror/basic-setup' { export const basicSetup: any; export default {} as any }
declare module 'd3' { export const select: any; export const scaleLinear: any; export const axisBottom: any; export const axisLeft: any; export const line: any; export const area: any; export const pie: any; export const arc: any; export const forceSimulation: any; export default {} as any }
declare module 'ml-matrix' { export const Matrix: any; export default {} as any }
declare module 'mathjs' { export const create: any; export const all: any; export function evaluate(expr: string): any; export default {} as any }
declare module 'brain.js' { export const NeuralNetwork: any; export default {} as any }
declare module '@tensorflow/tfjs' { export const tensor: any; export const layers: any; export const sequential: any; export default {} as any }
declare module 'openai' { export const OpenAI: any; export default {} as any }
declare module '@anthropic-ai/sdk' { export const Anthropic: any; export default {} as any }
