import { resolveMetaVerifierModel, runStructuredLlmQuery } from './structured-llm-query.ts'

export const runStructuredMetaVerifierQuery = async <T>({
  prompt,
  schema,
}: {
  prompt: string
  schema: unknown
}): Promise<
  { ok: true; value: T; meta?: Record<string, unknown> } | { ok: false; reason: string; meta?: Record<string, unknown> }
> => {
  const model = resolveMetaVerifierModel()
  return runStructuredLlmQuery<T>({
    model,
    prompt,
    schema,
  })
}
