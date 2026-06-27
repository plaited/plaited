/**
 * Re-export from @plaited/make-cli.
 *
 * @remarks
 * CLI tools (eval, frontier-analysis, LSP, git-context, etc.) import from
 * this module. The implementation lives in the standalone @plaited/make-cli
 * package at ~/workspace/make-cli.
 *
 * @public
 */
export {
  parseCliRequest,
  parseCli,
  makeCli,
  defineScript,
  makeCliRouter,
} from '@plaited/make-cli'

export type {
  CliFlags,
  CliOptions,
  ParsedCliRequest,
} from '@plaited/make-cli'