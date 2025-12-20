/**
 * @internal
 * @module check-playwright
 *
 * Detects and installs Playwright for CLI test runner.
 * Provides interactive installation prompts using Bun runtime.
 */

import { createInterface } from 'node:readline'

/**
 * @internal
 * Checks if Playwright is installed by attempting to resolve the module.
 *
 * @param cwd - Working directory to resolve from
 * @returns True if playwright package is resolvable
 *
 * @remarks
 * - Uses Bun.resolveSync() for module resolution
 * - Handles pnpm, custom node_modules locations, and other edge cases
 * - Synchronous operation (faster than file existence check)
 * - Does not verify playwright browser binaries are installed
 */
const isPlaywrightInstalled = (cwd: string): boolean => {
  try {
    Bun.resolveSync('playwright', cwd)
    return true
  } catch {
    return false
  }
}

/**
 * @internal
 * Prompts user for confirmation with timeout.
 *
 * @param question - Question to ask the user
 * @param defaultAnswer - Default answer if user doesn't respond (default: true)
 * @param timeoutMs - Timeout in milliseconds (default: 30000)
 * @returns Promise resolving to user's answer
 *
 * @remarks
 * - Uses readline for interactive prompt
 * - Accepts y/yes/n/no (case-insensitive)
 * - Returns default answer on timeout or empty input
 * - Automatically closes readline interface
 */
const promptUser = (question: string, defaultAnswer = true, timeoutMs = 30000): Promise<boolean> => {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    })

    const timeout = setTimeout(() => {
      rl.close()
      console.log(`\n⏱️  No response, using default: ${defaultAnswer ? 'yes' : 'no'}`)
      resolve(defaultAnswer)
    }, timeoutMs)

    rl.question(question, (answer) => {
      clearTimeout(timeout)
      rl.close()

      const normalized = answer.trim().toLowerCase()
      if (normalized === '' || normalized === 'y' || normalized === 'yes') {
        resolve(true)
      } else if (normalized === 'n' || normalized === 'no') {
        resolve(false)
      } else {
        resolve(defaultAnswer)
      }
    })
  })
}

/**
 * @internal
 * Installs Playwright and Chromium browser using Bun.
 *
 * @returns Promise resolving to true if installation succeeded
 *
 * @remarks
 * - Uses Bun.$ shell API for command execution
 * - Installs playwright package with bun add
 * - Installs chromium browser with bunx playwright
 * - Requires Bun runtime
 */
const installPlaywright = async (): Promise<boolean> => {
  console.log('\n📦 Installing Playwright with Bun...')

  try {
    console.log('Running: bun add playwright -d')
    await Bun.$`bun add playwright -d`

    console.log('\n🌐 Installing Chromium browser...')
    console.log('Running: bunx playwright install chromium')
    await Bun.$`bunx playwright install chromium`

    console.log('✅ Playwright and Chromium installed successfully\n')
    return true
  } catch (error) {
    console.error('❌ Failed to install Playwright:', error)
    return false
  }
}

/**
 * Checks for Playwright installation and prompts for installation if missing.
 * Validates that Playwright is available before running tests.
 *
 * @param cwd - Working directory to check
 * @returns Promise resolving to true if Playwright is ready to use
 *
 * @remarks
 * - Checks node_modules for playwright package
 * - Prompts user for installation if missing
 * - Returns false if user declines installation or installation fails
 * - Requires Bun runtime
 *
 * @see {@link isPlaywrightInstalled} for detection logic
 * @see {@link installPlaywright} for installation logic
 */
export const checkPlaywright = async (cwd: string): Promise<boolean> => {
  // Check if already installed
  if (isPlaywrightInstalled(cwd)) {
    return true
  }

  // Prompt for installation
  console.log('\n⚠️  Playwright is required to run tests but is not installed.')
  const shouldInstall = await promptUser('   Install Playwright now? (Y/n): ', true)

  if (!shouldInstall) {
    console.log('\n❌ Playwright is required to run tests.')
    console.log('   Install manually with:')
    console.log('   bun add playwright -d')
    console.log('   bunx playwright install chromium')
    return false
  }

  // Install playwright
  const success = await installPlaywright()

  if (!success) {
    console.log('\n❌ Installation failed. Please install manually.')
    return false
  }

  return true
}
