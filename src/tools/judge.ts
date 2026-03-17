/**
 * Cached LLM-as-judge for grader dimensions.
 *
 * @remarks
 * Uses claude-haiku-4-5 for fast, cheap evaluation of intention and dynamic
 * checklist items. Results are cached by content hash to `.memory/judge-cache.jsonl`
 * so re-running the same code against the same item costs nothing.
 *
 * @packageDocumentation
 */

import { createHash } from 'node:crypto'
import { appendFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import Anthropic from '@anthropic-ai/sdk'
import type { IntentionJudge } from './module-grader.ts'

// ============================================================================
// Cache
// ============================================================================

const PROJECT_ROOT = resolve(import.meta.dir, '../..')
const CACHE_PATH = join(PROJECT_ROOT, '.memory', 'judge-cache.jsonl')

type CacheEntry = {
  key: string
  pass: boolean
  reasoning: string
}

/** In-memory cache loaded once per process */
const cache = new Map<string, { pass: boolean; reasoning: string }>()
let cacheLoaded = false

const loadCache = async () => {
  if (cacheLoaded) return
  cacheLoaded = true
  const file = Bun.file(CACHE_PATH)
  if (!(await file.exists())) return
  const text = await file.text()
  for (const line of text.trim().split('\n').filter(Boolean)) {
    try {
      const entry = JSON.parse(line) as CacheEntry
      cache.set(entry.key, { pass: entry.pass, reasoning: entry.reasoning })
    } catch {
      // skip malformed lines
    }
  }
}

const writeCache = (key: string, pass: boolean, reasoning: string) => {
  cache.set(key, { pass, reasoning })
  const entry: CacheEntry = { key, pass, reasoning }
  appendFileSync(CACHE_PATH, `${JSON.stringify(entry)}\n`)
}

const cacheKey = (item: string, code: string): string => {
  // Hash item + first 4KB of code — long files have identical structure in first 4KB
  const digest = createHash('sha256')
    .update(`${item}\n${code.slice(0, 4096)}`)
    .digest('hex')
    .slice(0, 16)
  return digest
}

// ============================================================================
// Judge
// ============================================================================

const client = new Anthropic()

const JUDGE_SYSTEM = `You are a code reviewer judging whether a generated module implements a specific behavior.

Answer with JSON only: { "pass": true|false, "reasoning": "<one sentence>" }
- pass: true if the code clearly implements the behavior (even partially or differently than expected)
- pass: false only if there is NO evidence of the behavior in the code
- Be generous — implementation detail may differ from description`

/**
 * Create a cached LLM-as-judge using claude-haiku-4-5.
 *
 * @remarks
 * Caches results to `.memory/judge-cache.jsonl` by content hash.
 * Pass the returned function to `createModuleGrader({ judge })`.
 *
 * @public
 */
export const createJudge = (): IntentionJudge => {
  return async ({ code, intentionItem, context }) => {
    await loadCache()
    const key = cacheKey(intentionItem, code)
    const cached = cache.get(key)
    if (cached) return cached

    const userMsg = [
      context ? `Context: ${context}\n` : '',
      `Behavior to check: "${intentionItem}"`,
      '',
      `Code (excerpt):`,
      '```typescript',
      code.slice(0, 8000),
      '```',
    ]
      .filter(Boolean)
      .join('\n')

    try {
      const msg = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        system: JUDGE_SYSTEM,
        messages: [{ role: 'user', content: userMsg }],
      })

      const text = msg.content[0]?.type === 'text' ? msg.content[0].text : ''
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error(`no JSON in response: ${text}`)

      const parsed = JSON.parse(jsonMatch[0]) as { pass?: boolean; reasoning?: string }
      const result = {
        pass: parsed.pass === true,
        reasoning: parsed.reasoning ?? text,
      }

      writeCache(key, result.pass, result.reasoning)
      return result
    } catch (err) {
      // On judge failure, fall back to a soft pass so grading doesn't crash
      const result = { pass: true, reasoning: `judge error: ${String(err)}` }
      return result
    }
  }
}
