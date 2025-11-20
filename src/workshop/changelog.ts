/**
 * Release changelog generation for SQLite database changes.
 * Tracks additions, modifications, and removals of examples and patterns.
 *
 * @module workshop/changelog
 *
 * @remarks
 * - Each release tracks database content changes
 * - Used in release PR workflow to document changes
 * - MCP-ready: Functions designed for code execution pattern
 * - Output formatted as markdown table for release notes
 *
 * @see {@link db} for database connection
 * @since 1.0.0
 */

import { db } from '../databases/db.js'

/**
 * Release change record structure.
 *
 * @property changeType - Type of change ('added', 'modified', 'removed')
 * @property tableName - Which table was affected ('examples', 'patterns')
 * @property recordId - Optional ID of the affected record
 * @property exportName - Optional export name for context
 * @property description - Human-readable description of the change
 *
 * @remarks
 * - recordId may be null for removed records
 * - exportName helps identify what API the change relates to
 *
 * @since 1.0.0
 */
export type ReleaseChange = {
  changeType: 'added' | 'modified' | 'removed'
  tableName: 'examples' | 'patterns'
  recordId?: number
  exportName?: string
  description: string
}

/**
 * Record a database change for the current release.
 *
 * @param version - Release version (e.g., '7.3.0')
 * @param change - Change details to record
 * @returns The ID of the recorded change
 *
 * @remarks
 * - Should be called whenever examples or patterns are added/modified/removed
 * - Used during release preparation to generate changelog
 * - created_at timestamp set automatically
 *
 * @throws {Error} If database insert fails
 *
 * @see {@link ReleaseChange} for change structure
 * @since 1.0.0
 */
export const recordChange = (version: string, change: ReleaseChange): number => {
  const stmt = db.prepare(`
    INSERT INTO release_changes (
      release_version, change_type, table_name, record_id, export_name, description
    ) VALUES (?, ?, ?, ?, ?, ?)
  `)

  const result = stmt.run(
    version,
    change.changeType,
    change.tableName,
    change.recordId ?? null,
    change.exportName ?? null,
    change.description,
  )

  return result.lastInsertRowid as number
}

/**
 * Generate changelog for a specific release version.
 *
 * @param version - Release version to generate changelog for
 * @returns Array of changes for the specified version
 *
 * @remarks
 * - Queries release_changes table for matching version
 * - Ordered by created_at descending (newest first)
 * - Returns empty array if no changes found
 *
 * @see {@link ReleaseChange} for return structure
 * @since 1.0.0
 */
export const generateChangelog = (version: string): ReleaseChange[] => {
  const stmt = db.prepare(`
    SELECT
      change_type as changeType,
      table_name as tableName,
      record_id as recordId,
      export_name as exportName,
      description
    FROM release_changes
    WHERE release_version = ?
    ORDER BY created_at DESC
  `)

  return stmt.all(version) as ReleaseChange[]
}

/**
 * Format changelog as markdown table.
 *
 * @param version - Release version
 * @param changes - Array of changes to format
 * @returns Markdown-formatted changelog table
 *
 * @remarks
 * - Generates GitHub-flavored markdown
 * - Groups changes by type (Added, Modified, Removed)
 * - Includes table and export name for context
 * - Returns empty string if no changes
 *
 * Usage in release PR:
 * - Append to release notes
 * - Document database content changes
 * - Help reviewers understand documentation updates
 *
 * @since 1.0.0
 */
export const formatChangelog = (version: string, changes: ReleaseChange[]): string => {
  if (changes.length === 0) {
    return `## Database Changes for v${version}\n\nNo database changes in this release.`
  }

  const groupedChanges = {
    added: changes.filter((c) => c.changeType === 'added'),
    modified: changes.filter((c) => c.changeType === 'modified'),
    removed: changes.filter((c) => c.changeType === 'removed'),
  }

  let markdown = `## Database Changes for v${version}\n\n`

  const formatSection = (title: string, items: ReleaseChange[]) => {
    if (items.length === 0) return ''

    let section = `### ${title}\n\n`
    section += '| Table | Export | Description |\n'
    section += '|-------|--------|-------------|\n'

    for (const item of items) {
      const exportName = item.exportName || '-'
      section += `| ${item.tableName} | ${exportName} | ${item.description} |\n`
    }

    return `${section}\n`
  }

  markdown += formatSection('Added', groupedChanges.added)
  markdown += formatSection('Modified', groupedChanges.modified)
  markdown += formatSection('Removed', groupedChanges.removed)

  return markdown
}

/**
 * Get all release versions that have database changes.
 *
 * @returns Array of version strings with recorded changes
 *
 * @remarks
 * - Ordered by created_at descending (newest first)
 * - Useful for listing historical changes
 * - Returns distinct versions only
 *
 * @since 1.0.0
 */
export const getVersionsWithChanges = (): string[] => {
  const stmt = db.prepare(`
    SELECT DISTINCT release_version
    FROM release_changes
    ORDER BY created_at DESC
  `)

  const rows = stmt.all() as { release_version: string }[]
  return rows.map((row) => row.release_version)
}

/**
 * Clear all changes for a specific version.
 * Use with caution - this is destructive.
 *
 * @param version - Release version to clear changes for
 * @returns Number of changes removed
 *
 * @remarks
 * - Permanently deletes change records
 * - Cannot be undone
 * - Use only when rolling back a failed release
 *
 * @since 1.0.0
 */
export const clearChanges = (version: string): number => {
  const stmt = db.prepare(`
    DELETE FROM release_changes
    WHERE release_version = ?
  `)

  const result = stmt.run(version)
  return result.changes
}
