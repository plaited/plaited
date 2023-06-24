import { Attrs, PlaitedElement, isle } from 'plaited'
import {  test } from '@playwright/test'
import { DesignTokenGroup } from '@plaited/token-types'
import { Request, Response, NextFunction } from 'express'
import type { KeyObject } from 'node:tls'

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


interface GetServerParam extends Pick<Config, 'assets' | 'reload' | 'srcDir' | 'port' | 'sslCert'> {
  rebuild: (arg: Map<string, HandlerCallback>) => Promise<void>
  protocol: 'http' | 'https'
}

export type GetServer = (params: GetServerParam)=> Promise<() => Promise<void>>


export interface BuildArgs extends Omit<Config, 'assets' | 'port'> {
  protocol: 'http' | 'https'
  port: number
}

export type HandlerCallback = (req: Request, res: Response, next: NextFunction) => void;


