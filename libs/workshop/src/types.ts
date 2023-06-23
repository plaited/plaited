import { Attrs, PlaitedElement, isle } from 'plaited'
import {  test } from '@playwright/test'
import { DesignTokenGroup } from '@plaited/token-types'
import { Request, Response, Express } from 'express'
export type Meta<T extends Attrs = Attrs> = {
  title: string,
  description: string
  template: PlaitedElement<T>
  define?: ReturnType<typeof isle>
}

export type Story<T extends Attrs = Attrs>  = {
  attrs: T
  description: string
  play?: Parameters<typeof test>[1]
}

export type StoryData =   Pick<Story, 'attrs' | 'description'> & Pick<Meta, 'title' | 'template'>  & {
  name: string,
  clientPath: string
  srcPath: string
  play: boolean
}

export type StoryMap = Map<string, StoryData>

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
}

export type Bundles = Map<string, Uint8Array>
export type SetRoutes = (bundles: Bundles) => Promise<undefined>


export interface CustomResponse {
  sseSetup: () => void
  sseSend: () => void
}


export type AddRoute = (path: string, callback: (req: Request, res: Response | CustomResponse) => void) => void

export type GetServerReturn = {
  start: () => void
  port: number
  // remove: (path: string) => void;
  // has: (path: string) => boolean;
  // onReload: (rebuild: () => Promise<undefined>) => void;
}

interface GetServerParam extends Pick<Config, 'assets' | 'reload' | 'srcDir' | 'port'> {
  rebuild: (arg: AddRoute) => Promise<void>
}

export type GetServer = (params: GetServerParam)=> Promise<GetServerReturn>
