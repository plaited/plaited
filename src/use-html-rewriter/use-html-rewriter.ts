/**
 * SSR data-binding + template-composition utility using HTMLRewriter.
 *
 * @remarks
 * Inversion-of-control function: the user supplies a `dataResolver` callback
 * and optionally a `cwd` for path resolution. Returns `page()` and `dynamic()`
 * methods for single-file and multi-file modes.
 *
 * **page(filePath)**: Reads a single HTML file, runs the two-pass rewriter
 * (context capture → data binding + ssr-include resolution), returns the
 * rewritten HTML string. `<style>` and `<link rel="stylesheet">` pass through
 * unchanged.
 *
 * **dynamic(filePaths)**: Reads one or more HTML files, runs the two-pass
 * rewriter on each, merges results into a single {@link TemplateObject}:
 * - `html` arrays concatenated in file order
 * - `stylesheets` arrays concatenated with dedup (exact string equality)
 * - `<style>` elements extracted → text pushed to `stylesheets`, element removed
 * - `<link rel="stylesheet">` → throws {@link StylesheetNotAllowedError}
 *
 * @example
 * ```ts
 * const rewriter = useHtmlRewriter({
 *   dataResolver: (ctx) => fetchData(ctx),
 *   cwd: './pages',
 * })
 *
 * const html = await rewriter.page('index.html')
 * const { html: chunks, stylesheets } = await rewriter.dynamic(['header.html', 'main.html'])
 * ```
 *
 * @see {@link import('./html-rewriter.ts').rewriteFile}
 * @see {@link import('./html-rewriter.ts').TemplateObject}
 */

import { resolve } from 'node:path'
import { SCALE, TEMPLATE_OBJECT_IDENTIFIER } from './html.constants.ts'
import type { TemplateObject } from './html-rewriter.ts'
import { rewriteFile, validateTemplateObject } from './html-rewriter.ts'
import { FileNotFoundError, StylesheetNotAllowedError } from './use-html-rewriter.errors.ts'

/** Bun's HTMLRewriter Element type. */
type RewriterElement = HTMLRewriterTypes.Element
type RewriterText = HTMLRewriterTypes.Text

/**
 * Options for creating a rewriter instance.
 */
export interface UseHtmlRewriterOptions {
  /** Async/sync callback invoked with each file's parsed p-context descriptor. */
  dataResolver: (context: unknown) => unknown | Promise<unknown>
  /** Base directory for resolving relative file paths (templates, ssr-include). */
  cwd?: string
}

/**
 * Create a rewriter instance with the given data resolver and base path.
 *
 * @param options.dataResolver - Invoked per file with the parsed p-context descriptor;
 *   returns Record<string, unknown> keyed by p-target value
 * @param options.cwd - Base directory for resolving relative paths (default: process.cwd())
 * @returns An object with `page()` and `dynamic()` methods
 *
 * @public
 */
export const useHtmlRewriter = (options: UseHtmlRewriterOptions) => {
  const cwd = options.cwd ?? process.cwd()
  const { dataResolver } = options

  /**
   * Read a file and run the two-pass rewriter.
   */
  const processFile = async (filePath: string): Promise<string> => {
    const absolutePath = resolve(cwd, filePath)
    const file = Bun.file(absolutePath)
    const exists = await file.exists()
    if (!exists) {
      throw new FileNotFoundError(`File not found: "${filePath}" (resolved to "${absolutePath}")`)
    }
    const html = await file.text()
    return rewriteFile(html, dataResolver, { cwd, includeStack: new Set() })
  }

  /**
   * Rewrite a single HTML file and return the full document as a string.
   *
   * @param filePath - Path to the HTML file (relative to cwd)
   * @returns The rewritten HTML string
   *
   * @remarks
   * `<style>` and `<link rel="stylesheet">` elements pass through unchanged.
   * Only the `<script p-context>` tag is stripped.
   */
  const page = async (filePath: string): Promise<string> => {
    return processFile(filePath)
  }

  /**
   * Rewrite one or more HTML files and merge them into a TemplateObject.
   *
   * @param filePaths - Single path or array of paths
   * @returns A TemplateObject with html, stylesheets, scale, and $ properties
   *
   * @remarks
   * In dynamic mode:
   * - `<style>` text content is extracted into the stylesheets array and the
   *   element is removed from the html output.
   * - `<link rel="stylesheet">` throws StylesheetNotAllowedError.
   * - Stylesheets are deduplicated by exact string equality.
   */
  const dynamic = async (filePaths: string | string[]): Promise<TemplateObject> => {
    const paths = Array.isArray(filePaths) ? filePaths : [filePaths]
    const allHtml: string[] = []
    const stylesheetSet = new Set<string>()

    for (const filePath of paths) {
      const absolutePath = resolve(cwd, filePath)
      const file = Bun.file(absolutePath)
      const exists = await file.exists()
      if (!exists) {
        throw new FileNotFoundError(`File not found: "${filePath}" (resolved to "${absolutePath}")`)
      }
      const html = await file.text()

      // MINIMAL: dynamic runs 3 HTMLRewriter passes per file (capture → apply →
      // extract). Ceiling: fold <style> extraction into pass 2 so a single
      // transform does capture+apply+extract. Also note: this extraction
      // pass strips <style> from DSD <template shadowrootmode> too, breaking
      // shadow-root styles. Upgrade path: skip <style> whose ancestor chain
      // enters a [shadowrootmode] template, or handle DSD in a dedicated slice.
      // Run the rewriter pass first (strips p-context, binds data, resolves includes)
      const rewritten = await rewriteFile(html, dataResolver, { cwd, includeStack: new Set() })

      // R1: buffer <style> text per-element and push once on close.
      // HTMLRewriter streams <style> content in chunks; pushing per chunk
      // fragments one stylesheet into N+1 broken partials.
      const stylesheets: string[] = []
      let styleBuf = ''
      const extractResult = await new HTMLRewriter()
        .on('style', {
          element(el: RewriterElement) {
            el.onEndTag(() => {
              stylesheets.push(styleBuf)
              styleBuf = ''
            })
            el.remove()
          },
          text(text: RewriterText) {
            styleBuf += text.text
            text.remove()
          },
        })
        .on('link[rel="stylesheet"]', {
          element(_el: RewriterElement) {
            throw new StylesheetNotAllowedError(
              `<link rel="stylesheet"> is not allowed in dynamic mode (file: "${filePath}"). Use <style> tags instead.`,
            )
          },
        })
        .transform(new Response(rewritten))

      const extractedHtml = await extractResult.text()

      allHtml.push(extractedHtml)
      for (const sheet of stylesheets) {
        stylesheetSet.add(sheet)
      }
    }

    const result: TemplateObject = {
      html: allHtml,
      stylesheets: [...stylesheetSet],
      scale: SCALE.rel,
      $: TEMPLATE_OBJECT_IDENTIFIER,
    }

    validateTemplateObject(result)
    return result
  }

  return { page, dynamic }
}
