// Fixture for the build-typescript-lsp-skill task.
// Top-level symbols are recomputed from this file by the verifier at grading
// time using the TypeScript 7 native API — keep it stable.
//
// Top-level symbols, in source order:
//   FIXED_PIVOT (Variable), RenderMode (TypeAlias), RenderOptions (Interface),
//   Renderer (Class), formatValue (Function), OutputFlavor (Enum),
//   internals (Module)

export const FIXED_PIVOT = 42

export type RenderMode = 'static' | 'dynamic'

export interface RenderOptions {
  mode: RenderMode
  indent?: number
}

export class Renderer {
  #indent: number

  constructor(indent = 2) {
    this.#indent = indent
  }

  render(value: unknown): string {
    return JSON.stringify(value, null, this.#indent)
  }
}

export function formatValue(value: unknown, options: RenderOptions): string {
  const renderer = new Renderer(options.indent)
  return renderer.render(value)
}

export enum OutputFlavor {
  Plain = 'plain',
  Pretty = 'pretty',
}

export namespace internals {
  export const VERSION = '1.0.0'
}
