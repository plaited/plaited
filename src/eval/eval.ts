import { makeCli } from '../cli/cli.ts'
import { compareEvalRuns } from './eval.comparison.ts'
import { EVAL_MODES } from './eval.constants.ts'
import { gradeEvalTrial } from './eval.grading.ts'
import { type EvalCliInput, EvalCliInputSchema, type EvalCliOutput, EvalCliOutputSchema } from './eval.schemas.ts'

const runEval = async (input: EvalCliInput): Promise<EvalCliOutput> => {
  if (input.mode === EVAL_MODES.grade) {
    return gradeEvalTrial(input)
  }

  return compareEvalRuns(input)
}

export const evalCli = makeCli({
  name: 'eval',
  inputSchema: EvalCliInputSchema,
  outputSchema: EvalCliOutputSchema,
  run: runEval,
})
