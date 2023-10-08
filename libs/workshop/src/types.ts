import { Attrs, PlaitedElement, isle } from 'plaited'
import type {  
  Expect,
  Page,
} from '@playwright/test'
import { DesignTokenGroup } from '@plaited/token-types'
import { Request, Response, NextFunction } from 'express'
import type { KeyObject } from 'node:tls'

export type Meta<T extends Attrs = Attrs> = {
  title: string,
  description: string
  template: PlaitedElement<T>
  define?: ReturnType<typeof isle>
}

type Play = (
  page: Page,
  expect: Expect,
) => Promise<void>

export type Story<T extends Attrs = Attrs>  = {
  attrs: T
  description: string
  play?: Play 
  options?: {
    a11y?: boolean // Defaults to true
    snapshot?: boolean // Defaults to true
  }
}

export type StoryData =   Omit<Story, 'play'> & Pick<Meta, 'title' | 'template'>  & {
  name: string,
  clientPath: string
  srcPath: string
  play: boolean
}

export type StoryMap = Map<string, StoryData>

type SSLCert = {
  key:  string | Buffer | (string | Buffer | KeyObject)[],
  cert: string | Buffer | (string | Buffer)[],
}

export type Config = {
  /** Static file assets to serve */
  assets?: string
  /** exts to use for finding stories can be a regex pattern */
  exts: string
  /** Port to run dev server on */
  port?: number
  /** live reload on */
  reload?: boolean
  /** Where to watch files for changes */
  srcDir: string
  /** Where to output tests and token schema */
  testDir?: string
  /** Design system token group object*/
  tokens?: DesignTokenGroup,
  /** set base font size defaults to 20px */
  baseFontSize?: number
  /** optional SSLCert */
  sslCert?: SSLCert
}

export type Bundles = Map<string, Uint8Array>

export type HandlerCallback = (req: Request, res: Response, next: NextFunction) => void;

interface InitServerParam extends Pick<Config, 'assets' | 'reload' | 'srcDir' | 'port' | 'sslCert'> {
  rebuild: (arg: Map<string, HandlerCallback>) => Promise<void>
}

export type Info = Map<string, { srcPath: string, testPath: string, url: string}>

export type InitServer = (params: InitServerParam)=> Promise<{
  start: () => Promise<void>
  stop: () => void
  info: Info
}>

export interface BuildArgs extends Omit<Config, 'assets' | 'port'> {
  protocol: 'http' | 'https'
  port: number
  info: Info
}
