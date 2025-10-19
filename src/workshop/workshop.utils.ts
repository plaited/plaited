import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { globFiles } from './get-file-paths.js'
import { getStorySetMetadata } from './get-story-set-metadata.js'
import { STORY_GLOB_PATTERN, type TestStoriesOutput, type TestStoriesInput } from './test-stories.js'
import type { StoryMetadata } from './workshop.types.js'

/**
 * Prints test results to console with formatted output.
 * Passed tests are printed as simple one-liners.
 * Failed tests are printed with detailed tables.
 *
 * @param output - Test results from test-stories MCP tool
 *
 * @example
 * ```ts
 * const output = { passed: [...], failed: [...] };
 * printTestResults(output);
 * ```
 */
export const printTestResults = (output: TestStoriesOutput): void => {
  const { passed, failed } = output

  // Print passed tests
  if (passed.length > 0) {
    console.log('\n✓ Passed tests:')
    for (const { detail, meta } of passed) {
      console.log(`  ${detail}:`, meta.url)
    }
  }

  // Print failed tests
  if (failed.length > 0) {
    console.log('\n✗ Failed tests:')
    for (const { detail, meta } of failed) {
      console.table({
        url: meta.url,
        filePath: meta.filePath,
        exportName: meta.exportName,
        colorScheme: meta.colorScheme,
      })
      console.table(detail)
    }
  }

  // Print summary
  console.log(`\nTotal: ${passed.length} passed, ${failed.length} failed`)
}

/**
 * Gets entrypoints metadata from story file paths.
 * Resolves file paths relative to the provided cwd and extracts story metadata.
 *
 * @param cwd - Current working directory for resolving file paths
 * @param storyFiles - Array of story file paths or patterns
 * @returns Array of tuples containing resolved file path and story metadata
 *
 * @example
 * ```ts
 * const metadata = getEntrypointsMetadata(
 *   process.cwd(),
 *   ['Button.stories.tsx', 'Card.stories.tsx']
 * );
 * ```
 */
export const getEntrypointsMetadata = (cwd: string, storyFiles: string[]): [string, StoryMetadata[]][] => {
  return storyFiles.map((file) => {
    const filePath = Bun.resolveSync(file, cwd)
    const metadata = getStorySetMetadata(filePath)
    return [filePath, metadata]
  })
}

/**
 * Runs tests via MCP client connection to test server.
 * Discovers story files, gets metadata, runs tests via MCP tool, and prints results.
 *
 * @param options - Test runner configuration
 * @param options.cwd - Current working directory for finding story files
 * @param options.serverCommand - Command to start the MCP test server
 * @param options.serverArgs - Arguments for the server command
 * @param options.colorSchemeSupport - Whether to test in both light and dark modes
 * @param options.hostName - Hostname of the test server
 *
 * @example
 * ```ts
 * await runTestsViaMcp({
 *   cwd: process.cwd() + '/src',
 *   serverCommand: 'bun',
 *   serverArgs: ['test-server.ts'],
 *   colorSchemeSupport: false,
 *   hostName: 'http://localhost:3456'
 * });
 * ```
 */
export const runTestsViaMcp = async ({
  cwd,
  serverCommand,
  serverArgs,
  colorSchemeSupport = false,
  hostName,
}: {
  cwd: string
  serverCommand: string
  serverArgs: string[]
  colorSchemeSupport?: boolean
  hostName: string
}): Promise<void> => {
  // Create MCP client
  const transport = new StdioClientTransport({
    command: serverCommand,
    args: serverArgs,
  })

  const client = new Client({
    name: 'test-stories-cli',
    version: '1.0.0',
  })

  try {
    await client.connect(transport)

    // Discover story files
    const storyFiles = await globFiles(cwd, STORY_GLOB_PATTERN)

    if (storyFiles.length === 0) {
      console.log('No story files found')
      process.exit(0)
    }

    // Get metadata for all story files
    const storiesMetaData = storyFiles.flatMap((filePath) => {
      const metadata = getStorySetMetadata(filePath)
      return metadata
    })

    console.log(`Found ${storiesMetaData.length} stories in ${storyFiles.length} files`)

    // Call test-stories MCP tool
    const input: TestStoriesInput = {
      storiesMetaData,
      colorSchemeSupport,
      hostName,
    }

    const result = await client.callTool({
      name: 'test-stories',
      arguments: input,
    })

    // Parse and print results
    const output = result.structuredContent as TestStoriesOutput
    printTestResults(output)

    // Exit with appropriate code
    process.exit(output.failed.length > 0 ? 1 : 0)
  } catch (error) {
    console.error('Error running tests:', error)
    process.exit(1)
  } finally {
    await client.close()
  }
}
