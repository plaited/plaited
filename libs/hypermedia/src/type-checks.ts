import { Plaited_Context } from './constants.js'

type WindowWithPlaitedContext = Window & {
  [Plaited_Context]: {
    hda?: boolean
    logger?: (param: unknown) => void
  }
}

export const isHDA = (win: Window): win is WindowWithPlaitedContext => Plaited_Context in win
