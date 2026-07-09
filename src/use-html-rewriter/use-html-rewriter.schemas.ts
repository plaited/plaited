/**
 * Zod schemas for the data-binding descriptor embedded in `<script type="application/json" p-context>`.
 *
 * @remarks
 * The p-context JSON is a Record<string, BindingDescriptorSchema> keyed by p-target value.
 * Each descriptor tells the rewriter how to resolve and apply data for that target node.
 *
 * Three kinds of binding descriptors, plus a simple `{ path }` form:
 * - **Simple** (`{ path: "/foo/bar" }`): resolve the value at that JSON Pointer path and apply
 *   directly as text (for primitives) or attributes (for objects).
 * - **data** (`{ kind: "data", data: "/path", template?: "./file.html" }`): resolve value at data
 *   path; if template is present, render the template with this value as context.
 * - **list** (`{ kind: "list", data: "/arr", template: "./item.html" }`): resolve array at data
 *   path; loop the template once per item; each item becomes per-iteration context.
 * - **switch** (`{ kind: "switch", data: "/val", discriminator: "type", cases: {...}, default?: ... }`):
 *   resolve value at data path; read the discriminator field; pick the matching case; render that
 *   case's template (which is itself a descriptor).
 *
 * @see {@link https://a2ui.org/concepts/data-binding/#json-pointer-paths}
 */

import { z } from 'zod'

/**
 * Recursive helper: a binding descriptor that can reference itself for nested cases.
 *
 * @internal
 */
const BindingDescriptorSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    // Simple binding — just a path, no kind.
    // MINIMAL: this branch is permissive on `kind` — z.object allows unknown
    // keys by default, so `{ path: "/x", kind: "bogus" }` matches here and
    // the bogus kind is silently ignored. Engine-time validation (R2: R
    // ContextDescriptorSchema.safeParse in rewriteFile) still rejects
    // malformed kind when no `path` is present, via the discriminated branches.
    // Upgrade path: .strict() on this branch or a top-level refine to reject a
    // `kind` that isn't one of data/list/switch.
    z.object({
      path: z.string().describe('JSON Pointer path to the data value'),
    }),
    // Data binding — fetch data at path, optionally render a template with it
    z.object({
      kind: z.literal('data').describe('Fetch data at the given path'),
      data: z.string().describe('JSON Pointer path to the data value'),
      template: z.string().optional().describe('Optional HTML template file to render with this data as context'),
    }),
    // List binding — loop template per array item
    z.object({
      kind: z.literal('list').describe('Loop template once per array item'),
      data: z.string().describe('JSON Pointer path to the array'),
      template: z.string().describe('HTML template file rendered per item'),
    }),
    // Switch binding — pick case by discriminator value
    z.object({
      kind: z.literal('switch').describe('Pick a case by discriminator value'),
      data: z.string().describe('JSON Pointer path to the discriminant value'),
      discriminator: z.string().describe('The field name on the resolved value to switch on'),
      cases: z
        .record(z.string(), BindingDescriptorSchema)
        .describe('Map of discriminant values to binding descriptors'),
      default: BindingDescriptorSchema.optional().describe('Fallback case when no match'),
    }),
  ]),
)

/**
 * Schema for the full p-context descriptor — a record keyed by p-target value.
 *
 * @public
 */
export const ContextDescriptorSchema = z
  .record(z.string(), BindingDescriptorSchema)
  .describe('Record of binding descriptors keyed by p-target value')

export type ContextDescriptor = z.output<typeof ContextDescriptorSchema>
